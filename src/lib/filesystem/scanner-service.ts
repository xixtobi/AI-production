import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import { assetVersions, projects, scannerIgnores } from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { resolveProjectRoot, ensureRealPathInside } from "./path-service";
import { ignoredDirectoryNames, supportedExtensions } from "./config";
import { readFileMetadata } from "./metadata-service";

export type ScanFile = { relativePath: string; filename: string; status: "REGISTERED" | "UNLINKED" | "CHANGED" | "DUPLICATE" | "MISSING"; versionId?: string; sha256?: string; duplicatePaths?: string[] };

export async function scanProject(projectId: string) {
  ensureDatabaseReady();
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");
  const root = resolveProjectRoot(project.rootPath);
  const current = db.select().from(assetVersions).where(and(eq(assetVersions.projectId, projectId), eq(assetVersions.isCurrent, true))).all();
  const byPath = new Map(current.map((item) => [item.relativePath.toLowerCase(), item]));
  const files: ScanFile[] = [];
  async function walk(dir: string) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { throw new DomainError("Folder project tidak dapat dibaca."); }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { if (!ignoredDirectoryNames.has(entry.name.toLowerCase())) await walk(path.join(dir, entry.name)); continue; }
      if (!entry.isFile() || !supportedExtensions.has(path.extname(entry.name).toLowerCase())) continue;
      const absolute = path.join(dir, entry.name);
      await ensureRealPathInside(root, absolute);
      const relativePath = path.relative(root, absolute).split(path.sep).join("/");
      const metadata = await readFileMetadata(absolute);
      const registered = byPath.get(relativePath.toLowerCase());
      files.push({ relativePath, filename: entry.name, sha256: metadata.sha256, ...(registered ? registered.sha256 === metadata.sha256 ? { status: "REGISTERED" as const, versionId: registered.id } : { status: "CHANGED" as const, versionId: registered.id } : { status: "UNLINKED" as const }) });
    }
  }
  await walk(root);
  const found = new Set(files.map((file) => file.relativePath.toLowerCase()));
  for (const version of current) if (!found.has(version.relativePath.toLowerCase())) files.push({ relativePath: version.relativePath, filename: version.filename, status: "MISSING", versionId: version.id, sha256: version.sha256 });
  const hashes = new Map<string, string[]>();
  for (const file of files.filter((item) => item.sha256 && item.status !== "MISSING")) hashes.set(file.sha256!, [...(hashes.get(file.sha256!) ?? []), file.relativePath]);
  for (const file of files) if (file.sha256 && (hashes.get(file.sha256)?.length ?? 0) > 1 && file.status !== "CHANGED") { file.status = "DUPLICATE"; file.duplicatePaths = hashes.get(file.sha256); }
  const ignores = db.select().from(scannerIgnores).where(eq(scannerIgnores.projectId, projectId)).all();
  const visible = files.filter((file) => !ignores.some((ignore) => ignore.relativePath.toLowerCase() === file.relativePath.toLowerCase() && ignore.category === file.status && (ignore.category !== "CHANGED" || ignore.ignoredSha256 === file.sha256)));
  const counts = Object.fromEntries(["REGISTERED", "UNLINKED", "MISSING", "CHANGED", "DUPLICATE"].map((status) => [status, visible.filter((file) => file.status === status).length]));
  return { files: visible, counts, scannedAt: new Date().toISOString() };
}

export function ignoreScanResult(projectId: string, relativePath: string, category: "MISSING" | "CHANGED" | "DUPLICATE", ignoredSha256: string | null) {
  ensureDatabaseReady();
  const normalized = relativePath.replace(/\\/g, "/");
  const row = { id: crypto.randomUUID(), projectId, relativePath: normalized, category, ignoredSha256, createdAt: new Date() };
  db.insert(scannerIgnores).values(row).onConflictDoUpdate({ target: [scannerIgnores.projectId, scannerIgnores.relativePath, scannerIgnores.category], set: { ignoredSha256, createdAt: row.createdAt } }).run();
}
