import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import { contentItems, projects, scenes, seasons, shots } from "@/lib/db/schema";
import { DomainError, isUniqueConstraintError } from "@/lib/projects/domain-error";
import type { ContentInput } from "./validation";

export function listContent(projectId: string) {
  ensureDatabaseReady();
  return db.select({ item: contentItems, season: seasons }).from(contentItems).leftJoin(seasons, eq(contentItems.seasonId, seasons.id)).where(eq(contentItems.projectId, projectId)).orderBy(asc(contentItems.contentNumber)).all();
}

export function getContent(projectId: string, contentId: string) {
  ensureDatabaseReady();
  return db.select({ item: contentItems, season: seasons }).from(contentItems).leftJoin(seasons, eq(contentItems.seasonId, seasons.id)).where(and(eq(contentItems.projectId, projectId), eq(contentItems.id, contentId))).get();
}

function assertProject(projectId: string) {
  if (!db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get()) throw new DomainError("Proyek tidak ditemukan.");
}

function assertSeason(projectId: string, seasonId: string | null) {
  if (seasonId && !db.select({ id: seasons.id }).from(seasons).where(and(eq(seasons.id, seasonId), eq(seasons.projectId, projectId))).get()) throw new DomainError("Musim tidak ditemukan di proyek ini.");
}

export function createContent(projectId: string, input: ContentInput) {
  ensureDatabaseReady();
  assertProject(projectId);
  assertSeason(projectId, input.seasonId);
  const now = new Date();
  const item = { ...input, id: crypto.randomUUID(), projectId, createdAt: now, updatedAt: now };
  try { db.insert(contentItems).values(item).run(); return item; }
  catch (error) { if (isUniqueConstraintError(error)) throw new DomainError("Kode konten sudah digunakan di proyek ini."); throw error; }
}

export function updateContent(projectId: string, contentId: string, input: ContentInput) {
  ensureDatabaseReady();
  if (!getContent(projectId, contentId)) throw new DomainError("Konten tidak ditemukan di proyek ini.");
  assertSeason(projectId, input.seasonId);
  try { db.update(contentItems).set({ ...input, updatedAt: new Date() }).where(and(eq(contentItems.id, contentId), eq(contentItems.projectId, projectId))).run(); }
  catch (error) { if (isUniqueConstraintError(error)) throw new DomainError("Kode konten sudah digunakan di proyek ini."); throw error; }
}

export function getContentProductionData(projectId: string, contentId: string) {
  ensureDatabaseReady();
  const content = getContent(projectId, contentId);
  if (!content) return undefined;
  const sceneRows = db.select({ scene: scenes, shotCount: count(shots.id) }).from(scenes).leftJoin(shots, eq(shots.sceneId, scenes.id)).where(and(eq(scenes.projectId, projectId), eq(scenes.contentItemId, contentId))).groupBy(scenes.id).orderBy(asc(scenes.sceneNumber)).all();
  const statusRows = db.select({ status: shots.status, count: count() }).from(shots).where(and(eq(shots.projectId, projectId), eq(shots.contentItemId, contentId))).groupBy(shots.status).all();
  const totalShots = db.select({ count: count() }).from(shots).where(eq(shots.contentItemId, contentId)).get()?.count ?? 0;
  const durationSum = db.select({ total: sql<number>`sum(${scenes.durationTarget})` }).from(scenes).where(eq(scenes.contentItemId, contentId)).get()?.total ?? 0;
  return { ...content, scenes: sceneRows, totalShots, statusCounts: Object.fromEntries(statusRows.map((row) => [row.status, row.count])), totalSceneDuration: durationSum };
}
