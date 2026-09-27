import "server-only";

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { validateFlowCompatibility } from "./model-capabilities";
import type {
  CreateFlowQueueItemInput,
  FlowJobManifest,
  FlowQueueFilters,
  FlowQueueItemDetail,
  FlowQueueReferenceRole,
  FlowQueueStatus,
  RecipeSnapshot,
} from "./types";

export function createFlowQueueItem(input: CreateFlowQueueItemInput): {
  item: schema.FlowQueueItem;
  recipeSnapshot: RecipeSnapshot;
  validation: ReturnType<typeof validateFlowCompatibility>;
} {
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, input.projectId))
    .get();

  if (!project) throw new DomainError("Proyek tidak ditemukan.");

  const shot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.projectId, input.projectId), eq(schema.shots.id, input.shotId)))
    .get();

  if (!shot) throw new DomainError("Shot tidak ditemukan.");

  const content = db
    .select()
    .from(schema.contentItems)
    .where(eq(schema.contentItems.id, input.contentItemId))
    .get();

  if (!content) throw new DomainError("Content item tidak ditemukan.");

  const scene = input.sceneId
    ? db.select().from(schema.scenes).where(eq(schema.scenes.id, input.sceneId)).get()
    : null;

  const promptVersion = db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.id, input.promptVersionId))
    .get();

  if (!promptVersion) throw new DomainError("Versi prompt tidak ditemukan.");

  // Resolve start frame asset version if provided
  let startFrameVersion: schema.AssetVersion | null = null;
  let startFrameAsset: schema.Asset | null = null;
  if (input.startFrameAssetVersionId) {
    startFrameVersion = db
      .select()
      .from(schema.assetVersions)
      .where(eq(schema.assetVersions.id, input.startFrameAssetVersionId))
      .get() ?? null;
    if (startFrameVersion) {
      startFrameAsset = db
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.id, startFrameVersion.assetId))
        .get() ?? null;
    }
  }

  // Resolve end frame asset version if provided
  let endFrameVersion: schema.AssetVersion | null = null;
  let endFrameAsset: schema.Asset | null = null;
  if (input.endFrameAssetVersionId) {
    endFrameVersion = db
      .select()
      .from(schema.assetVersions)
      .where(eq(schema.assetVersions.id, input.endFrameAssetVersionId))
      .get() ?? null;
    if (endFrameVersion) {
      endFrameAsset = db
        .select()
        .from(schema.assets)
        .where(eq(schema.assets.id, endFrameVersion.assetId))
        .get() ?? null;
    }
  }

  // Resolve references
  const referenceList: Array<{
    assetId: string;
    assetVersionId: string;
    role: string;
    code?: string;
    name?: string;
    relativePath: string;
    fileName: string;
    sortOrder: number;
  }> = [];

  const refVersionIds: string[] = [];
  if (input.references && input.references.length > 0) {
    for (let i = 0; i < input.references.length; i++) {
      const ref = input.references[i];
      refVersionIds.push(ref.assetVersionId);
      const v = db
        .select()
        .from(schema.assetVersions)
        .where(eq(schema.assetVersions.id, ref.assetVersionId))
        .get();
      if (v) {
        const a = db.select().from(schema.assets).where(eq(schema.assets.id, v.assetId)).get();
        referenceList.push({
          assetId: v.assetId,
          assetVersionId: v.id,
          role: ref.role,
          code: a?.assetCode,
          name: a?.name,
          relativePath: v.relativePath,
          fileName: v.filename,
          sortOrder: ref.sortOrder ?? i,
        });
      }
    }
  }

  const model = input.model || "Veo 3.1 Fast";
  const durationSeconds = input.durationSeconds ?? 5;
  const aspectRatio = input.aspectRatio || "16:9";
  const resolution = input.resolution || "1080p";
  const audioEnabled = input.audioEnabled ?? false;
  const engine = input.engine || "VEO";

  // Validate capabilities
  const validation = validateFlowCompatibility({
    projectId: input.projectId,
    shotId: input.shotId,
    promptVersionId: input.promptVersionId,
    model,
    durationSeconds,
    aspectRatio,
    resolution,
    audioEnabled,
    startFrameAssetVersionId: input.startFrameAssetVersionId,
    endFrameAssetVersionId: input.endFrameAssetVersionId,
    referenceAssetVersionIds: refVersionIds,
  });

  const now = new Date();
  const queueItemId = crypto.randomUUID();

  let promptParams: Record<string, unknown> | null = null;
  if (promptVersion.parametersJson) {
    try {
      promptParams = JSON.parse(promptVersion.parametersJson);
    } catch {
      promptParams = null;
    }
  }

  // Create immutable recipe snapshot
  const recipeSnapshot: RecipeSnapshot = {
    projectId: project.id,
    projectName: project.name,
    contentCode: content.code,
    sceneCode: scene ? scene.code : null,
    shotCode: shot.shotCode,
    shotTitle: shot.title,
    prompt: {
      versionId: promptVersion.id,
      versionLabel: promptVersion.versionLabel,
      promptText: promptVersion.promptText,
      negativePrompt: promptVersion.negativePrompt,
      parameters: promptParams,
    },
    generationSettings: {
      engine,
      model,
      durationSeconds,
      aspectRatio,
      resolution,
      audioEnabled,
    },
    startFrame: startFrameVersion
      ? {
          assetId: startFrameVersion.assetId,
          assetVersionId: startFrameVersion.id,
          code: startFrameAsset?.assetCode,
          name: startFrameAsset?.name,
          relativePath: startFrameVersion.relativePath,
          fileName: startFrameVersion.filename,
        }
      : null,
    endFrame: endFrameVersion
      ? {
          assetId: endFrameVersion.assetId,
          assetVersionId: endFrameVersion.id,
          code: endFrameAsset?.assetCode,
          name: endFrameAsset?.name,
          relativePath: endFrameVersion.relativePath,
          fileName: endFrameVersion.filename,
        }
      : null,
    references: referenceList.map((r) => ({
      assetId: r.assetId,
      assetVersionId: r.assetVersionId,
      role: r.role,
      code: r.code,
      name: r.name,
      relativePath: r.relativePath,
      fileName: r.fileName,
    })),
    createdAt: now.toISOString(),
    snapshotVersion: "1.0",
  };

  const recipeSnapshotJson = JSON.stringify(recipeSnapshot, null, 2);

  const initialStatus: FlowQueueStatus = validation.valid ? "READY" : "BLOCKED";

  const queueItem: schema.FlowQueueItem = {
    id: queueItemId,
    projectId: input.projectId,
    contentItemId: input.contentItemId,
    sceneId: input.sceneId ?? null,
    shotId: input.shotId,
    promptVersionId: input.promptVersionId,
    status: initialStatus,
    engine,
    model,
    durationSeconds,
    aspectRatio,
    resolution,
    audioEnabled,
    startFrameAssetVersionId: input.startFrameAssetVersionId ?? null,
    endFrameAssetVersionId: input.endFrameAssetVersionId ?? null,
    recipeSnapshotJson,
    notes: input.notes ?? "",
    estimatedCredits: input.estimatedCredits ?? null,
    payloadJson: recipeSnapshotJson,
    createdAt: now,
    updatedAt: now,
  };

  db.transaction((tx) => {
    tx.insert(schema.flowQueueItems).values(queueItem).run();

    for (const ref of referenceList) {
      tx.insert(schema.flowQueueReferences)
        .values({
          id: crypto.randomUUID(),
          flowQueueItemId: queueItemId,
          assetVersionId: ref.assetVersionId,
          role: ref.role as FlowQueueReferenceRole,
          sortOrder: ref.sortOrder,
        })
        .run();
    }
  });

  return {
    item: queueItem,
    recipeSnapshot,
    validation,
  };
}

export function getFlowQueueItem(id: string): FlowQueueItemDetail | null {
  const item = db.select().from(schema.flowQueueItems).where(eq(schema.flowQueueItems.id, id)).get();
  if (!item) return null;

  const shot = db.select().from(schema.shots).where(eq(schema.shots.id, item.shotId)).get();
  if (!shot) return null;

  const content = db.select().from(schema.contentItems).where(eq(schema.contentItems.id, item.contentItemId ?? "")).get();
  if (!content) return null;

  const scene = item.sceneId
    ? db.select().from(schema.scenes).where(eq(schema.scenes.id, item.sceneId)).get()
    : null;

  const promptVersion = db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.id, item.promptVersionId))
    .get();
  if (!promptVersion) return null;

  const startFrameVersion = item.startFrameAssetVersionId
    ? db.select().from(schema.assetVersions).where(eq(schema.assetVersions.id, item.startFrameAssetVersionId)).get() ?? null
    : null;

  const endFrameVersion = item.endFrameAssetVersionId
    ? db.select().from(schema.assetVersions).where(eq(schema.assetVersions.id, item.endFrameAssetVersionId)).get() ?? null
    : null;

  const rawRefs = db
    .select()
    .from(schema.flowQueueReferences)
    .where(eq(schema.flowQueueReferences.flowQueueItemId, id))
    .orderBy(schema.flowQueueReferences.sortOrder)
    .all();

  const references: FlowQueueItemDetail["references"] = [];
  for (const ref of rawRefs) {
    const v = db.select().from(schema.assetVersions).where(eq(schema.assetVersions.id, ref.assetVersionId)).get();
    if (v) {
      const a = db.select().from(schema.assets).where(eq(schema.assets.id, v.assetId)).get();
      if (a) {
        references.push({ link: ref, asset: a, version: v });
      }
    }
  }

  const attempts = db
    .select()
    .from(schema.generationAttempts)
    .where(eq(schema.generationAttempts.flowQueueItemId, id))
    .orderBy(schema.generationAttempts.attemptNumber)
    .all();

  const videoOutputs = db
    .select()
    .from(schema.videoOutputs)
    .where(eq(schema.videoOutputs.flowQueueItemId, id))
    .orderBy(schema.videoOutputs.versionNumber)
    .all();

  return {
    item,
    shot,
    content,
    scene,
    promptVersion,
    startFrameVersion,
    endFrameVersion,
    references,
    attempts,
    videoOutputs,
  };
}

export function listFlowQueueItems(
  filters: FlowQueueFilters & { projectId: string }
): FlowQueueItemDetail[] {
  const query = db
    .select()
    .from(schema.flowQueueItems)
    .where(eq(schema.flowQueueItems.projectId, filters.projectId))
    .orderBy(desc(schema.flowQueueItems.createdAt));

  const items = query.all();

  const details: FlowQueueItemDetail[] = [];
  for (const item of items) {
    if (filters.contentItemId && item.contentItemId !== filters.contentItemId) continue;
    if (filters.sceneId && item.sceneId !== filters.sceneId) continue;
    if (filters.shotId && item.shotId !== filters.shotId) continue;
    if (filters.status && item.status !== filters.status) continue;
    if (filters.model && item.model !== filters.model) continue;
    if (filters.readyState) {
      if (filters.readyState === "READY" && item.status !== "READY") continue;
      if (filters.readyState === "NOT_READY" && item.status === "READY") continue;
    }

    const detail = getFlowQueueItem(item.id);
    if (!detail) continue;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchShot = detail.shot.shotCode.toLowerCase().includes(search) || detail.shot.title.toLowerCase().includes(search);
      const matchPrompt = detail.promptVersion.promptText.toLowerCase().includes(search);
      const matchModel = item.model.toLowerCase().includes(search);
      if (!matchShot && !matchPrompt && !matchModel) continue;
    }

    details.push(detail);
  }

  return details;
}

export function resolveFlowJobDirectory(params: {
  projectRoot: string;
  contentCode: string;
  shotCode: string;
  jobCode: string;
}): string {
  const jobDir = path.join(params.projectRoot, params.contentCode, params.shotCode, "FLOW", params.jobCode);
  mkdirSync(jobDir, { recursive: true });
  return jobDir;
}

export function prepareFlowJob(
  flowQueueItemId: string,
  options?: { createPackage?: boolean }
): {
  jobDirectory: string;
  manifest: FlowJobManifest;
  files: string[];
} {
  const detail = getFlowQueueItem(flowQueueItemId);
  if (!detail) throw new DomainError("Queue item tidak ditemukan.");

  const project = db.select().from(schema.projects).where(eq(schema.projects.id, detail.item.projectId)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");

  const jobCode = `JOB-${detail.item.id.slice(0, 8).toUpperCase()}`;
  const jobDir = resolveFlowJobDirectory({
    projectRoot: project.rootPath,
    contentCode: detail.content.code,
    shotCode: detail.shot.shotCode,
    jobCode,
  });

  const referencesDir = path.join(jobDir, "references");
  mkdirSync(referencesDir, { recursive: true });

  const filesWritten: string[] = [];

  // Parse recipe snapshot for immutable record
  let recipe: RecipeSnapshot;
  try {
    recipe = JSON.parse(detail.item.recipeSnapshotJson);
  } catch {
    recipe = {
      projectId: project.id,
      projectName: project.name,
      contentCode: detail.content.code,
      sceneCode: detail.scene ? detail.scene.code : null,
      shotCode: detail.shot.shotCode,
      shotTitle: detail.shot.title,
      prompt: {
        versionId: detail.promptVersion.id,
        versionLabel: detail.promptVersion.versionLabel,
        promptText: detail.promptVersion.promptText,
        negativePrompt: detail.promptVersion.negativePrompt,
      },
      generationSettings: {
        engine: detail.item.engine,
        model: detail.item.model,
        durationSeconds: detail.item.durationSeconds,
        aspectRatio: detail.item.aspectRatio,
        resolution: detail.item.resolution,
        audioEnabled: detail.item.audioEnabled,
      },
      startFrame: detail.startFrameVersion
        ? {
            assetId: detail.startFrameVersion.assetId,
            assetVersionId: detail.startFrameVersion.id,
            relativePath: detail.startFrameVersion.relativePath,
            fileName: detail.startFrameVersion.filename,
          }
        : null,
      endFrame: detail.endFrameVersion
        ? {
            assetId: detail.endFrameVersion.assetId,
            assetVersionId: detail.endFrameVersion.id,
            relativePath: detail.endFrameVersion.relativePath,
            fileName: detail.endFrameVersion.filename,
          }
        : null,
      references: detail.references.map((r) => ({
        assetId: r.asset.id,
        assetVersionId: r.version.id,
        role: r.link.role,
        relativePath: r.version.relativePath,
        fileName: r.version.filename,
      })),
      createdAt: new Date().toISOString(),
      snapshotVersion: "1.0",
    };
  }

  // 1. prompt.txt
  const promptTxtPath = path.join(jobDir, "prompt.txt");
  let promptContent = recipe.prompt.promptText;
  if (recipe.prompt.negativePrompt) {
    promptContent += `\n\n--negative-prompt\n${recipe.prompt.negativePrompt}`;
  }
  writeFileSync(promptTxtPath, promptContent, "utf-8");
  filesWritten.push(promptTxtPath);

  // 2. generation-settings.json
  const settingsJsonPath = path.join(jobDir, "generation-settings.json");
  writeFileSync(settingsJsonPath, JSON.stringify(recipe.generationSettings, null, 2), "utf-8");
  filesWritten.push(settingsJsonPath);

  // 3. Optional package mode: copy references into references/
  if (options?.createPackage) {
    if (detail.startFrameVersion) {
      const src = path.resolve(project.rootPath, detail.startFrameVersion.relativePath);
      if (existsSync(src)) {
        const dest = path.join(referencesDir, `START_FRAME_${path.basename(src)}`);
        copyFileSync(src, dest);
        filesWritten.push(dest);
      }
    }
    if (detail.endFrameVersion) {
      const src = path.resolve(project.rootPath, detail.endFrameVersion.relativePath);
      if (existsSync(src)) {
        const dest = path.join(referencesDir, `END_FRAME_${path.basename(src)}`);
        copyFileSync(src, dest);
        filesWritten.push(dest);
      }
    }
    for (const ref of detail.references) {
      const src = path.resolve(project.rootPath, ref.version.relativePath);
      if (existsSync(src)) {
        const dest = path.join(referencesDir, `${ref.link.role}_${path.basename(src)}`);
        copyFileSync(src, dest);
        filesWritten.push(dest);
      }
    }
  }

  // 4. manifest.json
  const now = new Date();
  const manifest: FlowJobManifest = {
    jobId: jobCode,
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
    },
    content: {
      id: detail.content.id,
      code: detail.content.code,
      title: detail.content.title,
    },
    scene: detail.scene
      ? {
          id: detail.scene.id,
          code: detail.scene.code,
          title: detail.scene.title,
        }
      : null,
    shot: {
      id: detail.shot.id,
      code: detail.shot.shotCode,
      title: detail.shot.title,
    },
    promptVersion: {
      id: detail.promptVersion.id,
      versionLabel: detail.promptVersion.versionLabel,
      promptText: detail.promptVersion.promptText,
      negativePrompt: detail.promptVersion.negativePrompt,
    },
    model: detail.item.model,
    engine: detail.item.engine,
    duration: detail.item.durationSeconds,
    aspectRatio: detail.item.aspectRatio,
    resolution: detail.item.resolution,
    audio: detail.item.audioEnabled,
    startFrame: detail.startFrameVersion
      ? {
          assetVersionId: detail.startFrameVersion.id,
          relativePath: detail.startFrameVersion.relativePath,
          fileName: detail.startFrameVersion.filename,
        }
      : null,
    endFrame: detail.endFrameVersion
      ? {
          assetVersionId: detail.endFrameVersion.id,
          relativePath: detail.endFrameVersion.relativePath,
          fileName: detail.endFrameVersion.filename,
        }
      : null,
    references: detail.references.map((r) => ({
      assetVersionId: r.version.id,
      role: r.link.role,
      relativePath: r.version.relativePath,
      fileName: r.version.filename,
    })),
    preparedAt: now.toISOString(),
    preparationDirectory: jobDir,
  };

  const manifestPath = path.join(jobDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  filesWritten.push(manifestPath);

  return {
    jobDirectory: jobDir,
    manifest,
    files: filesWritten,
  };
}

export function prepareBatchFlowJobs(
  itemIds: string[],
  options?: { createPackage?: boolean }
): Array<{ itemId: string; success: boolean; jobDirectory?: string; error?: string }> {
  const results: Array<{ itemId: string; success: boolean; jobDirectory?: string; error?: string }> = [];

  for (const id of itemIds) {
    try {
      const prep = prepareFlowJob(id, options);
      results.push({ itemId: id, success: true, jobDirectory: prep.jobDirectory });
    } catch (err: unknown) {
      results.push({
        itemId: id,
        success: false,
        error: err instanceof Error ? err.message : "Gagal menyiapkan job.",
      });
    }
  }

  return results;
}

export function createGenerationAttempt(params: {
  flowQueueItemId: string;
  model?: string;
  promptVersionId?: string;
  notes?: string;
}): schema.GenerationAttempt {
  const item = db
    .select()
    .from(schema.flowQueueItems)
    .where(eq(schema.flowQueueItems.id, params.flowQueueItemId))
    .get();

  if (!item) throw new DomainError("Queue item tidak ditemukan.");

  const existingAttempts = db
    .select()
    .from(schema.generationAttempts)
    .where(eq(schema.generationAttempts.flowQueueItemId, params.flowQueueItemId))
    .all();

  const attemptNumber = existingAttempts.length + 1;
  const now = new Date();
  const attemptId = crypto.randomUUID();

  const attempt: schema.GenerationAttempt = {
    id: attemptId,
    flowQueueItemId: params.flowQueueItemId,
    attemptNumber,
    model: params.model || item.model,
    promptVersionId: params.promptVersionId || item.promptVersionId,
    startedAt: now,
    completedAt: null,
    status: "STARTED",
    outputVideoId: null,
    failureReason: null,
    notes: params.notes ?? `Attempt ${String(attemptNumber).padStart(2, "0")}`,
  };

  db.transaction((tx) => {
    tx.insert(schema.generationAttempts).values(attempt).run();
    tx.update(schema.flowQueueItems)
      .set({ status: "GENERATING", updatedAt: now })
      .where(eq(schema.flowQueueItems.id, params.flowQueueItemId))
      .run();
  });

  return attempt;
}

export function updateFlowQueueItemStatus(
  id: string,
  status: FlowQueueStatus,
  notes?: string
): schema.FlowQueueItem {
  const now = new Date();
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: now,
  };
  if (notes !== undefined) updateData.notes = notes;

  db.update(schema.flowQueueItems)
    .set(updateData)
    .where(eq(schema.flowQueueItems.id, id))
    .run();

  const updated = db.select().from(schema.flowQueueItems).where(eq(schema.flowQueueItems.id, id)).get();
  if (!updated) throw new DomainError("Queue item tidak ditemukan.");
  return updated;
}

export function getFlowQueueSummary(projectId: string, contentItemId?: string) {
  const query = db
    .select()
    .from(schema.flowQueueItems)
    .where(eq(schema.flowQueueItems.projectId, projectId));

  const items = query.all();

  const summary = {
    total: 0,
    ready: 0,
    generating: 0,
    completed: 0,
    needsReview: 0,
    failed: 0,
    blocked: 0,
    queued: 0,
    staged: 0,
  };

  for (const item of items) {
    if (contentItemId && item.contentItemId !== contentItemId) continue;
    summary.total++;
    switch (item.status) {
      case "READY":
        summary.ready++;
        break;
      case "GENERATING":
      case "PROCESSING":
        summary.generating++;
        break;
      case "COMPLETED":
        summary.completed++;
        break;
      case "NEEDS_REVIEW":
        summary.needsReview++;
        break;
      case "FAILED":
        summary.failed++;
        break;
      case "BLOCKED":
        summary.blocked++;
        break;
      case "QUEUED":
        summary.queued++;
        break;
      case "STAGED":
        summary.staged++;
        break;
    }
  }

  return summary;
}
