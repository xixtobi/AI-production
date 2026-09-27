import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import type { FlowQueuePayload, ReferenceAssetInfo } from "./types";

export function addToFlowQueue(params: {
  projectId: string;
  shotId: string;
  promptVersionId?: string;
  engine?: string;
  customParameters?: Record<string, unknown>;
}): {
  item: schema.FlowQueueItem;
  payload: FlowQueuePayload;
} {
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, params.projectId))
    .get();

  if (!project) {
    throw new DomainError("Proyek tidak ditemukan.");
  }

  const shot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.id, params.shotId), eq(schema.shots.projectId, params.projectId)))
    .get();

  if (!shot) {
    throw new DomainError("Shot tidak ditemukan.");
  }

  const content = shot.contentItemId
    ? db.select().from(schema.contentItems).where(eq(schema.contentItems.id, shot.contentItemId)).get()
    : null;

  const scene = shot.sceneId
    ? db.select().from(schema.scenes).where(eq(schema.scenes.id, shot.sceneId)).get()
    : null;

  // Resolve prompt version
  let version: schema.PromptVersion | undefined;
  if (params.promptVersionId) {
    version = db
      .select()
      .from(schema.promptVersions)
      .where(eq(schema.promptVersions.id, params.promptVersionId))
      .get();
  } else {
    // Look up prompt document
    const doc = db
      .select()
      .from(schema.promptDocuments)
      .where(and(eq(schema.promptDocuments.shotId, shot.id), eq(schema.promptDocuments.projectId, params.projectId)))
      .get();

    if (doc) {
      const versions = db
        .select()
        .from(schema.promptVersions)
        .where(eq(schema.promptVersions.promptDocumentId, doc.id))
        .orderBy(desc(schema.promptVersions.versionNumber))
        .all();
      version = versions.find((v) => v.isCurrent) || versions[0];
    }
  }

  if (!version) {
    throw new DomainError("Versi prompt tidak ditemukan untuk dimasukkan ke Flow Queue. Simpan draf prompt terlebih dahulu.");
  }

  let baseParameters: Record<string, unknown> = {};
  try {
    if (version.parametersJson) {
      baseParameters = JSON.parse(version.parametersJson);
    }
  } catch {}

  const mergedParams = {
    ...baseParameters,
    ...params.customParameters,
  };

  const targetEngine = params.engine || (mergedParams.engine as string) || "VEO";

  // Linked assets
  const rawLinks = db
    .select()
    .from(schema.shotAssets)
    .where(and(eq(schema.shotAssets.shotId, shot.id), eq(schema.shotAssets.projectId, params.projectId)))
    .all();

  let startFrame: ReferenceAssetInfo | undefined;
  let startFrameVersionId: string | null = null;
  let endFrame: ReferenceAssetInfo | undefined;
  let endFrameVersionId: string | null = null;
  const characterReferences: ReferenceAssetInfo[] = [];
  const environmentReferences: ReferenceAssetInfo[] = [];

  for (const link of rawLinks) {
    const asset = db.select().from(schema.assets).where(eq(schema.assets.id, link.assetId)).get();
    if (!asset) continue;

    const v = db
      .select()
      .from(schema.assetVersions)
      .where(and(eq(schema.assetVersions.assetId, asset.id), eq(schema.assetVersions.isCurrent, true)))
      .get();

    const assetPath = v ? v.relativePath : `ASSETS/${asset.assetCode}`;
    const info: ReferenceAssetInfo = {
      assetCode: asset.assetCode,
      name: asset.name,
      path: assetPath,
      role: link.role,
    };

    if (link.role === "START_FRAME") {
      startFrame = info;
      if (v) startFrameVersionId = v.id;
    } else if (link.role === "END_FRAME") {
      endFrame = info;
      if (v) endFrameVersionId = v.id;
    } else if (link.role === "CHARACTER_REFERENCE") {
      characterReferences.push(info);
    } else if (link.role === "ENVIRONMENT_REFERENCE") {
      environmentReferences.push(info);
    }
  }

  const now = new Date();
  const payload: FlowQueuePayload = {
    promptText: version.promptText,
    negativePrompt: version.negativePrompt || "",
    engine: targetEngine,
    parameters: {
      aspectRatio: (mergedParams.aspectRatio as string) || project.defaultAspectRatio || "16:9",
      duration: typeof mergedParams.duration === "number" ? mergedParams.duration : shot.durationTarget ? Math.round(shot.durationTarget) : 4,
      resolution: (mergedParams.resolution as string) || "1080p",
      audio: mergedParams.audio === true,
      seed: typeof mergedParams.seed === "number" ? mergedParams.seed : null,
      ...mergedParams,
    },
    referenceAssets: {
      startFrame,
      endFrame,
      characterReferences,
      environmentReferences,
    },
    metadata: {
      projectId: project.id,
      projectCode: project.code,
      contentId: content?.id || null,
      contentCode: content?.code || null,
      sceneId: scene?.id || null,
      sceneCode: scene?.code || null,
      shotId: shot.id,
      shotCode: shot.shotCode,
      promptDocumentId: version.promptDocumentId,
      promptVersionId: version.id,
      versionLabel: version.versionLabel,
      source: version.source,
    },
    stagedAt: now.toISOString(),
  };

  const itemId = crypto.randomUUID();
  const customParams = params.customParameters || {};
  const queueItem: schema.FlowQueueItem = {
    id: itemId,
    projectId: project.id,
    contentItemId: content?.id || null,
    sceneId: scene?.id || null,
    shotId: shot.id,
    promptVersionId: version.id,
    engine: targetEngine,
    model: (customParams.model as string) || "Veo 3.1 Fast",
    durationSeconds: customParams.duration != null ? Number(customParams.duration) : 5,
    aspectRatio: (customParams.aspectRatio as string) || "16:9",
    resolution: (customParams.resolution as string) || "1080p",
    audioEnabled: customParams.audio === true,
    startFrameAssetVersionId: startFrameVersionId,
    endFrameAssetVersionId: endFrameVersionId,
    recipeSnapshotJson: JSON.stringify(payload, null, 2),
    notes: "",
    estimatedCredits: null,
    status: "STAGED",
    payloadJson: JSON.stringify(payload),
    createdAt: now,
    updatedAt: now,
  };

  db.insert(schema.flowQueueItems).values(queueItem).run();

  return {
    item: queueItem,
    payload,
  };
}

export function listFlowQueueItems(projectId: string, shotId?: string): schema.FlowQueueItem[] {
  const query = db.select().from(schema.flowQueueItems);

  if (shotId) {
    return query
      .where(and(eq(schema.flowQueueItems.projectId, projectId), eq(schema.flowQueueItems.shotId, shotId)))
      .orderBy(desc(schema.flowQueueItems.createdAt))
      .all();
  }

  return query
    .where(eq(schema.flowQueueItems.projectId, projectId))
    .orderBy(desc(schema.flowQueueItems.createdAt))
    .all();
}

export function getFlowQueueItem(itemId: string): {
  item: schema.FlowQueueItem;
  payload: FlowQueuePayload;
} {
  const item = db
    .select()
    .from(schema.flowQueueItems)
    .where(eq(schema.flowQueueItems.id, itemId))
    .get();

  if (!item) {
    throw new DomainError("Item Flow Queue tidak ditemukan.");
  }

  let payload: FlowQueuePayload;
  try {
    payload = JSON.parse(item.payloadJson);
  } catch {
    throw new DomainError("Payload Flow Queue rusak atau bukan JSON valid.");
  }

  return { item, payload };
}
