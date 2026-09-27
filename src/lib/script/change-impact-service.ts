import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getVersionDetail } from "./script-service";
import type { AffectedShot, ChangeImpactReport, ScriptDiffItem } from "./types";

export function compareScriptVersions(
  baseVersionId: string,
  targetVersionId: string
): ChangeImpactReport {
  const baseVersion = getVersionDetail(baseVersionId);
  const targetVersion = getVersionDetail(targetVersionId);

  if (!baseVersion || !targetVersion) {
    throw new Error("Satu atau kedua versi skrip tidak ditemukan.");
  }

  // Get script document to identify projectId and contentItemId
  const scriptDoc = db
    .select()
    .from(schema.scriptDocuments)
    .where(eq(schema.scriptDocuments.id, targetVersion.scriptDocumentId))
    .get();

  const projectId = scriptDoc?.projectId;
  const contentItemId = scriptDoc?.contentItemId;

  const diffs: ScriptDiffItem[] = [];
  const modifiedSceneCodes = new Set<string>();
  const modifiedSceneLinkedIds = new Set<string>();

  const baseScenesMap = new Map(baseVersion.scenes.map((s) => [s.sceneCode, s]));
  const targetScenesMap = new Map(targetVersion.scenes.map((s) => [s.sceneCode, s]));

  // Detect removed scenes
  for (const [code, bScene] of baseScenesMap.entries()) {
    if (!targetScenesMap.has(code)) {
      diffs.push({
        type: "SCENE_REMOVED",
        sceneCode: code,
        heading: bScene.heading,
        details: `Adegan '${code}' (${bScene.heading}) dihapus pada versi target.`,
      });
      modifiedSceneCodes.add(code);
      if (bScene.linkedSceneId) modifiedSceneLinkedIds.add(bScene.linkedSceneId);
    }
  }

  // Detect added or modified scenes
  for (const [code, tScene] of targetScenesMap.entries()) {
    const bScene = baseScenesMap.get(code);
    if (!bScene) {
      diffs.push({
        type: "SCENE_ADDED",
        sceneCode: code,
        heading: tScene.heading,
        details: `Adegan baru '${code}' (${tScene.heading}) ditambahkan.`,
      });
      modifiedSceneCodes.add(code);
      if (tScene.linkedSceneId) modifiedSceneLinkedIds.add(tScene.linkedSceneId);
      continue;
    }

    // Check heading or metadata modification
    if (bScene.heading !== tScene.heading || bScene.location !== tScene.location || bScene.timeOfDay !== tScene.timeOfDay) {
      diffs.push({
        type: "SCENE_MODIFIED",
        sceneCode: code,
        heading: tScene.heading,
        oldContent: `${bScene.heading} [${bScene.location} - ${bScene.timeOfDay}]`,
        newContent: `${tScene.heading} [${tScene.location} - ${tScene.timeOfDay}]`,
        details: `Informasi heading atau lokasi/waktu adegan '${code}' berubah.`,
      });
      modifiedSceneCodes.add(code);
      if (tScene.linkedSceneId) modifiedSceneLinkedIds.add(tScene.linkedSceneId);
    }

    // Compare blocks within scene
    const bBlocks = bScene.blocks;
    const tBlocks = tScene.blocks;

    const maxLen = Math.max(bBlocks.length, tBlocks.length);
    for (let i = 0; i < maxLen; i++) {
      const bBlock = bBlocks[i];
      const tBlock = tBlocks[i];

      if (!bBlock && tBlock) {
        diffs.push({
          type: "BLOCK_ADDED",
          sceneCode: code,
          heading: tScene.heading,
          blockType: tBlock.blockType,
          character: tBlock.character ?? undefined,
          newContent: tBlock.content,
          details: `Blok ${tBlock.blockType} baru ditambahkan pada adegan '${code}'.`,
        });
        modifiedSceneCodes.add(code);
        if (tScene.linkedSceneId) modifiedSceneLinkedIds.add(tScene.linkedSceneId);
      } else if (bBlock && !tBlock) {
        diffs.push({
          type: "BLOCK_REMOVED",
          sceneCode: code,
          heading: tScene.heading,
          blockType: bBlock.blockType,
          character: bBlock.character ?? undefined,
          oldContent: bBlock.content,
          details: `Blok ${bBlock.blockType} dihapus pada adegan '${code}'.`,
        });
        modifiedSceneCodes.add(code);
        if (bScene.linkedSceneId) modifiedSceneLinkedIds.add(bScene.linkedSceneId);
      } else if (bBlock && tBlock) {
        const contentChanged = bBlock.content.trim() !== tBlock.content.trim();
        const typeChanged = bBlock.blockType !== tBlock.blockType;
        const charChanged = (bBlock.character ?? "") !== (tBlock.character ?? "");

        if (contentChanged || typeChanged || charChanged) {
          diffs.push({
            type: "BLOCK_MODIFIED",
            sceneCode: code,
            heading: tScene.heading,
            blockType: tBlock.blockType,
            character: tBlock.character ?? undefined,
            oldContent: bBlock.content,
            newContent: tBlock.content,
            details: `Blok ${tBlock.blockType} '${tBlock.character ? tBlock.character + ": " : ""}${tBlock.content.slice(0, 40)}...' diubah.`,
          });
          modifiedSceneCodes.add(code);
          if (tScene.linkedSceneId) modifiedSceneLinkedIds.add(tScene.linkedSceneId);
        }
      }
    }
  }

  // Find affected production shots
  const affectedShots: AffectedShot[] = [];
  if (projectId && contentItemId && modifiedSceneCodes.size > 0) {
    // Fetch production scenes for this content
    const prodScenes = db
      .select()
      .from(schema.scenes)
      .where(eq(schema.scenes.contentItemId, contentItemId))
      .all();

    const affectedProdSceneIds = new Set<string>();

    for (const pScene of prodScenes) {
      if (
        modifiedSceneCodes.has(pScene.code) ||
        modifiedSceneCodes.has(`SC${String(pScene.sceneNumber).padStart(3, "0")}`) ||
        modifiedSceneCodes.has(String(pScene.sceneNumber)) ||
        modifiedSceneLinkedIds.has(pScene.id)
      ) {
        affectedProdSceneIds.add(pScene.id);
      }
    }

    // Fetch shots under affected scenes or matching content
    if (affectedProdSceneIds.size > 0) {
      const allShots = db
        .select()
        .from(schema.shots)
        .where(eq(schema.shots.contentItemId, contentItemId))
        .orderBy(schema.shots.shotNumber)
        .all();

      for (const shot of allShots) {
        if (shot.sceneId && affectedProdSceneIds.has(shot.sceneId)) {
          const matchedScene = prodScenes.find((s) => s.id === shot.sceneId);
          affectedShots.push({
            shotId: shot.id,
            shotCode: shot.shotCode,
            shotNumber: shot.shotNumber,
            title: shot.title,
            sceneId: shot.sceneId,
            sceneCode: matchedScene?.code,
            impactLevel: "HIGH",
            reason: `Adegan terkait (${matchedScene?.code ?? "Scene"}) mengalami perubahan dialog atau aksi pada skrip ${targetVersion.versionLabel}.`,
            suggestedAction: "Tinjau ulang continuity visual, prompt storyboard, dan take audio untuk shot ini.",
          });
        }
      }
    }
  }

  const hasModifications = diffs.length > 0;
  const hasSH016 = affectedShots.some((s) => s.shotCode === "SH016");
  const shotPreview = affectedShots.map((s) => s.shotCode).slice(0, 5).join(", ");
  const warningMessage =
    affectedShots.length > 0
      ? `Perubahan pada skrip ${targetVersion.versionLabel} mempengaruhi ${affectedShots.length} shot produksi (${shotPreview}${affectedShots.length > 5 ? "..." : ""}${hasSH016 ? "; termasuk SH016" : ""}). Harap tinjau ulang aset dan status shot tersebut.`
      : undefined;

  return {
    baseVersion: {
      id: baseVersion.id,
      label: baseVersion.versionLabel,
      isLocked: baseVersion.isLocked,
    },
    targetVersion: {
      id: targetVersion.id,
      label: targetVersion.versionLabel,
      isLocked: targetVersion.isLocked,
    },
    diffs,
    hasModifications,
    affectedShots,
    warningMessage,
  };
}
