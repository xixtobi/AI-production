import "server-only";

import { and, asc, count, desc, eq, gt, lt, max } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import { contentItems, scenes, seasons, shots } from "@/lib/db/schema";
import { DomainError, isUniqueConstraintError } from "@/lib/projects/domain-error";
import type { ShotCreateInput, ShotUpdateInput } from "./validation";

function assertProjectContent(projectId: string, contentId: string) {
  if (!db.select({ id: contentItems.id }).from(contentItems).where(and(eq(contentItems.id, contentId), eq(contentItems.projectId, projectId))).get()) throw new DomainError("Konten tidak ditemukan di proyek ini.");
}

function assertScene(contentId: string, sceneId: string | null) {
  if (sceneId && !db.select({ id: scenes.id }).from(scenes).where(and(eq(scenes.id, sceneId), eq(scenes.contentItemId, contentId))).get()) throw new DomainError("Adegan harus berasal dari konten yang sama.");
}

export function listShots(projectId: string) {
  ensureDatabaseReady();
  return db.select({ shot: shots, content: contentItems, season: seasons, scene: scenes })
    .from(shots).innerJoin(contentItems, eq(shots.contentItemId, contentItems.id)).leftJoin(seasons, eq(contentItems.seasonId, seasons.id)).leftJoin(scenes, eq(shots.sceneId, scenes.id))
    .where(eq(shots.projectId, projectId)).orderBy(asc(shots.shotNumber), asc(shots.shotCode)).all();
}

export function suggestNextShot(projectId: string, contentId: string) {
  ensureDatabaseReady();
  assertProjectContent(projectId, contentId);
  const current = db.select({ number: max(shots.shotNumber) }).from(shots).where(eq(shots.contentItemId, contentId)).get()?.number ?? 0;
  const shotNumber = current + 1;
  return { shotNumber, shotCode: `SH${String(shotNumber).padStart(3, "0")}` };
}

export function createShot(projectId: string, input: ShotCreateInput) {
  ensureDatabaseReady();
  assertProjectContent(projectId, input.contentItemId);
  assertScene(input.contentItemId, input.sceneId);
  const now = new Date();
  const shot = { ...input, shotCode: input.shotCode.toUpperCase(), id: crypto.randomUUID(), projectId, createdAt: now, updatedAt: now };
  try { db.insert(shots).values(shot).run(); return shot; }
  catch (error) { if (isUniqueConstraintError(error)) throw new DomainError("Kode shot atau nomor shot sudah digunakan di konten ini."); throw error; }
}

export function getShotDetail(projectId: string, shotId: string) {
  ensureDatabaseReady();
  const row = db.select({ shot: shots, content: contentItems, scene: scenes }).from(shots)
    .innerJoin(contentItems, eq(shots.contentItemId, contentItems.id)).leftJoin(scenes, eq(shots.sceneId, scenes.id))
    .where(and(eq(shots.id, shotId), eq(shots.projectId, projectId))).get();
  if (!row) return undefined;
  const previous = db.select({ id: shots.id, shotCode: shots.shotCode }).from(shots).where(and(eq(shots.contentItemId, row.shot.contentItemId), lt(shots.shotNumber, row.shot.shotNumber))).orderBy(desc(shots.shotNumber)).limit(1).get();
  const next = db.select({ id: shots.id, shotCode: shots.shotCode }).from(shots).where(and(eq(shots.contentItemId, row.shot.contentItemId), gt(shots.shotNumber, row.shot.shotNumber))).orderBy(asc(shots.shotNumber)).limit(1).get();
  return { ...row, previous, next };
}

export function updateShot(projectId: string, shotId: string, input: ShotUpdateInput) {
  ensureDatabaseReady();
  const existing = db.select({ id: shots.id }).from(shots).where(and(eq(shots.id, shotId), eq(shots.projectId, projectId))).get();
  if (!existing) throw new DomainError("Shot tidak ditemukan di proyek ini.");
  db.update(shots).set({ ...input, updatedAt: new Date() }).where(eq(shots.id, shotId)).run();
}

export function getProjectProductionSummary(projectId: string) {
  ensureDatabaseReady();
  const contentCount = db.select({ count: count() }).from(contentItems).where(eq(contentItems.projectId, projectId)).get()?.count ?? 0;
  const rows = db.select({ status: shots.status, count: count() }).from(shots).where(eq(shots.projectId, projectId)).groupBy(shots.status).all();
  const totalShots = rows.reduce((total, row) => total + row.count, 0);
  return { contentCount, totalShots, statusCounts: Object.fromEntries(rows.map((row) => [row.status, row.count])) };
}
