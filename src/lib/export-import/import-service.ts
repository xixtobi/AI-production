import "server-only";

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { logActivity } from "@/lib/activity/activity-service";
import { rebuildAssetIndex } from "@/lib/system/maintenance-service";
import { ExportManifest } from "./export-service";

export interface ImportOptions {
  exportPath: string;
  destinationRootPath: string;
  newProjectCode?: string;
  newProjectName?: string;
  conflictResolution?: "RENAME" | "OVERWRITE" | "FAIL";
}

export interface ImportResult {
  success: boolean;
  projectId: string;
  projectCode: string;
  projectName: string;
  destinationPath: string;
  missingFiles: string[];
  importedStats: Record<string, number>;
  message: string;
}

function computeFileHash(filePath: string): string {
  try {
    const buffer = readFileSync(filePath);
    return createHash("sha256").update(buffer).digest("hex");
  } catch {
    return "";
  }
}

function copyDirRecursive(src: string, dest: string): number {
  mkdirSync(dest, { recursive: true });
  let count = 0;
  if (!existsSync(src)) return count;

  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      mkdirSync(path.dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

export async function importProject(options: ImportOptions): Promise<ImportResult> {
  ensureDatabaseReady();

  // 1. Validate exportPath
  if (!existsSync(options.exportPath)) {
    throw new DomainError(`Direktori ekspor tidak ditemukan: ${options.exportPath}`, "EXPORT_NOT_FOUND", 404);
  }

  const manifestPath = path.join(options.exportPath, "manifest.json");
  const dbExportPath = path.join(options.exportPath, "database-export.json");

  if (!existsSync(manifestPath) || !existsSync(dbExportPath)) {
    throw new DomainError(
      `Format ekspor tidak valid. manifest.json atau database-export.json tidak ditemukan di ${options.exportPath}`,
      "INVALID_EXPORT_PACKAGE",
      400
    );
  }

  let manifest: ExportManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DomainError(`Gagal membaca manifest.json: ${msg}`, "CORRUPT_MANIFEST", 400);
  }

  // 2. Validate destination root path
  if (!path.isAbsolute(options.destinationRootPath)) {
    throw new DomainError("Destination root path harus berupa path absolut", "INVALID_PATH", 400);
  }

  // 3. Resolve project code and conflict
  let targetCode = options.newProjectCode?.trim() || manifest.projectCode;
  let targetName = options.newProjectName?.trim() || manifest.projectName;

  const existingProject = db.select().from(schema.projects).where(eq(schema.projects.code, targetCode)).get();

  if (existingProject) {
    const resolution = options.conflictResolution || "RENAME";
    if (resolution === "FAIL") {
      throw new DomainError(
        `Proyek dengan kode '${targetCode}' sudah ada di sistem. Gunakan kode baru atau opsi resolusi konflik.`,
        "PROJECT_CODE_EXISTS",
        409
      );
    } else if (resolution === "RENAME") {
      let counter = 1;
      let candidate = `${targetCode}_IMPORTED`;
      while (db.select().from(schema.projects).where(eq(schema.projects.code, candidate)).get()) {
        counter++;
        candidate = `${targetCode}_IMPORTED_${counter}`;
      }
      targetCode = candidate;
      targetName = `${targetName} (Imported)`;
    } else if (resolution === "OVERWRITE") {
      // Delete existing project and cascade
      db.delete(schema.projects).where(eq(schema.projects.id, existingProject.id)).run();
    }
  }

  // 4. Create destination directory and copy assets if present
  mkdirSync(options.destinationRootPath, { recursive: true });
  const assetsSrcDir = path.join(options.exportPath, "assets");
  if (existsSync(assetsSrcDir)) {
    copyDirRecursive(assetsSrcDir, options.destinationRootPath);
  }

  // 5. Parse database export and remap IDs
  let dbDump: any;
  try {
    dbDump = JSON.parse(readFileSync(dbExportPath, "utf8"));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DomainError(`Gagal membaca database-export.json: ${msg}`, "CORRUPT_DATABASE_EXPORT", 400);
  }

  const idMap = new Map<string, string>();
  function mapId(oldId: string | null | undefined): string | null {
    if (!oldId) return null;
    if (!idMap.has(oldId)) {
      idMap.set(oldId, randomUUID());
    }
    return idMap.get(oldId)!;
  }

  const newProjectId = randomUUID();
  idMap.set(manifest.projectId, newProjectId);
  if (dbDump.project?.id) idMap.set(dbDump.project.id, newProjectId);

  const importedStats: Record<string, number> = {};

  // Insert within transaction
  db.transaction((tx) => {
    // 1. Insert Project
    const origProj = dbDump.project || {};
    tx.insert(schema.projects)
      .values({
        id: newProjectId,
        code: targetCode,
        name: targetName,
        description: origProj.description ?? "",
        projectType: origProj.projectType || manifest.projectType || "ANIMATION",
        status: origProj.status || "NOT_STARTED",
        rootPath: options.destinationRootPath,
        defaultAspectRatio: origProj.defaultAspectRatio || "16:9",
        defaultLanguage: origProj.defaultLanguage || "Indonesian",
        isArchived: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    importedStats.projects = 1;

    // Helper to map and insert table rows
    function insertRows(table: any, rows: any[], mapper: (row: any) => any, statKey: string) {
      if (!Array.isArray(rows) || rows.length === 0) return;
      importedStats[statKey] = 0;
      for (const row of rows) {
        const mapped = mapper(row);
        // Clean dates
        for (const [k, v] of Object.entries(mapped)) {
          if (typeof v === "string" && (k.endsWith("At") || k === "created_at" || k === "updated_at")) {
            const d = new Date(v);
            if (!isNaN(d.getTime())) mapped[k] = d;
          }
        }
        try {
          tx.insert(table).values(mapped).run();
          importedStats[statKey]++;
        } catch {
          // ignore row constraint conflict
        }
      }
    }

    // 1b. Seasons
    insertRows(
      schema.seasons,
      dbDump.seasons,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
      }),
      "seasons"
    );

    // 2. Content Items
    insertRows(
      schema.contentItems,
      dbDump.contentItems,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        seasonId: mapId(r.seasonId),
      }),
      "contentItems"
    );

    // 3. Scenes
    insertRows(
      schema.scenes,
      dbDump.scenes,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        contentItemId: mapId(r.contentItemId),
      }),
      "scenes"
    );

    // 4. Assets & Asset Versions
    insertRows(
      schema.assets,
      dbDump.assets,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
      }),
      "assets"
    );

    insertRows(
      schema.assetVersions,
      dbDump.assetVersions,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        assetId: mapId(r.assetId),
      }),
      "assetVersions"
    );

    // 5. Shots
    insertRows(
      schema.shots,
      dbDump.shots,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        contentItemId: mapId(r.contentItemId),
        sceneId: mapId(r.sceneId),
        referenceAssetVersionId: mapId(r.referenceAssetVersionId),
      }),
      "shots"
    );

    // 6. Story Documents & Versions
    insertRows(
      schema.storyDocuments,
      dbDump.storyDocuments,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        contentItemId: mapId(r.contentItemId),
      }),
      "storyDocuments"
    );

    insertRows(
      schema.storyDocumentVersions,
      dbDump.storyDocumentVersions,
      (r) => ({
        ...r,
        id: mapId(r.id),
        storyDocumentId: mapId(r.storyDocumentId),
      }),
      "storyDocumentVersions"
    );

    // 7. Script Documents, Versions, Scenes, Blocks
    insertRows(
      schema.scriptDocuments,
      dbDump.scriptDocuments,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        contentItemId: mapId(r.contentItemId),
      }),
      "scriptDocuments"
    );

    insertRows(
      schema.scriptVersions,
      dbDump.scriptVersions || dbDump.scriptDocumentVersions,
      (r) => ({
        ...r,
        id: mapId(r.id),
        scriptDocumentId: mapId(r.scriptDocumentId),
      }),
      "scriptVersions"
    );

    insertRows(
      schema.scriptScenes,
      dbDump.scriptScenes,
      (r) => ({
        ...r,
        id: mapId(r.id),
        scriptVersionId: mapId(r.scriptVersionId),
        linkedSceneId: mapId(r.linkedSceneId),
      }),
      "scriptScenes"
    );

    insertRows(
      schema.scriptBlocks,
      dbDump.scriptBlocks,
      (r) => ({
        ...r,
        id: mapId(r.id),
        scriptSceneId: mapId(r.scriptSceneId),
      }),
      "scriptBlocks"
    );

    // 8. Bibles, Characters, Environments
    insertRows(
      schema.storyBibles,
      dbDump.storyBibles,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
      }),
      "storyBibles"
    );

    insertRows(
      schema.characters,
      dbDump.characters,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
      }),
      "characters"
    );

    insertRows(
      schema.environments,
      dbDump.environments,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
      }),
      "environments"
    );

    insertRows(
      schema.styleBibles,
      dbDump.styleBibles,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
      }),
      "styleBibles"
    );

    // 9. Prompt Documents & Versions
    insertRows(
      schema.promptDocuments,
      dbDump.promptDocuments,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        contentItemId: mapId(r.contentItemId),
        sceneId: mapId(r.sceneId),
        shotId: mapId(r.shotId),
      }),
      "promptDocuments"
    );

    insertRows(
      schema.promptVersions,
      dbDump.promptVersions,
      (r) => ({
        ...r,
        id: mapId(r.id),
        promptDocumentId: mapId(r.promptDocumentId),
      }),
      "promptVersions"
    );

    // 10. Flow Queue Items
    insertRows(
      schema.flowQueueItems,
      dbDump.flowQueueItems,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        contentItemId: mapId(r.contentItemId),
        sceneId: mapId(r.sceneId),
        shotId: mapId(r.shotId),
        promptVersionId: mapId(r.promptVersionId),
        startFrameAssetVersionId: mapId(r.startFrameAssetVersionId),
        endFrameAssetVersionId: mapId(r.endFrameAssetVersionId),
      }),
      "flowQueueItems"
    );

    // 11. Video Outputs
    insertRows(
      schema.videoOutputs,
      dbDump.videoOutputs,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        contentItemId: mapId(r.contentItemId),
        sceneId: mapId(r.sceneId),
        shotId: mapId(r.shotId),
      }),
      "videoOutputs"
    );

    // 12. QC Reviews & Continuity Checks
    insertRows(
      schema.qcReviews,
      dbDump.qcReviews,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        contentItemId: mapId(r.contentItemId),
        sceneId: mapId(r.sceneId),
        shotId: mapId(r.shotId),
        assetVersionId: mapId(r.assetVersionId),
        videoOutputId: mapId(r.videoOutputId),
      }),
      "qcReviews"
    );

    insertRows(
      schema.continuityChecks,
      dbDump.continuityChecks,
      (r) => ({
        ...r,
        id: mapId(r.id),
        projectId: newProjectId,
        contentItemId: mapId(r.contentItemId),
        sceneId: mapId(r.sceneId),
        shotId: mapId(r.shotId),
        sourceAssetVersionId: mapId(r.sourceAssetVersionId),
        targetAssetVersionId: mapId(r.targetAssetVersionId),
      }),
      "continuityChecks"
    );
  });

  // 6. Post-import maintenance: Rebuild asset index
  await rebuildAssetIndex(newProjectId);

  // 7. Check for missing physical files
  const missingFiles: string[] = [];
  const importedVersions = db
    .select()
    .from(schema.assetVersions)
    .where(eq(schema.assetVersions.projectId, newProjectId))
    .all();

  for (const v of importedVersions) {
    const fullPath = path.join(options.destinationRootPath, v.relativePath);
    if (!existsSync(fullPath)) {
      missingFiles.push(v.relativePath);
    }
  }

  // 8. Log activity
  logActivity({
    projectId: newProjectId,
    actionType: "PROJECT_IMPORT",
    entityType: "PROJECT",
    entityId: newProjectId,
    title: `Proyek '${targetName}' berhasil diimpor`,
    description: `Diimpor ke ${options.destinationRootPath}. ${missingFiles.length} berkas fisik tidak ditemukan.`,
    metadata: {
      sourceExportPath: options.exportPath,
      projectCode: targetCode,
      missingFilesCount: missingFiles.length,
      importedStats,
    },
  });

  return {
    success: true,
    projectId: newProjectId,
    projectCode: targetCode,
    projectName: targetName,
    destinationPath: options.destinationRootPath,
    missingFiles,
    importedStats,
    message: `Proyek '${targetName}' (${targetCode}) berhasil diimpor ke ${options.destinationRootPath}.${
      missingFiles.length > 0 ? ` Catatan: ${missingFiles.length} berkas aset fisik tidak ditemukan.` : ""
    }`,
  };
}
