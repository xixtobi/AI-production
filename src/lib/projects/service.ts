import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import { projects, type NewProject } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";
import { resolveProjectRoot } from "@/lib/filesystem/path-service";
import { DomainError } from "./domain-error";
import { getDefaultProjectRoot } from "./default-root";
import { logActivity } from "@/lib/activity/activity-service";
import { rebuildAssetIndex } from "@/lib/system/maintenance-service";

export function listProjects() {
  ensureDatabaseReady();
  return db.select().from(projects).orderBy(asc(projects.name)).all();
}

export function getProject(id: string) {
  ensureDatabaseReady();
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export function createProject(input: Omit<NewProject, "id" | "createdAt" | "updatedAt" | "status">) {
  ensureDatabaseReady();
  const now = new Date();
  const project: NewProject = {
    ...input,
    id: crypto.randomUUID(),
    status: "NOT_STARTED",
    createdAt: now,
    updatedAt: now,
  };
  db.insert(projects).values(project).run();
  return project;
}

export function updateProjectRootPath(id: string, rootPath: string) {
  ensureDatabaseReady();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");
  const normalized = resolveProjectRoot(rootPath);
  db.update(projects).set({ rootPath: normalized, updatedAt: new Date() }).where(eq(projects.id, id)).run();
  return { ...project, rootPath: normalized };
}

export function useDefaultProjectRootPath(id: string) {
  ensureDatabaseReady();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");
  const rootPath = resolveProjectRoot(getDefaultProjectRoot(project.code));
  db.update(projects).set({ rootPath, updatedAt: new Date() }).where(eq(projects.id, id)).run();
  return { ...project, rootPath };
}

export async function migrateProjectRoot(id: string, newRootPath: string) {
  ensureDatabaseReady();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");
  const oldRoot = project.rootPath;
  const normalized = resolveProjectRoot(newRootPath);

  db.update(projects).set({ rootPath: normalized, updatedAt: new Date() }).where(eq(projects.id, id)).run();

  await rebuildAssetIndex(id);

  const versions = db.select().from(schema.assetVersions).where(eq(schema.assetVersions.projectId, id)).all();
  const missingFiles: string[] = [];
  for (const v of versions) {
    const full = path.join(normalized, v.relativePath);
    if (!existsSync(full)) {
      missingFiles.push(v.relativePath);
    }
  }

  logActivity({
    projectId: id,
    actionType: "SETTINGS_UPDATE",
    entityType: "PROJECT",
    entityId: id,
    title: `Project Root dipindahkan ke ${normalized}`,
    description: `Lokasi berpindah dari ${oldRoot} ke ${normalized}. ${missingFiles.length} berkas tidak ditemukan di lokasi baru.`,
    metadata: {
      oldRoot,
      newRoot: normalized,
      missingFilesCount: missingFiles.length,
    },
  });

  return {
    ...project,
    rootPath: normalized,
    oldRoot,
    missingFiles,
    missingFilesCount: missingFiles.length,
  };
}
