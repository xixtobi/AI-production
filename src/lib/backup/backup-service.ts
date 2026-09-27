import "server-only";

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { logActivity } from "@/lib/activity/activity-service";
import { getSystemSettings, APP_VERSION } from "@/lib/system/settings-service";

export interface BackupManifest {
  backupId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  backupType: schema.BackupType;
  appVersion: string;
  createdAt: string;
  totalSizeBytes: number;
  totalFiles: number;
  tables: Record<string, number>;
  checksums: Record<string, string>;
  sourceRootPath: string;
}

export interface BackupItemSummary {
  id: string;
  projectId: string;
  projectCode: string;
  backupType: schema.BackupType;
  backupPath: string;
  filename: string;
  fileSizeBytes: number;
  fileCount: number;
  createdAt: string;
  manifest: BackupManifest;
}

function computeFileHash(filePath: string): string {
  try {
    const buffer = readFileSync(filePath);
    return createHash("sha256").update(buffer).digest("hex");
  } catch {
    return "";
  }
}

function copyDirRecursive(src: string, dest: string, ignoredDirs: Set<string>): { copiedFiles: number; totalBytes: number } {
  mkdirSync(dest, { recursive: true });
  let copiedFiles = 0;
  let totalBytes = 0;

  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name.toLowerCase())) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      const sub = copyDirRecursive(srcPath, destPath, ignoredDirs);
      copiedFiles += sub.copiedFiles;
      totalBytes += sub.totalBytes;
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
      copiedFiles++;
      try {
        totalBytes += statSync(srcPath).size;
      } catch {
        // ignore
      }
    }
  }

  return { copiedFiles, totalBytes };
}

export function getProjectBackupDirectory(projectId: string, customRoot?: string): string {
  const settings = getSystemSettings();
  if (customRoot && customRoot.trim()) {
    return path.resolve(customRoot);
  }
  if (settings.backupRootPath && settings.backupRootPath.trim() && existsSync(settings.backupRootPath)) {
    return path.resolve(settings.backupRootPath);
  }

  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (project && project.rootPath) {
    return path.join(project.rootPath, "backups");
  }

  const dataDir = process.env.PRODUCTION_CONTROL_DATA_DIR
    ? path.resolve(process.env.PRODUCTION_CONTROL_DATA_DIR)
    : path.join(process.cwd(), ".local-production-control");
  return path.join(dataDir, "backups");
}

export interface CreateBackupOptions {
  projectId: string;
  backupType?: schema.BackupType;
  targetDirectory?: string;
  author?: string;
  isSafetyBackup?: boolean;
}

export function createBackup(
  paramOrProjectId: string | CreateBackupOptions,
  backupTypeArg?: schema.BackupType,
  customTargetDir?: string
): BackupItemSummary {
  ensureDatabaseReady();

  const isObject = typeof paramOrProjectId === "object";
  const projectId = isObject ? paramOrProjectId.projectId : paramOrProjectId;
  const backupType = (isObject ? paramOrProjectId.backupType : backupTypeArg) || "METADATA_BACKUP";
  const targetDir = isObject ? paramOrProjectId.targetDirectory : customTargetDir;
  const isSafety = isObject ? Boolean(paramOrProjectId.isSafetyBackup) : false;

  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");

  const backupBaseDir = getProjectBackupDirectory(projectId, targetDir);
  mkdirSync(backupBaseDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const folderName = isSafety
    ? `${project.code}_SAFETY_BACKUP_${timestamp}_${backupType}`
    : `${project.code}_BACKUP_${timestamp}_${backupType}`;
  const backupPath = path.join(backupBaseDir, folderName);

  if (existsSync(backupPath)) {
    throw new DomainError("Direktori cadangan sudah ada. Operasi dibatalkan untuk mencegah penimpaan.");
  }

  mkdirSync(backupPath, { recursive: true });

  // 1. Gather all project database rows
  const scriptDocs = db.select().from(schema.scriptDocuments).where(eq(schema.scriptDocuments.projectId, projectId)).all();
  const scriptDocIds = new Set(scriptDocs.map((s) => s.id));
  const allScriptVersions = db.select().from(schema.scriptVersions).all();
  const scriptVersions = allScriptVersions.filter((v) => scriptDocIds.has(v.scriptDocumentId));
  const scriptVersionIds = new Set(scriptVersions.map((v) => v.id));
  const allScriptScenes = db.select().from(schema.scriptScenes).all();
  const scriptScenes = allScriptScenes.filter((s) => scriptVersionIds.has(s.scriptVersionId));
  const scriptSceneIds = new Set(scriptScenes.map((s) => s.id));
  const allScriptBlocks = db.select().from(schema.scriptBlocks).all();
  const scriptBlocks = allScriptBlocks.filter((b) => scriptSceneIds.has(b.scriptSceneId));

  const projectRows = {
    project: db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).all(),
    seasons: db.select().from(schema.seasons).where(eq(schema.seasons.projectId, projectId)).all(),
    contentItems: db.select().from(schema.contentItems).where(eq(schema.contentItems.projectId, projectId)).all(),
    scenes: db.select().from(schema.scenes).where(eq(schema.scenes.projectId, projectId)).all(),
    shots: db.select().from(schema.shots).where(eq(schema.shots.projectId, projectId)).all(),
    assets: db.select().from(schema.assets).where(eq(schema.assets.projectId, projectId)).all(),
    assetVersions: db.select().from(schema.assetVersions).where(eq(schema.assetVersions.projectId, projectId)).all(),
    shotAssets: db.select().from(schema.shotAssets).where(eq(schema.shotAssets.projectId, projectId)).all(),
    storyDocuments: db.select().from(schema.storyDocuments).where(eq(schema.storyDocuments.projectId, projectId)).all(),
    storyDocumentVersions: db.select().from(schema.storyDocumentVersions).all().filter((v) => {
      // Find parent doc
      return true;
    }),
    scriptDocuments: scriptDocs,
    scriptVersions,
    scriptScenes,
    scriptBlocks,
    storyBibles: db.select().from(schema.storyBibles).where(eq(schema.storyBibles.projectId, projectId)).all(),
    characters: db.select().from(schema.characters).where(eq(schema.characters.projectId, projectId)).all(),
    environments: db.select().from(schema.environments).where(eq(schema.environments.projectId, projectId)).all(),
    styleBibles: db.select().from(schema.styleBibles).where(eq(schema.styleBibles.projectId, projectId)).all(),
    promptDocuments: db.select().from(schema.promptDocuments).where(eq(schema.promptDocuments.projectId, projectId)).all(),
    promptVersions: db.select().from(schema.promptVersions).all(),
    flowQueueItems: db.select().from(schema.flowQueueItems).where(eq(schema.flowQueueItems.projectId, projectId)).all(),
    flowQueueReferences: db.select().from(schema.flowQueueReferences).all(),
    generationAttempts: db.select().from(schema.generationAttempts).all(),
    videoOutputs: db.select().from(schema.videoOutputs).where(eq(schema.videoOutputs.projectId, projectId)).all(),
    qcReviews: db.select().from(schema.qcReviews).where(eq(schema.qcReviews.projectId, projectId)).all(),
    continuityRules: db.select().from(schema.continuityRules).all().filter((r) => r.projectId === null || r.projectId === projectId),
    continuityChecks: db.select().from(schema.continuityChecks).where(eq(schema.continuityChecks.projectId, projectId)).all(),
    qcChecklistItems: db.select().from(schema.qcChecklistItems).all().filter((i) => i.projectId === null || i.projectId === projectId),
  };

  const tableCounts: Record<string, number> = {};
  for (const [tName, rows] of Object.entries(projectRows)) {
    tableCounts[tName] = (rows as any[]).length;
  }

  // Write metadata dump and database dump
  const metadataDumpPath = path.join(backupPath, "metadata-dump.json");
  writeFileSync(metadataDumpPath, JSON.stringify(projectRows, null, 2), "utf8");

  const databaseDumpPath = path.join(backupPath, "database-dump.json");
  writeFileSync(databaseDumpPath, JSON.stringify(projectRows, null, 2), "utf8");

  // Write project.json
  const projectJsonPath = path.join(backupPath, "project.json");
  writeFileSync(projectJsonPath, JSON.stringify(project, null, 2), "utf8");

  let totalFiles = 3; // metadata-dump.json + database-dump.json + project.json
  let totalBytes = statSync(metadataDumpPath).size + statSync(databaseDumpPath).size + statSync(projectJsonPath).size;

  const checksums: Record<string, string> = {
    "metadata-dump.json": computeFileHash(metadataDumpPath),
    "database-dump.json": computeFileHash(databaseDumpPath),
    "project.json": computeFileHash(projectJsonPath),
  };

  // If FULL_PROJECT_BACKUP: copy assets, scripts, prompts, videos, audio, references
  if (backupType === "FULL_PROJECT_BACKUP" && existsSync(project.rootPath)) {
    const assetsDestDir = path.join(backupPath, "assets");
    const ignored = new Set([".git", "node_modules", ".archive", "backups", ".local-production-control", ".cache"]);
    const copyResult = copyDirRecursive(project.rootPath, assetsDestDir, ignored);
    totalFiles += copyResult.copiedFiles;
    totalBytes += copyResult.totalBytes;
  }

  // Create manifest.json
  const manifest: BackupManifest = {
    backupId: crypto.randomUUID(),
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    backupType,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    totalSizeBytes: totalBytes,
    totalFiles,
    tables: tableCounts,
    checksums,
    sourceRootPath: project.rootPath,
  };

  const manifestPath = path.join(backupPath, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  totalFiles++;
  totalBytes += statSync(manifestPath).size;

  // Insert into backups table
  db.insert(schema.backups).values({
    id: manifest.backupId,
    projectId,
    backupType,
    status: "COMPLETED",
    backupPath,
    filename: folderName,
    fileSizeBytes: totalBytes,
    fileCount: totalFiles,
    manifestJson: JSON.stringify(manifest),
    createdAt: new Date(),
  }).run();

  logActivity({
    projectId,
    actionType: "BACKUP_CREATE",
    entityType: "BACKUP",
    entityId: manifest.backupId,
    title: `Cadangan dibuat (${backupType})`,
    description: `Cadangan tersimpan di ${folderName} (${totalFiles} berkas, ${Math.round(totalBytes / 1024)} KB)`,
    metadata: { ...manifest },
  });

  return {
    id: manifest.backupId,
    projectId,
    projectCode: project.code,
    backupType,
    backupPath,
    filename: folderName,
    fileSizeBytes: totalBytes,
    fileCount: totalFiles,
    createdAt: manifest.createdAt,
    manifest,
  };
}

export function validateBackup(backupPath: string): {
  isValid: boolean;
  errors: string[];
  manifest?: BackupManifest;
} {
  const errors: string[] = [];

  if (!existsSync(backupPath)) {
    return { isValid: false, errors: ["Direktori cadangan tidak ditemukan."] };
  }

  const manifestPath = path.join(backupPath, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { isValid: false, errors: ["Berkas manifest.json tidak ditemukan dalam direktori cadangan."] };
  }

  let manifest: BackupManifest;
  try {
    const raw = readFileSync(manifestPath, "utf8");
    manifest = JSON.parse(raw);
  } catch (err: unknown) {
    return { isValid: false, errors: [`Manifest rusak atau tidak valid: ${err instanceof Error ? err.message : String(err)}`] };
  }

  if (!manifest.backupId || !manifest.projectId || !manifest.projectCode || !manifest.backupType) {
    errors.push("Struktur manifest.json tidak lengkap.");
  }

  if (manifest.checksums && typeof manifest.checksums === "object") {
    for (const [relPath, expectedHash] of Object.entries(manifest.checksums)) {
      const fullPath = path.join(backupPath, relPath);
      if (!existsSync(fullPath)) {
        errors.push(`Berkas ${relPath} tercantum pada manifest namun tidak ditemukan di direktori cadangan.`);
      } else {
        const actualHash = computeFileHash(fullPath);
        if (actualHash !== expectedHash) {
          errors.push(`Checksum tidak cocok untuk berkas ${relPath}. Kemungkinan data rusak atau dimanipulasi.`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    manifest,
  };
}

export function listBackups(projectId?: string): BackupItemSummary[] {
  ensureDatabaseReady();
  const results: BackupItemSummary[] = [];

  // Query database records first
  let query = db.select().from(schema.backups);
  if (projectId) {
    query = db.select().from(schema.backups).where(eq(schema.backups.projectId, projectId)) as any;
  }

  const records = query.all();
  for (const r of records) {
    try {
      const manifest: BackupManifest = JSON.parse(r.manifestJson);
      results.push({
        id: r.id,
        projectId: r.projectId,
        projectCode: manifest.projectCode || "PROJECT",
        backupType: r.backupType,
        backupPath: r.backupPath,
        filename: r.filename,
        fileSizeBytes: r.fileSizeBytes,
        fileCount: r.fileCount,
        createdAt: r.createdAt.toISOString(),
        manifest,
      });
    } catch {
      // ignore
    }
  }

  return results.reverse();
}

export function restoreBackup(params: {
  backupPath: string;
  projectId: string;
  confirm?: boolean;
  confirmCode?: string;
}): { success: boolean; message: string; safetyBackupId: string } {
  ensureDatabaseReady();

  const isConfirmed = params.confirm === true || Boolean(params.confirmCode && params.confirmCode.trim() !== "");
  if (!isConfirmed) {
    throw new DomainError("Pemulihan cadangan memerlukan konfirmasi eksplisit.");
  }

  const validation = validateBackup(params.backupPath);
  if (!validation.isValid || !validation.manifest) {
    throw new DomainError(`Cadangan tidak valid:\n- ${validation.errors.join("\n- ")}`);
  }

  const manifest = validation.manifest;
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, params.projectId)).get();
  if (!project) throw new DomainError("Proyek tujuan tidak ditemukan.");

  // Create automatic safety backup before restore!
  const safetyBackup = createBackup({
    projectId: params.projectId,
    backupType: "METADATA_BACKUP",
    isSafetyBackup: true,
    author: "SYSTEM (SAFETY)",
  });

  // Read metadata dump
  const metadataDumpPath = path.join(params.backupPath, "metadata-dump.json");
  const rawDump = readFileSync(metadataDumpPath, "utf8");
  const dump = JSON.parse(rawDump);

  // Restore database tables inside transaction
  db.transaction((tx) => {
    // 1. Delete dependent project tables in reverse dependency order
    tx.delete(schema.continuityChecks).where(eq(schema.continuityChecks.projectId, params.projectId)).run();
    tx.delete(schema.qcReviews).where(eq(schema.qcReviews.projectId, params.projectId)).run();
    tx.delete(schema.videoOutputs).where(eq(schema.videoOutputs.projectId, params.projectId)).run();
    tx.delete(schema.generationAttempts).run();
    tx.delete(schema.flowQueueReferences).run();
    tx.delete(schema.flowQueueItems).where(eq(schema.flowQueueItems.projectId, params.projectId)).run();
    tx.delete(schema.shotAssets).where(eq(schema.shotAssets.projectId, params.projectId)).run();
    tx.delete(schema.assetVersions).where(eq(schema.assetVersions.projectId, params.projectId)).run();
    tx.delete(schema.assets).where(eq(schema.assets.projectId, params.projectId)).run();
    tx.delete(schema.shots).where(eq(schema.shots.projectId, params.projectId)).run();
    tx.delete(schema.scenes).where(eq(schema.scenes.projectId, params.projectId)).run();
    tx.delete(schema.contentItems).where(eq(schema.contentItems.projectId, params.projectId)).run();
    tx.delete(schema.seasons).where(eq(schema.seasons.projectId, params.projectId)).run();
    const existingScriptDocs = tx.select().from(schema.scriptDocuments).where(eq(schema.scriptDocuments.projectId, params.projectId)).all();
    const existingScriptDocIds = new Set(existingScriptDocs.map((s) => s.id));
    const allSV = tx.select().from(schema.scriptVersions).all();
    const targetSV = allSV.filter((v) => existingScriptDocIds.has(v.scriptDocumentId));
    const targetSVIds = new Set(targetSV.map((v) => v.id));
    const allSS = tx.select().from(schema.scriptScenes).all();
    const targetSS = allSS.filter((s) => targetSVIds.has(s.scriptVersionId));
    const targetSSIds = new Set(targetSS.map((s) => s.id));
    const allSB = tx.select().from(schema.scriptBlocks).all();
    const targetSB = allSB.filter((b) => targetSSIds.has(b.scriptSceneId));

    for (const b of targetSB) tx.delete(schema.scriptBlocks).where(eq(schema.scriptBlocks.id, b.id)).run();
    for (const s of targetSS) tx.delete(schema.scriptScenes).where(eq(schema.scriptScenes.id, s.id)).run();
    for (const v of targetSV) tx.delete(schema.scriptVersions).where(eq(schema.scriptVersions.id, v.id)).run();
    tx.delete(schema.scriptDocuments).where(eq(schema.scriptDocuments.projectId, params.projectId)).run();
    tx.delete(schema.characters).where(eq(schema.characters.projectId, params.projectId)).run();
    tx.delete(schema.environments).where(eq(schema.environments.projectId, params.projectId)).run();
    tx.delete(schema.styleBibles).where(eq(schema.styleBibles.projectId, params.projectId)).run();
    tx.delete(schema.storyBibles).where(eq(schema.storyBibles.projectId, params.projectId)).run();
    tx.delete(schema.storyDocuments).where(eq(schema.storyDocuments.projectId, params.projectId)).run();
    tx.delete(schema.promptDocuments).where(eq(schema.promptDocuments.projectId, params.projectId)).run();

    // 2. Re-insert rows from dump for this project
    const tableMap: Record<string, any> = {
      seasons: schema.seasons,
      contentItems: schema.contentItems,
      scenes: schema.scenes,
      shots: schema.shots,
      assets: schema.assets,
      assetVersions: schema.assetVersions,
      shotAssets: schema.shotAssets,
      storyDocuments: schema.storyDocuments,
      scriptDocuments: schema.scriptDocuments,
      scriptVersions: schema.scriptVersions,
      scriptScenes: schema.scriptScenes,
      scriptBlocks: schema.scriptBlocks,
      storyBibles: schema.storyBibles,
      characters: schema.characters,
      environments: schema.environments,
      styleBibles: schema.styleBibles,
      promptDocuments: schema.promptDocuments,
      flowQueueItems: schema.flowQueueItems,
      videoOutputs: schema.videoOutputs,
      qcReviews: schema.qcReviews,
      continuityChecks: schema.continuityChecks,
    };

    for (const [key, table] of Object.entries(tableMap)) {
      if (Array.isArray(dump[key])) {
        for (const row of dump[key]) {
          // Parse dates if needed
          const cleanedRow = { ...row };
          for (const [k, v] of Object.entries(cleanedRow)) {
            if (typeof v === "string" && (k.endsWith("At") || k === "created_at" || k === "updated_at")) {
              const d = new Date(v);
              if (!isNaN(d.getTime())) cleanedRow[k] = d;
            }
          }
          try {
            tx.insert(table).values(cleanedRow).run();
          } catch {
            // Ignore single row constraint collisions on global references
          }
        }
      }
    }
  });

  // If full backup and assets folder exists, restore assets
  const backupAssetsDir = path.join(params.backupPath, "assets");
  if (existsSync(backupAssetsDir) && existsSync(project.rootPath)) {
    const ignored = new Set([".git", "node_modules", ".archive", "backups"]);
    copyDirRecursive(backupAssetsDir, project.rootPath, ignored);
  }

  logActivity({
    projectId: params.projectId,
    actionType: "BACKUP_RESTORE",
    entityType: "BACKUP",
    entityId: manifest.backupId,
    title: `Proyek dipulihkan dari cadangan`,
    description: `Dipulihkan dari ${path.basename(params.backupPath)}. Safety backup dibuat: ${safetyBackup.filename}`,
    metadata: {
      restoredFrom: params.backupPath,
      safetyBackupId: safetyBackup.id,
    },
  });

  return {
    success: true,
    message: `Proyek ${project.name} berhasil dipulihkan. Safety backup disimpan di ${safetyBackup.filename}.`,
    safetyBackupId: safetyBackup.id,
  };
}
