import "server-only";

import { existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { logActivity } from "@/lib/activity/activity-service";

export function archiveProject(projectId: string): schema.Project {
  ensureDatabaseReady();

  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();

  if (!project) {
    throw new DomainError(`Proyek dengan ID ${projectId} tidak ditemukan`, "PROJECT_NOT_FOUND", 404);
  }

  db.update(schema.projects)
    .set({
      isArchived: true,
      archivedAt: new Date(),
    })
    .where(eq(schema.projects.id, projectId))
    .run();

  const updated = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get()!;

  logActivity({
    projectId,
    actionType: "ARCHIVE",
    entityType: "PROJECT",
    entityId: projectId,
    title: `Proyek '${project.name}' diarsipkan`,
    description: `Proyek [${project.code}] dipindahkan ke arsip yang aman.`,
  });

  return updated;
}

export function unarchiveProject(projectId: string): schema.Project {
  ensureDatabaseReady();

  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();

  if (!project) {
    throw new DomainError(`Proyek dengan ID ${projectId} tidak ditemukan`, "PROJECT_NOT_FOUND", 404);
  }

  db.update(schema.projects)
    .set({
      isArchived: false,
      archivedAt: null,
    })
    .where(eq(schema.projects.id, projectId))
    .run();

  const updated = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get()!;

  logActivity({
    projectId,
    actionType: "UNARCHIVE",
    entityType: "PROJECT",
    entityId: projectId,
    title: `Proyek '${project.name}' dipulihkan dari arsip`,
    description: `Proyek [${project.code}] kembali aktif dalam daftar produksi.`,
  });

  return updated;
}

export function archiveContentItem(contentItemId: string): schema.ContentItem {
  ensureDatabaseReady();

  const item = db.select().from(schema.contentItems).where(eq(schema.contentItems.id, contentItemId)).get();

  if (!item) {
    throw new DomainError(`Konten dengan ID ${contentItemId} tidak ditemukan`, "CONTENT_NOT_FOUND", 404);
  }

  db.update(schema.contentItems)
    .set({
      isArchived: true,
      archivedAt: new Date(),
    })
    .where(eq(schema.contentItems.id, contentItemId))
    .run();

  const updated = db.select().from(schema.contentItems).where(eq(schema.contentItems.id, contentItemId)).get()!;

  logActivity({
    projectId: item.projectId,
    actionType: "ARCHIVE",
    entityType: "CONTENT",
    entityId: contentItemId,
    title: `Konten '${item.title}' diarsipkan`,
    description: `Konten [${item.code}] ditandai sebagai arsip.`,
  });

  return updated;
}

export function unarchiveContentItem(contentItemId: string): schema.ContentItem {
  ensureDatabaseReady();

  const item = db.select().from(schema.contentItems).where(eq(schema.contentItems.id, contentItemId)).get();

  if (!item) {
    throw new DomainError(`Konten dengan ID ${contentItemId} tidak ditemukan`, "CONTENT_NOT_FOUND", 404);
  }

  db.update(schema.contentItems)
    .set({
      isArchived: false,
      archivedAt: null,
    })
    .where(eq(schema.contentItems.id, contentItemId))
    .run();

  const updated = db.select().from(schema.contentItems).where(eq(schema.contentItems.id, contentItemId)).get()!;

  logActivity({
    projectId: item.projectId,
    actionType: "UNARCHIVE",
    entityType: "CONTENT",
    entityId: contentItemId,
    title: `Konten '${item.title}' dipulihkan dari arsip`,
    description: `Konten [${item.code}] kembali aktif.`,
  });

  return updated;
}

export function archiveAsset(assetId: string): schema.Asset {
  ensureDatabaseReady();

  const asset = db.select().from(schema.assets).where(eq(schema.assets.id, assetId)).get();

  if (!asset) {
    throw new DomainError(`Aset dengan ID ${assetId} tidak ditemukan`, "ASSET_NOT_FOUND", 404);
  }

  const project = db.select().from(schema.projects).where(eq(schema.projects.id, asset.projectId)).get();

  if (!project) {
    throw new DomainError("Proyek aset tidak ditemukan", "PROJECT_NOT_FOUND", 404);
  }

  // Move physical files of this asset to .archive/
  const versions = db.select().from(schema.assetVersions).where(eq(schema.assetVersions.assetId, assetId)).all();

  for (const v of versions) {
    const srcPath = path.join(project.rootPath, v.relativePath);
    const destPath = path.join(project.rootPath, ".archive", v.relativePath);
    if (existsSync(srcPath)) {
      mkdirSync(path.dirname(destPath), { recursive: true });
      renameSync(srcPath, destPath);
    }
  }

  db.update(schema.assets)
    .set({
      isArchived: true,
      archivedAt: new Date(),
    })
    .where(eq(schema.assets.id, assetId))
    .run();

  const updated = db.select().from(schema.assets).where(eq(schema.assets.id, assetId)).get()!;

  logActivity({
    projectId: asset.projectId,
    actionType: "ARCHIVE",
    entityType: "ASSET",
    entityId: assetId,
    title: `Aset '${asset.name}' diarsipkan`,
    description: `Aset [${asset.assetCode || asset.id}] dan berkas fisiknya dipindahkan ke .archive/.`,
  });

  return updated;
}

export function unarchiveAsset(assetId: string): schema.Asset {
  ensureDatabaseReady();

  const asset = db.select().from(schema.assets).where(eq(schema.assets.id, assetId)).get();

  if (!asset) {
    throw new DomainError(`Aset dengan ID ${assetId} tidak ditemukan`, "ASSET_NOT_FOUND", 404);
  }

  const project = db.select().from(schema.projects).where(eq(schema.projects.id, asset.projectId)).get();

  if (!project) {
    throw new DomainError("Proyek aset tidak ditemukan", "PROJECT_NOT_FOUND", 404);
  }

  // Move physical files back from .archive/
  const versions = db.select().from(schema.assetVersions).where(eq(schema.assetVersions.assetId, assetId)).all();

  for (const v of versions) {
    const archivePath = path.join(project.rootPath, ".archive", v.relativePath);
    const normalPath = path.join(project.rootPath, v.relativePath);
    if (existsSync(archivePath)) {
      mkdirSync(path.dirname(normalPath), { recursive: true });
      renameSync(archivePath, normalPath);
    }
  }

  db.update(schema.assets)
    .set({
      isArchived: false,
      archivedAt: null,
    })
    .where(eq(schema.assets.id, assetId))
    .run();

  const updated = db.select().from(schema.assets).where(eq(schema.assets.id, assetId)).get()!;

  logActivity({
    projectId: asset.projectId,
    actionType: "UNARCHIVE",
    entityType: "ASSET",
    entityId: assetId,
    title: `Aset '${asset.name}' dipulihkan dari arsip`,
    description: `Aset [${asset.assetCode || asset.id}] dan berkas fisik dikembalikan ke lokasi utama.`,
  });

  return updated;
}
