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
import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { logActivity } from "@/lib/activity/activity-service";
import { APP_VERSION } from "@/lib/system/settings-service";

export interface ExportManifest {
  exportVersion: string;
  exportType: "WITH_ASSETS" | "METADATA_ONLY";
  projectId: string;
  projectCode: string;
  projectName: string;
  projectType: string;
  description: string | null;
  exportedAt: string;
  appVersion: string;
  author: string;
  totalFiles: number;
  totalSizeBytes: number;
  checksums: Record<string, string>;
  tables: Record<string, number>;
}

export interface ExportResult {
  success: boolean;
  exportPath: string;
  manifest: ExportManifest;
  totalFiles: number;
  totalSizeBytes: number;
}

function computeFileHash(filePath: string): string {
  try {
    const buffer = readFileSync(filePath);
    return createHash("sha256").update(buffer).digest("hex");
  } catch {
    return "";
  }
}

function copyDirRecursive(
  src: string,
  dest: string,
  ignoredDirs: Set<string>,
  checksums: Record<string, string>,
  baseDest: string
): { copiedFiles: number; totalBytes: number } {
  mkdirSync(dest, { recursive: true });
  let copiedFiles = 0;
  let totalBytes = 0;

  if (!existsSync(src)) return { copiedFiles, totalBytes };

  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      const res = copyDirRecursive(srcPath, destPath, ignoredDirs, checksums, baseDest);
      copiedFiles += res.copiedFiles;
      totalBytes += res.totalBytes;
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
      const st = statSync(destPath);
      copiedFiles++;
      totalBytes += st.size;
      const relPath = path.relative(baseDest, destPath).replace(/\\/g, "/");
      checksums[relPath] = computeFileHash(destPath);
    }
  }

  return { copiedFiles, totalBytes };
}

export function exportProject(params: {
  projectId: string;
  targetDirectory?: string;
  includeAssets?: boolean;
  author?: string;
}): ExportResult {
  ensureDatabaseReady();

  const project = db.select().from(schema.projects).where(eq(schema.projects.id, params.projectId)).get();

  if (!project) {
    throw new DomainError(`Proyek dengan ID ${params.projectId} tidak ditemukan`, "PROJECT_NOT_FOUND", 404);
  }

  const exportType = params.includeAssets ? "WITH_ASSETS" : "METADATA_ONLY";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const folderName = `EXPORT_${project.code}_${timestamp}`;
  const targetBaseDir = params.targetDirectory || path.join(project.rootPath, "exports");
  const exportDir = path.join(targetBaseDir, folderName);

  mkdirSync(exportDir, { recursive: true });

  const checksums: Record<string, string> = {};
  const tableCounts: Record<string, number> = {};

  // 1. Gather all database records for this project
  const seasons = db.select().from(schema.seasons).where(eq(schema.seasons.projectId, project.id)).all();
  const contentItems = db.select().from(schema.contentItems).where(eq(schema.contentItems.projectId, project.id)).all();
  const scenes = db.select().from(schema.scenes).where(eq(schema.scenes.projectId, project.id)).all();
  const shots = db.select().from(schema.shots).where(eq(schema.shots.projectId, project.id)).all();
  const assets = db.select().from(schema.assets).where(eq(schema.assets.projectId, project.id)).all();
  const assetVersions = db.select().from(schema.assetVersions).where(eq(schema.assetVersions.projectId, project.id)).all();
  const storyDocuments = db.select().from(schema.storyDocuments).where(eq(schema.storyDocuments.projectId, project.id)).all();
  const storyDocVersions = db.select().from(schema.storyDocumentVersions).all();
  const relevantStoryDocIds = new Set(storyDocuments.map((s) => s.id));
  const filteredStoryDocVersions = storyDocVersions.filter((v) => relevantStoryDocIds.has(v.storyDocumentId));

  const scriptDocuments = db.select().from(schema.scriptDocuments).where(eq(schema.scriptDocuments.projectId, project.id)).all();
  const relevantScriptDocIds = new Set(scriptDocuments.map((s) => s.id));
  const scriptVersions = db.select().from(schema.scriptVersions).all();
  const filteredScriptVersions = scriptVersions.filter((v) => relevantScriptDocIds.has(v.scriptDocumentId));
  const relevantScriptVersionIds = new Set(filteredScriptVersions.map((v) => v.id));

  const allScriptScenes = db.select().from(schema.scriptScenes).all();
  const scriptScenes = allScriptScenes.filter((s) => relevantScriptVersionIds.has(s.scriptVersionId));
  const relevantScriptSceneIds = new Set(scriptScenes.map((s) => s.id));

  const allScriptBlocks = db.select().from(schema.scriptBlocks).all();
  const scriptBlocks = allScriptBlocks.filter((b) => relevantScriptSceneIds.has(b.scriptSceneId));

  const storyBibles = db.select().from(schema.storyBibles).where(eq(schema.storyBibles.projectId, project.id)).all();
  const characters = db.select().from(schema.characters).where(eq(schema.characters.projectId, project.id)).all();
  const environments = db.select().from(schema.environments).where(eq(schema.environments.projectId, project.id)).all();
  const styleBibles = db.select().from(schema.styleBibles).where(eq(schema.styleBibles.projectId, project.id)).all();
  const promptDocuments = db.select().from(schema.promptDocuments).where(eq(schema.promptDocuments.projectId, project.id)).all();
  const relevantPromptDocIds = new Set(promptDocuments.map((p) => p.id));
  const promptVersions = db.select().from(schema.promptVersions).all();
  const filteredPromptVersions = promptVersions.filter((v) => relevantPromptDocIds.has(v.promptDocumentId));

  const flowQueueItems = db.select().from(schema.flowQueueItems).where(eq(schema.flowQueueItems.projectId, project.id)).all();
  const videoOutputs = db.select().from(schema.videoOutputs).where(eq(schema.videoOutputs.projectId, project.id)).all();
  const qcReviews = db.select().from(schema.qcReviews).where(eq(schema.qcReviews.projectId, project.id)).all();
  const continuityChecks = db.select().from(schema.continuityChecks).where(eq(schema.continuityChecks.projectId, project.id)).all();

  const databaseExport = {
    project,
    seasons,
    contentItems,
    scenes,
    shots,
    assets,
    assetVersions,
    storyDocuments,
    storyDocumentVersions: filteredStoryDocVersions,
    scriptDocuments,
    scriptVersions: filteredScriptVersions,
    scriptScenes,
    scriptBlocks,
    storyBibles,
    characters,
    environments,
    styleBibles,
    promptDocuments,
    promptVersions: filteredPromptVersions,
    flowQueueItems,
    videoOutputs,
    qcReviews,
    continuityChecks,
  };

  for (const [k, v] of Object.entries(databaseExport)) {
    tableCounts[k] = Array.isArray(v) ? v.length : 1;
  }

  // 2. Write project.json
  const projectJsonPath = path.join(exportDir, "project.json");
  writeFileSync(projectJsonPath, JSON.stringify(project, null, 2), "utf8");
  checksums["project.json"] = computeFileHash(projectJsonPath);

  // 3. Write database-export.json
  const dbExportPath = path.join(exportDir, "database-export.json");
  writeFileSync(dbExportPath, JSON.stringify(databaseExport, null, 2), "utf8");
  checksums["database-export.json"] = computeFileHash(dbExportPath);

  // 4. Write human readable documents
  const storyDir = path.join(exportDir, "story");
  mkdirSync(storyDir, { recursive: true });
  for (const doc of storyDocuments) {
    const docFile = path.join(storyDir, `${doc.docType}_${doc.id.slice(0, 8)}.json`);
    const docVersions = filteredStoryDocVersions.filter((v) => v.storyDocumentId === doc.id);
    writeFileSync(docFile, JSON.stringify({ document: doc, versions: docVersions }, null, 2), "utf8");
    checksums[path.relative(exportDir, docFile).replace(/\\/g, "/")] = computeFileHash(docFile);
  }

  const scriptsDir = path.join(exportDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  for (const doc of scriptDocuments) {
    const docFile = path.join(scriptsDir, `SCRIPT_${doc.id.slice(0, 8)}.json`);
    const docVersions = filteredScriptVersions.filter((v) => v.scriptDocumentId === doc.id);
    const docVersionIds = new Set(docVersions.map((v) => v.id));
    const docScenes = scriptScenes.filter((s) => docVersionIds.has(s.scriptVersionId));
    const docSceneIds = new Set(docScenes.map((s) => s.id));
    const docBlocks = scriptBlocks.filter((b) => docSceneIds.has(b.scriptSceneId));
    writeFileSync(docFile, JSON.stringify({ document: doc, versions: docVersions, scenes: docScenes, blocks: docBlocks }, null, 2), "utf8");
    checksums[path.relative(exportDir, docFile).replace(/\\/g, "/")] = computeFileHash(docFile);
  }

  const promptsDir = path.join(exportDir, "prompts");
  mkdirSync(promptsDir, { recursive: true });
  for (const p of promptDocuments) {
    const pFile = path.join(promptsDir, `${p.promptType}_${p.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    const pVers = filteredPromptVersions.filter((v) => v.promptDocumentId === p.id);
    writeFileSync(pFile, JSON.stringify({ prompt: p, versions: pVers }, null, 2), "utf8");
    checksums[path.relative(exportDir, pFile).replace(/\\/g, "/")] = computeFileHash(pFile);
  }

  let totalFiles = 2 + storyDocuments.length + scriptDocuments.length + promptDocuments.length;
  let totalSizeBytes =
    statSync(projectJsonPath).size +
    statSync(dbExportPath).size;

  // 5. Copy assets if requested
  if (params.includeAssets && existsSync(project.rootPath)) {
    const exportAssetsDir = path.join(exportDir, "assets");
    const ignored = new Set([".git", "node_modules", ".archive", "backups", "exports"]);
    const res = copyDirRecursive(project.rootPath, exportAssetsDir, ignored, checksums, exportDir);
    totalFiles += res.copiedFiles;
    totalSizeBytes += res.totalBytes;
  }

  // 6. Write manifest.json
  const manifest: ExportManifest = {
    exportVersion: "1.0.0",
    exportType,
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    projectType: project.projectType,
    description: project.description,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    author: params.author || "System User",
    totalFiles,
    totalSizeBytes,
    checksums,
    tables: tableCounts,
  };

  const manifestPath = path.join(exportDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  totalFiles++;
  totalSizeBytes += statSync(manifestPath).size;

  logActivity({
    projectId: project.id,
    actionType: "PROJECT_EXPORT",
    entityType: "PROJECT",
    entityId: project.id,
    title: `Proyek diekspor (${exportType})`,
    description: `Ekspor disimpan ke ${exportDir} (${totalFiles} berkas)`,
    metadata: {
      exportType,
      targetDirectory: exportDir,
      totalFiles,
      totalSizeBytes,
    },
  });

  return {
    success: true,
    exportPath: exportDir,
    manifest,
    totalFiles,
    totalSizeBytes,
  };
}
