import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type {
  AssetChangeImpact,
  PromptChangeImpact,
  ScriptChangeImpact,
} from "./types";

/**
 * Detects which shots are impacted when a script document or version is updated.
 */
export function detectScriptChangeImpact(
  projectId: string,
  contentItemId: string
): ScriptChangeImpact[] {
  const impacts: ScriptChangeImpact[] = [];

  // Find scenes in this content item
  const scenes = db
    .select()
    .from(schema.scenes)
    .where(and(eq(schema.scenes.projectId, projectId), eq(schema.scenes.contentItemId, contentItemId)))
    .all();

  // Find current script document and versions
  const scriptDoc = db
    .select()
    .from(schema.scriptDocuments)
    .where(and(eq(schema.scriptDocuments.projectId, projectId), eq(schema.scriptDocuments.contentItemId, contentItemId)))
    .get();

  if (!scriptDoc) return impacts;

  const versions = db
    .select()
    .from(schema.scriptVersions)
    .where(eq(schema.scriptVersions.scriptDocumentId, scriptDoc.id))
    .orderBy(desc(schema.scriptVersions.versionNumber))
    .all();

  // If there are multiple versions or recent edits
  if (versions.length > 0) {
    const latestVersion = versions[0];

    // Find script scenes belonging to latest version
    const scriptScenes = db
      .select()
      .from(schema.scriptScenes)
      .where(eq(schema.scriptScenes.scriptVersionId, latestVersion.id))
      .all();

    for (const sc of scriptScenes) {
      // Find matching scene in production shots
      const matchingScene = scenes.find(
        (s) => s.sceneNumber === sc.sceneNumber || s.code === sc.sceneCode
      );

      // Find shots in this scene
      const sceneShots = matchingScene
        ? db
            .select()
            .from(schema.shots)
            .where(
              and(
                eq(schema.shots.projectId, projectId),
                eq(schema.shots.contentItemId, contentItemId),
                eq(schema.shots.sceneId, matchingScene.id)
              )
            )
            .all()
        : [];

      if (sceneShots.length > 0) {
        impacts.push({
          type: "SCRIPT_CHANGE",
          sceneCode: sc.sceneCode,
          blockType: "SCENE_UPDATE",
          description: `Perubahan naskah pada ${sc.sceneCode} (${sc.heading}): ${sceneShots.map((s) => s.shotCode).join(", ")} mungkin terdampak.`,
          affectedShotIds: sceneShots.map((s) => s.id),
          affectedShotCodes: sceneShots.map((s) => s.shotCode),
        });
      }
    }
  }

  return impacts;
}

/**
 * Detects which shots are affected when an asset (e.g. KF-B08) has been updated or changed.
 */
export function detectAssetChangeImpact(
  projectId: string,
  assetCodeOrId: string
): AssetChangeImpact | null {
  const asset = db
    .select()
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.projectId, projectId),
        // Match either ID or assetCode
        eq(schema.assets.assetCode, assetCodeOrId)
      )
    )
    .get() || db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.projectId, projectId), eq(schema.assets.id, assetCodeOrId)))
    .get();

  if (!asset) return null;

  // Find current version
  const currentVersion = db
    .select()
    .from(schema.assetVersions)
    .where(and(eq(schema.assetVersions.assetId, asset.id), eq(schema.assetVersions.isCurrent, true)))
    .get();

  // Find all shots linked to this asset via shot_assets
  const links = db
    .select()
    .from(schema.shotAssets)
    .where(and(eq(schema.shotAssets.projectId, projectId), eq(schema.shotAssets.assetId, asset.id)))
    .all();

  const shotIds = Array.from(new Set(links.map((l) => l.shotId)));

  // Also check flow_queue_items using this asset as startFrame
  if (currentVersion) {
    const queueUsingAsStart = db
      .select()
      .from(schema.flowQueueItems)
      .where(
        and(
          eq(schema.flowQueueItems.projectId, projectId),
          eq(schema.flowQueueItems.startFrameAssetVersionId, currentVersion.id)
        )
      )
      .all();
    for (const q of queueUsingAsStart) {
      if (!shotIds.includes(q.shotId)) shotIds.push(q.shotId);
    }
  }

  const affectedShots = shotIds.length > 0
    ? db
        .select()
        .from(schema.shots)
        .where(and(eq(schema.shots.projectId, projectId), inArray(schema.shots.id, shotIds)))
        .all()
    : [];

  return {
    type: "ASSET_CHANGE",
    assetCode: asset.assetCode,
    assetName: asset.name,
    versionLabel: currentVersion?.versionLabel || "v001",
    description: `Aset ${asset.assetCode} (${asset.name}) digunakan oleh: ${affectedShots.map((s) => s.shotCode).join(", ")}.`,
    affectedShotIds: affectedShots.map((s) => s.id),
    affectedShotCodes: affectedShots.map((s) => s.shotCode),
  };
}

/**
 * Detects which Flow jobs / queue items are affected when a prompt version changes.
 */
export function detectPromptChangeImpact(
  projectId: string,
  promptVersionId: string
): PromptChangeImpact | null {
  const version = db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.id, promptVersionId))
    .get();
  if (!version) return null;

  const doc = db
    .select()
    .from(schema.promptDocuments)
    .where(eq(schema.promptDocuments.id, version.promptDocumentId))
    .get();
  if (!doc || doc.projectId !== projectId) return null;

  const shot = doc.shotId
    ? db.select().from(schema.shots).where(eq(schema.shots.id, doc.shotId)).get()
    : null;

  // Find queue items referencing this prompt document or version
  const queueItems = db
    .select()
    .from(schema.flowQueueItems)
    .where(
      and(
        eq(schema.flowQueueItems.projectId, projectId),
        eq(schema.flowQueueItems.promptVersionId, promptVersionId)
      )
    )
    .all();

  const affectedIds = queueItems.map((q) => q.id);
  const jobDirs = queueItems.map((q) => `JOB-${q.id.slice(0, 4).toUpperCase()}`);

  return {
    type: "PROMPT_CHANGE",
    shotCode: shot?.shotCode || "UNKNOWN",
    promptVersionLabel: version.versionLabel,
    description: `Prompt versi ${version.versionLabel} diperbarui: Flow Jobs ${jobDirs.join(", ")} mungkin perlu diperiksa.`,
    affectedFlowQueueItemIds: affectedIds,
    affectedJobDirectories: jobDirs,
  };
}
