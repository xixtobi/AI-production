import "server-only";
import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { getProject } from "@/lib/projects/service";
import { resolveProjectRoot, resolveProjectPath, ensureRealPathInside } from "./path-service";
import { DomainError } from "@/lib/projects/domain-error";

function template(projectType: string) {
  if (projectType === "ANIMATION_SERIES") return ["MASTER", "CHARACTERS", "ENVIRONMENTS", "PROPS", "STYLE", "REFERENCES", "AUDIO", "EXPORTS", "ARCHIVE"];
  if (projectType === "UGC_SERIES") return ["BRAND", "REFERENCES", "CONTENT", "AUDIO", "EXPORTS", "ARCHIVE"];
  return ["REFERENCES", "AUDIO", "EXPORTS", "ARCHIVE"];
}

export async function ensureProjectFolders(projectId: string) {
  const project = getProject(projectId);
  if (!project) throw new DomainError("Proyek tidak ditemukan.");
  const root = resolveProjectRoot(project.rootPath);
  await mkdir(root, { recursive: true });
  const realRoot = await realpath(root);
  const folders = template(project.projectType);
  const contents = (await import("@/lib/content/service")).listContent(projectId);
  for (const { item: content } of contents) {
    const base = project.projectType === "UGC_SERIES" ? `CONTENT/${content.code}` : content.code;
    folders.push(`${base}/SCRIPT`, `${base}/SCENES`);
    const shots = (await import("@/lib/shots/service")).listShots(projectId).filter((row) => row.shot.contentItemId === content.id);
    for (const { shot } of shots) for (const leaf of ["KEYFRAME", "REFERENCE", "PROMPT", "VIDEO", "AUDIO", "QC"]) folders.push(`${base}/${shot.shotCode}/${leaf}`);
  }
  for (const relative of folders) {
    const destination = resolveProjectPath(root, relative);
    await ensureRealPathInside(root, destination, true);
    await mkdir(destination, { recursive: true });
    const actual = await realpath(destination);
    const rel = path.relative(realRoot, actual);
    if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new DomainError("Folder terhubung ke luar project root.");
  }
  return { projectId, created: folders.length };
}
