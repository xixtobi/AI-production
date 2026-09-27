import "server-only";

import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { videoExtensions, mimeByExtension } from "@/lib/filesystem/config";
import { sha256File } from "@/lib/filesystem/metadata-service";
import {
  normalizeRelativePath,
  resolveProjectPath,
  resolveProjectRoot,
  toRelativeProjectPath,
} from "@/lib/filesystem/path-service";
import { DomainError } from "@/lib/projects/domain-error";
import type { RegisterVideoOutputInput, VideoOutputStatus } from "./types";

export function tryExtractMp4Metadata(filePath: string): { duration?: number; resolution?: string } {
  try {
    const fd = openSync(filePath, "r");
    const buf = Buffer.alloc(128 * 1024);
    const bytesRead = readSync(fd, buf, 0, buf.length, 0);
    closeSync(fd);
    if (bytesRead < 32) return {};

    let duration: number | undefined;
    let width: number | undefined;
    let height: number | undefined;

    function readBox(offset: number, maxOffset: number): void {
      let p = offset;
      while (p + 8 <= maxOffset) {
        const size = buf.readUInt32BE(p);
        const type = buf.toString("ascii", p + 4, p + 8);
        const boxEnd = size === 1 ? p + Number(buf.readBigUInt64BE(p + 8)) : p + size;
        const validBoxEnd = Math.min(boxEnd > p ? boxEnd : maxOffset, maxOffset);

        if (type === "moov" || type === "trak" || type === "mdia") {
          readBox(p + 8, validBoxEnd);
        } else if (type === "mvhd") {
          const version = buf.readUInt8(p + 8);
          let timescale = 0;
          let dur = 0;
          if (version === 1 && p + 40 <= validBoxEnd) {
            timescale = buf.readUInt32BE(p + 28);
            dur = Number(buf.readBigUInt64BE(p + 32));
          } else if (version === 0 && p + 32 <= validBoxEnd) {
            timescale = buf.readUInt32BE(p + 20);
            dur = buf.readUInt32BE(p + 24);
          }
          if (timescale > 0 && dur > 0) {
            duration = Math.round((dur / timescale) * 100) / 100;
          }
        } else if (type === "tkhd") {
          const version = buf.readUInt8(p + 8);
          const wOffset = version === 1 ? p + 92 : p + 84;
          if (wOffset + 8 <= validBoxEnd) {
            const w = buf.readUInt32BE(wOffset) >> 16;
            const h = buf.readUInt32BE(wOffset + 4) >> 16;
            if (w > 0 && h > 0 && !width) {
              width = w;
              height = h;
            }
          }
        }
        if (size <= 0) break;
        p = validBoxEnd;
      }
    }

    readBox(0, bytesRead);

    let resolution: string | undefined;
    if (width && height) {
      if (width === 1920 && height === 1080) resolution = "1080p";
      else if (width === 1080 && height === 1920) resolution = "1080p (9:16)";
      else if (width === 1280 && height === 720) resolution = "720p";
      else if (width === 3840 && height === 2160) resolution = "4K";
      else resolution = `${width}x${height}`;
    }

    return { duration, resolution };
  } catch {
    return {};
  }
}

export async function registerVideoOutput(input: RegisterVideoOutputInput): Promise<{
  videoOutput: schema.VideoOutput;
  generationAttempt?: schema.GenerationAttempt;
}> {
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, input.projectId)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");

  const shot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.projectId, input.projectId), eq(schema.shots.id, input.shotId)))
    .get();
  if (!shot) throw new DomainError("Shot tidak ditemukan.");

  const contentItemId = input.contentItemId || shot.contentItemId;
  const sceneId = input.sceneId ?? shot.sceneId;

  // Resolve file inside project root
  const root = resolveProjectRoot(project.rootPath);
  let absoluteFilePath: string;
  let relativeFilePath: string;

  if (path.isAbsolute(input.filePath)) {
    // Verify path is inside project root
    try {
      relativeFilePath = toRelativeProjectPath(root, input.filePath);
      absoluteFilePath = path.resolve(input.filePath);
    } catch {
      throw new DomainError("File video harus berada di dalam project root.");
    }
  } else {
    try {
      relativeFilePath = normalizeRelativePath(input.filePath);
      absoluteFilePath = resolveProjectPath(root, relativeFilePath);
    } catch {
      throw new DomainError("Path video tidak valid atau berada di luar project root.");
    }
  }

  // Validate existence
  if (!existsSync(absoluteFilePath)) {
    throw new DomainError(`File video tidak ditemukan di disk: ${absoluteFilePath}`);
  }

  const stat = statSync(absoluteFilePath);
  if (!stat.isFile()) {
    throw new DomainError("Path yang dipilih bukan merupakan file.");
  }

  // Validate supported video type
  const ext = path.extname(absoluteFilePath).toLowerCase();
  if (!videoExtensions.has(ext)) {
    throw new DomainError(
      `Format video '${ext}' tidak didukung. Format yang didukung: ${Array.from(videoExtensions).join(", ")}`
    );
  }

  const fileName = path.basename(absoluteFilePath);
  const mimeType = mimeByExtension[ext] || "video/mp4";
  const sha256 = await sha256File(absoluteFilePath);

  // Check for duplicate video output for this shot
  const existingForShot = db
    .select()
    .from(schema.videoOutputs)
    .where(eq(schema.videoOutputs.shotId, input.shotId))
    .all();

  const isDuplicateFile = existingForShot.some(
    (vo) => vo.filePath === relativeFilePath || vo.sha256 === sha256
  );
  if (isDuplicateFile) {
    throw new DomainError(
      `File video '${fileName}' dengan hash/path yang sama sudah terdaftar pada shot ${shot.shotCode}.`
    );
  }

  // Determine next version number: V01, V02, V03...
  const maxVersion = existingForShot.reduce((max, vo) => Math.max(max, vo.versionNumber), 0);
  const versionNumber = maxVersion + 1;
  const versionLabel = `V${String(versionNumber).padStart(2, "0")}`;

  // Read metadata
  const mp4Meta = tryExtractMp4Metadata(absoluteFilePath);
  const durationSeconds = input.customDuration ?? mp4Meta.duration ?? null;
  const resolution = input.customResolution ?? mp4Meta.resolution ?? null;

  const now = new Date();
  const videoOutputId = crypto.randomUUID();

  let queueItem: schema.FlowQueueItem | null = null;
  if (input.flowQueueItemId) {
    queueItem = db
      .select()
      .from(schema.flowQueueItems)
      .where(eq(schema.flowQueueItems.id, input.flowQueueItemId))
      .get() ?? null;
  }

  const model = input.model || queueItem?.model || null;
  const status: VideoOutputStatus = input.status || "APPROVED";

  const newVideoOutput: schema.VideoOutput = {
    id: videoOutputId,
    projectId: input.projectId,
    contentItemId,
    sceneId,
    shotId: input.shotId,
    flowQueueItemId: input.flowQueueItemId ?? null,
    generationAttemptId: input.generationAttemptId ?? null,
    versionNumber,
    versionLabel,
    filePath: relativeFilePath,
    fileName,
    fileSizeBytes: stat.size,
    durationSeconds,
    resolution,
    mimeType,
    sha256,
    model,
    status,
    notes: input.notes ?? "",
    creditsUsed: input.creditsUsed ?? null,
    createdAt: now,
    updatedAt: now,
  };

  let updatedAttempt: schema.GenerationAttempt | undefined;

  db.transaction((tx) => {
    // If linked to attempt directly
    if (input.generationAttemptId) {
      tx.update(schema.generationAttempts)
        .set({
          outputVideoId: videoOutputId,
          completedAt: now,
          status: "COMPLETED",
        })
        .where(eq(schema.generationAttempts.id, input.generationAttemptId))
        .run();

      updatedAttempt = tx
        .select()
        .from(schema.generationAttempts)
        .where(eq(schema.generationAttempts.id, input.generationAttemptId))
        .get();

      const targetQueueItemId = input.flowQueueItemId || updatedAttempt?.flowQueueItemId;
      if (targetQueueItemId) {
        tx.update(schema.flowQueueItems)
          .set({ status: "COMPLETED", updatedAt: now })
          .where(eq(schema.flowQueueItems.id, targetQueueItemId))
          .run();
      }
    } else if (input.flowQueueItemId) {
      // Find latest unlinked attempt or create one
      const existingAttempts = tx
        .select()
        .from(schema.generationAttempts)
        .where(eq(schema.generationAttempts.flowQueueItemId, input.flowQueueItemId))
        .orderBy(desc(schema.generationAttempts.attemptNumber))
        .all();

      const openAttempt = existingAttempts.find((a) => !a.outputVideoId && a.status === "STARTED");
      if (openAttempt) {
        tx.update(schema.generationAttempts)
          .set({
            outputVideoId: videoOutputId,
            completedAt: now,
            status: "COMPLETED",
          })
          .where(eq(schema.generationAttempts.id, openAttempt.id))
          .run();

        newVideoOutput.generationAttemptId = openAttempt.id;
        updatedAttempt = { ...openAttempt, outputVideoId: videoOutputId, completedAt: now, status: "COMPLETED" };
      } else {
        // Create new attempt linked to this output
        const nextAttemptNum = existingAttempts.length + 1;
        const attemptId = crypto.randomUUID();
        const attemptRecord: schema.GenerationAttempt = {
          id: attemptId,
          flowQueueItemId: input.flowQueueItemId,
          attemptNumber: nextAttemptNum,
          model: model || queueItem?.model || "Veo 3.1 Fast",
          promptVersionId: queueItem?.promptVersionId || "",
          startedAt: now,
          completedAt: now,
          status: "COMPLETED",
          outputVideoId: videoOutputId,
          failureReason: null,
          notes: `Attempt ${String(nextAttemptNum).padStart(2, "0")} → ${versionLabel}`,
        };
        tx.insert(schema.generationAttempts).values(attemptRecord).run();
        newVideoOutput.generationAttemptId = attemptId;
        updatedAttempt = attemptRecord;
      }

      // Update queue item status to COMPLETED
      tx.update(schema.flowQueueItems)
        .set({ status: "COMPLETED", updatedAt: now })
        .where(eq(schema.flowQueueItems.id, input.flowQueueItemId))
        .run();
    }

    tx.insert(schema.videoOutputs).values(newVideoOutput).run();
  });

  return {
    videoOutput: newVideoOutput,
    generationAttempt: updatedAttempt,
  };
}

export function listVideoOutputsForShot(shotId: string): schema.VideoOutput[] {
  return db
    .select()
    .from(schema.videoOutputs)
    .where(eq(schema.videoOutputs.shotId, shotId))
    .orderBy(desc(schema.videoOutputs.versionNumber))
    .all();
}

export function getVideoOutput(id: string): schema.VideoOutput | null {
  return db.select().from(schema.videoOutputs).where(eq(schema.videoOutputs.id, id)).get() ?? null;
}

export function updateVideoOutputStatus(
  id: string,
  status: VideoOutputStatus,
  notes?: string
): schema.VideoOutput {
  const now = new Date();
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: now,
  };
  if (notes !== undefined) updateData.notes = notes;

  db.update(schema.videoOutputs)
    .set(updateData)
    .where(eq(schema.videoOutputs.id, id))
    .run();

  const updated = getVideoOutput(id);
  if (!updated) throw new DomainError("Video output tidak ditemukan.");
  return updated;
}
