import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import { contentItems, scenes, shots } from "@/lib/db/schema";
import { DomainError, isUniqueConstraintError } from "@/lib/projects/domain-error";
import type { SceneInput } from "./validation";

export function listScenes(projectId: string, contentId: string) {
  ensureDatabaseReady();
  return db.select({ scene: scenes, shotCount: count(shots.id) }).from(scenes).leftJoin(shots, eq(shots.sceneId, scenes.id)).where(and(eq(scenes.projectId, projectId), eq(scenes.contentItemId, contentId))).groupBy(scenes.id).orderBy(asc(scenes.sceneNumber)).all();
}

export function listProjectScenes(projectId: string) {
  ensureDatabaseReady();
  return db.select({ scene: scenes, content: contentItems }).from(scenes).innerJoin(contentItems, eq(scenes.contentItemId, contentItems.id)).where(eq(scenes.projectId, projectId)).orderBy(asc(contentItems.contentNumber), asc(scenes.sceneNumber)).all();
}

function assertContent(projectId: string, contentId: string) {
  if (!db.select({ id: contentItems.id }).from(contentItems).where(and(eq(contentItems.id, contentId), eq(contentItems.projectId, projectId))).get()) throw new DomainError("Konten tidak ditemukan di proyek ini.");
}

export function createScene(projectId: string, contentId: string, input: SceneInput) {
  ensureDatabaseReady();
  assertContent(projectId, contentId);
  const now = new Date();
  const scene = { ...input, id: crypto.randomUUID(), projectId, contentItemId: contentId, createdAt: now, updatedAt: now };
  try { db.insert(scenes).values(scene).run(); return scene; }
  catch (error) { if (isUniqueConstraintError(error)) throw new DomainError("Kode adegan sudah digunakan di konten ini."); throw error; }
}

export function updateScene(projectId: string, contentId: string, sceneId: string, input: SceneInput) {
  ensureDatabaseReady();
  const exists = db.select({ id: scenes.id }).from(scenes).where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId), eq(scenes.contentItemId, contentId))).get();
  if (!exists) throw new DomainError("Adegan tidak ditemukan di konten ini.");
  try { db.update(scenes).set({ ...input, updatedAt: new Date() }).where(eq(scenes.id, sceneId)).run(); }
  catch (error) { if (isUniqueConstraintError(error)) throw new DomainError("Kode adegan sudah digunakan di konten ini."); throw error; }
}

export function deleteScene(projectId: string, contentId: string, sceneId: string, confirmWithShots: boolean) {
  ensureDatabaseReady();
  const exists = db.select({ id: scenes.id }).from(scenes).where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId), eq(scenes.contentItemId, contentId))).get();
  if (!exists) throw new DomainError("Adegan tidak ditemukan di konten ini.");
  const relatedShots = db.select({ id: shots.id }).from(shots).where(eq(shots.sceneId, sceneId)).all();
  if (relatedShots.length > 0 && !confirmWithShots) throw new DomainError("Adegan memiliki shot. Konfirmasi penghapusan untuk melepas shot dari adegan ini.");
  db.transaction((tx) => {
    if (relatedShots.length > 0) tx.update(shots).set({ sceneId: null, updatedAt: new Date() }).where(eq(shots.sceneId, sceneId)).run();
    tx.delete(scenes).where(eq(scenes.id, sceneId)).run();
  });
}

export function suggestSceneDetails(contentId: string) {
  ensureDatabaseReady();
  const last = db.select({ sceneNumber: scenes.sceneNumber }).from(scenes).where(eq(scenes.contentItemId, contentId)).orderBy(desc(scenes.sceneNumber)).limit(1).get();
  const sceneNumber = (last?.sceneNumber ?? 0) + 1;
  return { sceneNumber, code: `SC${String(sceneNumber).padStart(2, "0")}` };
}
