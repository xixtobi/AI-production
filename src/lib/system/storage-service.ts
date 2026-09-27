import "server-only";

import { existsSync, readdirSync, statSync, statfsSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ignoredDirectoryNames } from "@/lib/filesystem/config";

export interface FolderStorageStat {
  category: "keyframes" | "images" | "videos" | "audio" | "documents" | "other";
  label: string;
  bytes: number;
  fileCount: number;
  formattedSize: string;
}

export interface ProjectStorageReport {
  projectId: string;
  projectCode: string;
  projectName: string;
  rootPath: string;
  exists: boolean;
  totalDiskBytes: number;
  freeDiskBytes: number;
  diskFreeBytes: number;
  usedDiskBytes: number;
  usedPercentage: number;
  isLowStorage: boolean;
  totalProjectBytes: number;
  totalBytes: number;
  formattedProjectSize: string;
  folders: Record<string, FolderStorageStat>;
  categories: Record<string, FolderStorageStat>;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getProjectStorageReport(projectId: string): ProjectStorageReport {
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) throw new Error("Proyek tidak ditemukan.");

  const root = project.rootPath;
  const exists = existsSync(root);

  let totalDiskBytes = 0;
  let freeDiskBytes = 0;
  let usedDiskBytes = 0;
  let usedPercentage = 0;
  let isLowStorage = false;

  if (exists) {
    try {
      const stats = statfsSync(root);
      const bsize = stats.bsize;
      totalDiskBytes = stats.blocks * bsize;
      freeDiskBytes = stats.bfree * bsize;
      usedDiskBytes = totalDiskBytes - freeDiskBytes;
      usedPercentage = totalDiskBytes > 0 ? Math.round((usedDiskBytes / totalDiskBytes) * 100) : 0;
      isLowStorage = freeDiskBytes < 5 * 1024 * 1024 * 1024 || usedPercentage > 90;
    } catch {
      // Fallback
    }
  }

  const folderStats: Record<string, FolderStorageStat> = {
    keyframes: { category: "keyframes", label: "Keyframes", bytes: 0, fileCount: 0, formattedSize: "0 B" },
    images: { category: "images", label: "Gambar & Referensi", bytes: 0, fileCount: 0, formattedSize: "0 B" },
    videos: { category: "videos", label: "Video Render & Outputs", bytes: 0, fileCount: 0, formattedSize: "0 B" },
    audio: { category: "audio", label: "Audio & Efek Suara", bytes: 0, fileCount: 0, formattedSize: "0 B" },
    documents: { category: "documents", label: "Dokumen & Naskah", bytes: 0, fileCount: 0, formattedSize: "0 B" },
    other: { category: "other", label: "Lainnya / Cache", bytes: 0, fileCount: 0, formattedSize: "0 B" },
  };

  let totalProjectBytes = 0;

  if (exists) {
    function walk(dir: string) {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (ignoredDirectoryNames.has(entry.toLowerCase())) continue;
        const fullPath = path.join(dir, entry);
        let stat;
        try {
          stat = statSync(fullPath);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (stat.isFile()) {
          const size = stat.size;
          totalProjectBytes += size;
          const ext = path.extname(entry).toLowerCase();
          const relDir = path.relative(root, dir).toLowerCase().replace(/\\/g, "/");

          if (relDir.includes("keyframe") || entry.toLowerCase().startsWith("kf-")) {
            folderStats.keyframes.bytes += size;
            folderStats.keyframes.fileCount++;
          } else if (
            [".mp4", ".mov", ".webm", ".avi", ".mkv"].includes(ext) ||
            relDir.includes("video") ||
            relDir.includes("render")
          ) {
            folderStats.videos.bytes += size;
            folderStats.videos.fileCount++;
          } else if (
            [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext) ||
            relDir.includes("image") ||
            relDir.includes("reference")
          ) {
            folderStats.images.bytes += size;
            folderStats.images.fileCount++;
          } else if (
            [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"].includes(ext) ||
            relDir.includes("audio") ||
            relDir.includes("sfx") ||
            relDir.includes("music")
          ) {
            folderStats.audio.bytes += size;
            folderStats.audio.fileCount++;
          } else if (
            [".txt", ".md", ".json", ".pdf", ".csv", ".docx"].includes(ext) ||
            relDir.includes("script") ||
            relDir.includes("prompt") ||
            relDir.includes("doc")
          ) {
            folderStats.documents.bytes += size;
            folderStats.documents.fileCount++;
          } else {
            folderStats.other.bytes += size;
            folderStats.other.fileCount++;
          }
        }
      }
    }

    walk(root);
  }

  for (const key of Object.keys(folderStats)) {
    folderStats[key].formattedSize = formatBytes(folderStats[key].bytes);
  }

  return {
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    rootPath: root,
    exists,
    totalDiskBytes,
    freeDiskBytes,
    diskFreeBytes: freeDiskBytes,
    usedDiskBytes,
    usedPercentage,
    isLowStorage,
    totalProjectBytes,
    totalBytes: totalProjectBytes,
    formattedProjectSize: formatBytes(totalProjectBytes),
    folders: folderStats,
    categories: folderStats,
  };
}
