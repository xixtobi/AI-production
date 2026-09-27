import "server-only";

import { existsSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { scanProject } from "@/lib/filesystem/scanner-service";
import { logActivity } from "@/lib/activity/activity-service";

const dataDirectory = process.env.PRODUCTION_CONTROL_DATA_DIR
  ? path.resolve(process.env.PRODUCTION_CONTROL_DATA_DIR)
  : path.join(process.cwd(), ".local-production-control");

export interface RebuildIndexResult {
  success: boolean;
  projectId: string;
  totalScanned: number;
  scannedFiles: number;
  registeredCount: number;
  missingCount: number;
  unlinkedCount: number;
  changedCount: number;
  duplicateCount: number;
  durationMs: number;
  rebuiltAt: string;
}

export async function rebuildAssetIndex(projectId: string): Promise<RebuildIndexResult> {
  ensureDatabaseReady();
  const startTime = Date.now();
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) throw new Error("Proyek tidak ditemukan.");

  // Scan project using existing scanner service
  const scanResult = await scanProject(projectId);

  const durationMs = Date.now() - startTime;
  const result: RebuildIndexResult = {
    success: true,
    projectId,
    totalScanned: scanResult.files.length,
    scannedFiles: scanResult.files.length,
    registeredCount: scanResult.counts.REGISTERED || 0,
    missingCount: scanResult.counts.MISSING || 0,
    unlinkedCount: scanResult.counts.UNLINKED || 0,
    changedCount: scanResult.counts.CHANGED || 0,
    duplicateCount: scanResult.counts.DUPLICATE || 0,
    durationMs,
    rebuiltAt: new Date().toISOString(),
  };

  logActivity({
    projectId,
    actionType: "INDEX_REBUILD",
    entityType: "PROJECT",
    entityId: projectId,
    title: `Indeks aset proyek dibangun ulang`,
    description: `Dipindai ${result.totalScanned} file (${result.registeredCount} terdaftar, ${result.unlinkedCount} unlinked, ${result.missingCount} hilang) dalam ${durationMs}ms`,
    metadata: { ...result },
  });

  return result;
}

export function clearThumbnailCache(projectId?: string): {
  success: boolean;
  clearedCount: number;
  clearedFilesCount: number;
  message: string;
} {
  let clearedCount = 0;

  // 1. Data dir thumbnail cache
  const globalThumbDir = path.join(dataDirectory, "thumbnails");
  if (existsSync(globalThumbDir)) {
    try {
      const files = readdirSync(globalThumbDir);
      for (const file of files) {
        try {
          unlinkSync(path.join(globalThumbDir, file));
          clearedCount++;
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Project-level cache if projectId provided
  if (projectId) {
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
    if (project && project.rootPath) {
      const projectCacheDir = path.join(project.rootPath, ".cache", "thumbnails");
      if (existsSync(projectCacheDir)) {
        try {
          const files = readdirSync(projectCacheDir);
          for (const file of files) {
            try {
              unlinkSync(path.join(projectCacheDir, file));
              clearedCount++;
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  logActivity({
    projectId: projectId || null,
    actionType: "SETTINGS_UPDATE",
    entityType: "SYSTEM",
    title: "Cache thumbnail dibersihkan",
    description: `Berhasil menghapus ${clearedCount} berkas cache pratinjau thumbnail`,
  });

  return {
    success: true,
    clearedCount,
    clearedFilesCount: clearedCount,
    message: `Berhasil membersihkan ${clearedCount} berkas cache thumbnail. Aset produksi tetap aman.`,
  };
}
