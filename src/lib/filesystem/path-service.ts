import "server-only";

import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/lib/projects/domain-error";

function isAbsolutePath(value: string) {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

function assertInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new DomainError("Path berada di luar project root.");
  }
}

export function resolveProjectRoot(projectRoot: string) {
  const root = projectRoot.trim();
  if (!root || !isAbsolutePath(root)) throw new DomainError("Project root harus berupa path absolut.");
  const absolute = path.resolve(root);
  if (path.parse(absolute).root.toLowerCase() === absolute.toLowerCase()) throw new DomainError("Pilih folder proyek di dalam drive, bukan root drive.");
  return absolute;
}

export function normalizeRelativePath(relativePath: string) {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new DomainError("Path asset tidak boleh kosong.");
  if (relativePath.includes("\0")) throw new DomainError("Path asset tidak valid.");
  const portable = relativePath.trim().replace(/\\/g, "/");
  if (portable.startsWith("/") || path.posix.isAbsolute(portable) || path.win32.isAbsolute(portable)) {
    throw new DomainError("Path asset harus relatif terhadap project root.");
  }
  const segments = portable.split("/");
  if (segments.some((segment) => segment === ".." || segment.includes(":"))) throw new DomainError("Path traversal atau path Windows tidak diizinkan.");
  const normalized = path.posix.normalize(portable);
  if (!normalized || normalized === "." || normalized.startsWith("../")) throw new DomainError("Path asset tidak valid.");
  return normalized;
}

export function resolveProjectPath(projectRoot: string, relativePath: string) {
  const root = resolveProjectRoot(projectRoot);
  const relative = normalizeRelativePath(relativePath);
  const absolute = path.resolve(root, ...relative.split("/"));
  assertInside(root, absolute);
  return absolute;
}

export async function ensureRealPathInside(projectRoot: string, candidate: string, allowMissing = false) {
  const root = resolveProjectRoot(projectRoot);
  assertInside(root, candidate);
  let realRoot: string;
  try { realRoot = await realpath(root); }
  catch { throw new DomainError("Folder project tidak ditemukan."); }

  let existingPath = candidate;
  if (allowMissing) {
    while (true) {
      try { await stat(existingPath); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const parent = path.dirname(existingPath);
        if (parent === existingPath) throw new DomainError("Folder project tidak ditemukan.");
        existingPath = parent;
      }
    }
  }

  let realCandidate: string;
  try { realCandidate = await realpath(existingPath); }
  catch { throw new DomainError("File asset tidak ditemukan."); }
  assertInside(realRoot, realCandidate);
  return candidate;
}

export async function resolveExistingProjectFile(projectRoot: string, relativePath: string) {
  const absolute = resolveProjectPath(projectRoot, relativePath);
  await ensureRealPathInside(projectRoot, absolute);
  let details;
  try { details = await stat(absolute); }
  catch { throw new DomainError("File asset tidak ditemukan."); }
  if (!details.isFile()) throw new DomainError("Path asset bukan file.");
  return { absolutePath: absolute, relativePath: normalizeRelativePath(relativePath), stat: details };
}

export async function resolveProjectDirectory(projectRoot: string, relativePath = "") {
  const root = resolveProjectRoot(projectRoot);
  if (!relativePath) {
    let details;
    try { details = await stat(root); } catch { throw new DomainError("Folder project tidak ditemukan."); }
    if (!details.isDirectory()) throw new DomainError("Folder project tidak ditemukan.");
    await ensureRealPathInside(root, root);
    return root;
  }
  const absolute = resolveProjectPath(root, relativePath);
  await ensureRealPathInside(root, absolute);
  let details;
  try { details = await stat(absolute); } catch { throw new DomainError("Folder tidak ditemukan."); }
  if (!details.isDirectory()) throw new DomainError("Folder tidak ditemukan.");
  return absolute;
}

export function toRelativeProjectPath(projectRoot: string, absolutePath: string) {
  const root = resolveProjectRoot(projectRoot);
  const resolved = path.resolve(absolutePath);
  assertInside(root, resolved);
  return path.relative(root, resolved).split(path.sep).join("/");
}
