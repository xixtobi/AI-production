import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import { assetVersions, assets, projects, shotAssets } from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { resolveExistingProjectFile, normalizeRelativePath } from "@/lib/filesystem/path-service";
import { readFileMetadata } from "@/lib/filesystem/metadata-service";

function projectRoot(projectId: string) {
  ensureDatabaseReady();
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");
  return project.rootPath;
}

export function listAssets(projectId: string) {
  ensureDatabaseReady();
  return db.select({ asset: assets, version: assetVersions }).from(assets).leftJoin(assetVersions, and(eq(assetVersions.assetId, assets.id), eq(assetVersions.isCurrent, true))).where(eq(assets.projectId, projectId)).orderBy(asc(assets.assetCode)).all();
}

export function getAsset(assetId: string) {
  ensureDatabaseReady();
  return db.select().from(assets).where(eq(assets.id, assetId)).get();
}

export function getAssetVersions(assetId: string) {
  ensureDatabaseReady();
  return db.select().from(assetVersions).where(eq(assetVersions.assetId, assetId)).orderBy(desc(assetVersions.versionNumber)).all();
}

export async function registerAsset(input: { projectId: string; assetCode: string; assetType: typeof import("@/lib/db/schema").assetTypes[number]; name: string; description?: string; relativePath: string; notes?: string }) {
  const root = projectRoot(input.projectId);
  const relativePath = normalizeRelativePath(input.relativePath);
  const file = await resolveExistingProjectFile(root, relativePath);
  const metadata = await readFileMetadata(file.absolutePath, file.stat.size);
  const now = new Date();
  const asset = { id: crypto.randomUUID(), projectId: input.projectId, assetCode: input.assetCode.trim().toUpperCase(), assetType: input.assetType, name: input.name.trim(), description: input.description ?? "", status: "NOT_STARTED" as const, isShared: false, createdAt: now, updatedAt: now };
  const version = { id: crypto.randomUUID(), projectId: input.projectId, assetId: asset.id, versionNumber: 1, versionLabel: "v1", filename: metadata.filename, relativePath, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, width: metadata.width, height: metadata.height, durationSeconds: null, sha256: metadata.sha256, isCurrent: true, isLocked: false, createdAt: now, notes: input.notes ?? "" };
  try { db.transaction((tx) => { tx.insert(assets).values(asset).run(); tx.insert(assetVersions).values(version).run(); }); }
  catch (error) { if ((error as Error).message.includes("UNIQUE")) throw new DomainError("Kode aset atau path aktif sudah terdaftar."); throw error; }
  return { asset, version };
}

export async function registerAssetVersion(assetId: string, relativePathInput: string, notes = "") {
  ensureDatabaseReady();
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
  if (!asset) throw new DomainError("Aset tidak ditemukan.");
  const file = await resolveExistingProjectFile(projectRoot(asset.projectId), relativePathInput);
  const metadata = await readFileMetadata(file.absolutePath, file.stat.size);
  const existing = getAssetVersions(assetId);
  const now = new Date();
  const version = { id: crypto.randomUUID(), projectId: asset.projectId, assetId, versionNumber: Math.max(0, ...existing.map((item) => item.versionNumber)) + 1, versionLabel: `v${existing.length + 1}`, filename: metadata.filename, relativePath: file.relativePath, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, width: metadata.width, height: metadata.height, durationSeconds: null, sha256: metadata.sha256, isCurrent: true, isLocked: false, createdAt: now, notes };
  try { db.transaction((tx) => { tx.update(assetVersions).set({ isCurrent: false }).where(and(eq(assetVersions.assetId, assetId), eq(assetVersions.isCurrent, true))).run(); tx.insert(assetVersions).values(version).run(); }); }
  catch (error) { if ((error as Error).message.includes("UNIQUE")) throw new DomainError("Path sedang terdaftar sebagai versi aktif aset lain."); throw error; }
  return version;
}

export function getVersion(versionId: string) {
  ensureDatabaseReady();
  return db.select({ version: assetVersions, asset: assets, project: projects }).from(assetVersions).innerJoin(assets, eq(assetVersions.assetId, assets.id)).innerJoin(projects, eq(assets.projectId, projects.id)).where(eq(assetVersions.id, versionId)).get();
}

export function listShotAssets(shotId: string) {
  ensureDatabaseReady();
  return db.select({ link: shotAssets, asset: assets, version: assetVersions }).from(shotAssets).innerJoin(assets, eq(shotAssets.assetId, assets.id)).leftJoin(assetVersions, and(eq(assetVersions.assetId, assets.id), eq(assetVersions.isCurrent, true))).where(eq(shotAssets.shotId, shotId)).all();
}

export function linkAssetToShot(projectId: string, shotId: string, assetId: string, role: typeof import("@/lib/db/schema").shotAssetRoles[number]) {
  ensureDatabaseReady();
  const now = new Date();
  try { db.insert(shotAssets).values({ id: crypto.randomUUID(), projectId, shotId, assetId, role, sortOrder: 0, notes: "" }).run(); }
  catch { throw new DomainError("Shot dan aset harus berasal dari proyek yang sama, dan tautan tidak boleh duplikat."); }
  return now;
}
