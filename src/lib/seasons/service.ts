import "server-only";

import { asc, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import { projects, seasons } from "@/lib/db/schema";
import { DomainError, isUniqueConstraintError } from "@/lib/projects/domain-error";
import type { SeasonInput } from "./validation";

export function listSeasons(projectId: string) {
  ensureDatabaseReady();
  return db.select().from(seasons).where(eq(seasons.projectId, projectId)).orderBy(asc(seasons.seasonNumber)).all();
}

export function createSeason(projectId: string, input: SeasonInput) {
  ensureDatabaseReady();
  if (!db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get()) throw new DomainError("Proyek tidak ditemukan.");
  const now = new Date();
  try {
    const season = { ...input, id: crypto.randomUUID(), projectId, createdAt: now, updatedAt: now };
    db.insert(seasons).values(season).run();
    return season;
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new DomainError("Kode musim sudah digunakan di proyek ini.");
    throw error;
  }
}

export function updateSeason(projectId: string, seasonId: string, input: SeasonInput) {
  ensureDatabaseReady();
  const current = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!current || current.projectId !== projectId) throw new DomainError("Musim tidak ditemukan di proyek ini.");
  try {
    db.update(seasons).set({ ...input, updatedAt: new Date() }).where(eq(seasons.id, seasonId)).run();
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new DomainError("Kode musim sudah digunakan di proyek ini.");
    throw error;
  }
}
