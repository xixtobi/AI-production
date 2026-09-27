import "server-only";

import { accessSync, constants, existsSync, statfsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { isGeminiConfigured, GEMINI_PRIMARY_MODEL } from "@/lib/gemini/config";
import { resolveProjectPath } from "@/lib/filesystem/path-service";
import { scanProject } from "@/lib/filesystem/scanner-service";

export interface SystemHealthReport {
  overallStatus: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  nodeVersion: string;
  platform: string;
  sqlite: {
    status: "passed" | "warning" | "failed";
    message: string;
    details: string[];
  };
  storage: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercentage: number;
    isLowStorage: boolean;
  };
  gemini: {
    configured: boolean;
    model: string;
    status: "READY" | "API_KEY_MISSING";
  };
  projectRoot?: {
    path: string;
    exists: boolean;
    accessible: boolean;
    writable: boolean;
  };
  errors: string[];
}

export interface ProjectHealthReport {
  projectId: string;
  projectCode: string;
  projectName: string;
  databaseStatus: "HEALTHY" | "DEGRADED";
  filesystemStatus: "ACCESSIBLE" | "NOT_FOUND" | "READ_ONLY";
  missingFiles: number;
  unlinkedFiles: number;
  changedFiles: number;
  duplicateFiles: number;
  brokenReferences: number;
  aiConfiguration: "READY" | "API_KEY_MISSING";
  lastScan: string | null;
  factualIssues: string[];
}

/**
 * Runs SQLite PRAGMA integrity_check.
 */
export function checkDatabaseIntegrity(): {
  status: "passed" | "warning" | "failed";
  message: string;
  details: string[];
  isOk: boolean;
  errors: string[];
} {
  try {
    const rawResult = (db as any).$client.pragma("integrity_check") as Array<{ integrity_check: string }>;
    const rows = rawResult.map((r) => r.integrity_check);

    if (rows.length === 1 && rows[0].toLowerCase() === "ok") {
      return {
        status: "passed",
        message: "Integritas database SQLite lulus pemeriksaan (OK).",
        details: ["OK"],
        isOk: true,
        errors: [],
      };
    }

    return {
      status: "failed",
      message: "Ditemukan masalah pada integritas database SQLite.",
      details: rows,
      isOk: false,
      errors: rows,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      message: `Gagal menjalankan integrity check: ${msg}`,
      details: [msg],
      isOk: false,
      errors: [msg],
    };
  }
}

export function getSystemHealth(projectId?: string): SystemHealthReport {
  const errors: string[] = [];

  // 1. SQLite integrity
  const sqliteCheck = checkDatabaseIntegrity();
  if (sqliteCheck.status !== "passed") {
    errors.push(sqliteCheck.message);
  }

  // 2. Storage
  let totalBytes = 0;
  let freeBytes = 0;
  let usedBytes = 0;
  let usedPercentage = 0;
  let isLowStorage = false;

  try {
    const stats = statfsSync(process.cwd());
    const bsize = stats.bsize;
    totalBytes = stats.blocks * bsize;
    freeBytes = stats.bfree * bsize;
    usedBytes = totalBytes - freeBytes;
    usedPercentage = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
    // Low storage if less than 5GB or used > 90%
    isLowStorage = freeBytes < 5 * 1024 * 1024 * 1024 || usedPercentage > 90;
    if (isLowStorage) {
      errors.push("Penyimpanan lokal hampir penuh (tersisa kurang dari 5GB / >90% terpakai).");
    }
  } catch {
    // Fallback if statfs fails
  }

  // 3. Gemini configuration
  const geminiConfigured = isGeminiConfigured();
  const geminiStatus = geminiConfigured ? "READY" : "API_KEY_MISSING";

  // 4. Project root checks
  let projectRootReport: SystemHealthReport["projectRoot"] | undefined = undefined;

  if (projectId) {
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
    if (project) {
      const root = project.rootPath;
      const exists = existsSync(root);
      let accessible = false;
      let writable = false;

      if (exists) {
        try {
          accessSync(root, constants.R_OK);
          accessible = true;
        } catch {
          accessible = false;
        }

        try {
          accessSync(root, constants.W_OK);
          writable = true;
        } catch {
          writable = false;
        }
      }

      if (!exists) {
        errors.push(`Folder proyek tidak ditemukan di: ${root}`);
      } else if (!writable) {
        errors.push(`Folder proyek tidak dapat ditulis (read-only): ${root}`);
      }

      projectRootReport = {
        path: root,
        exists,
        accessible,
        writable,
      };
    }
  }

  const overallStatus: SystemHealthReport["overallStatus"] =
    errors.length === 0 ? "HEALTHY" : sqliteCheck.status === "failed" ? "UNHEALTHY" : "DEGRADED";

  return {
    overallStatus,
    nodeVersion: process.version,
    platform: process.platform,
    sqlite: sqliteCheck,
    storage: {
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercentage,
      isLowStorage,
    },
    gemini: {
      configured: geminiConfigured,
      model: GEMINI_PRIMARY_MODEL,
      status: geminiStatus,
    },
    projectRoot: projectRootReport,
    errors,
  };
}

export async function getProjectHealth(projectId: string): Promise<ProjectHealthReport> {
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) throw new Error("Proyek tidak ditemukan.");

  const factualIssues: string[] = [];

  // Filesystem status
  const root = project.rootPath;
  const exists = existsSync(root);
  let filesystemStatus: ProjectHealthReport["filesystemStatus"] = "ACCESSIBLE";

  if (!exists) {
    filesystemStatus = "NOT_FOUND";
    factualIssues.push(`Direktori root ${root} tidak ditemukan pada disk.`);
  } else {
    try {
      accessSync(root, constants.W_OK);
    } catch {
      filesystemStatus = "READ_ONLY";
      factualIssues.push(`Direktori root ${root} berstatus hanya-baca (tidak dapat menulis berkas baru).`);
    }
  }

  // Scan project
  let missingFiles = 0;
  let unlinkedFiles = 0;
  let changedFiles = 0;
  let duplicateFiles = 0;
  let lastScan: string | null = null;

  if (exists) {
    try {
      const scan = await scanProject(projectId);
      missingFiles = scan.counts.MISSING || 0;
      unlinkedFiles = scan.counts.UNLINKED || 0;
      changedFiles = scan.counts.CHANGED || 0;
      duplicateFiles = scan.counts.DUPLICATE || 0;
      lastScan = scan.scannedAt;

      if (missingFiles > 0) {
        factualIssues.push(`Terdapat ${missingFiles} file aset terdaftar yang hilang dari disk.`);
      }
      if (unlinkedFiles > 0) {
        factualIssues.push(`Terdapat ${unlinkedFiles} file pada disk yang belum terhubung ke sistem aset.`);
      }
      if (changedFiles > 0) {
        factualIssues.push(`Terdapat ${changedFiles} file aset yang termodifikasi di luar aplikasi.`);
      }
      if (duplicateFiles > 0) {
        factualIssues.push(`Terdapat ${duplicateFiles} file dengan hash identik (duplikat).`);
      }
    } catch (err: unknown) {
      factualIssues.push(`Gagal menjalankan pemindaian berkas: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Broken references in database
  let brokenReferences = 0;

  // 1. shotAssets linking nonexistent assets
  const allShotAssets = db.select().from(schema.shotAssets).where(eq(schema.shotAssets.projectId, projectId)).all();
  const allAssets = db.select().from(schema.assets).where(eq(schema.assets.projectId, projectId)).all();
  const assetIdSet = new Set(allAssets.map((a) => a.id));

  for (const sa of allShotAssets) {
    if (!assetIdSet.has(sa.assetId)) {
      brokenReferences++;
      factualIssues.push(`Relasi aset shot rusak: Shot memiliki tautan ke aset ID ${sa.assetId} yang tidak ada.`);
    }
  }

  // 2. promptDocuments linking nonexistent shots
  const allPromptDocs = db.select().from(schema.promptDocuments).where(eq(schema.promptDocuments.projectId, projectId)).all();
  const allShots = db.select().from(schema.shots).where(eq(schema.shots.projectId, projectId)).all();
  const shotIdSet = new Set(allShots.map((s) => s.id));

  for (const pd of allPromptDocs) {
    if (pd.shotId && !shotIdSet.has(pd.shotId)) {
      brokenReferences++;
      factualIssues.push(`Prompt dokumen "${pd.name}" mereferensikan shot ID ${pd.shotId} yang tidak ditemukan.`);
    }
  }

  const aiConfigured = isGeminiConfigured();
  if (!aiConfigured) {
    factualIssues.push("Kunci API Gemini belum dikonfigurasi (fitur AI dalam mode offline).");
  }

  const databaseStatus: ProjectHealthReport["databaseStatus"] =
    brokenReferences === 0 ? "HEALTHY" : "DEGRADED";

  return {
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    databaseStatus,
    filesystemStatus,
    missingFiles,
    unlinkedFiles,
    changedFiles,
    duplicateFiles,
    brokenReferences,
    aiConfiguration: aiConfigured ? "READY" : "API_KEY_MISSING",
    lastScan,
    factualIssues,
  };
}
