import "server-only";
import { execFile } from "node:child_process";
import { getVersion } from "@/lib/assets/service";
import { resolveExistingProjectFile, resolveProjectDirectory } from "./path-service";
import { DomainError } from "@/lib/projects/domain-error";

export function explorerFolderArgs(folder: string) { return [folder]; }
export function explorerRevealArgs(file: string) { return [`/select,${file}`]; }
function launch(args: string[]) {
  return new Promise<void>((resolve, reject) => execFile("explorer.exe", args, { windowsHide: true }, (error) => error ? reject(new DomainError("Windows Explorer tidak dapat dibuka.")) : resolve()));
}
export async function openProjectFolder(projectId: string, root: string) { const folder = await resolveProjectDirectory(root); await launch(explorerFolderArgs(folder)); }
export async function revealVersion(versionId: string) {
  const row = getVersion(versionId); if (!row) throw new DomainError("Versi aset tidak ditemukan.");
  const file = await resolveExistingProjectFile(row.project.rootPath, row.version.relativePath); await launch(explorerRevealArgs(file.absolutePath));
}
export async function openVersion(versionId: string) {
  const row = getVersion(versionId); if (!row) throw new DomainError("Versi aset tidak ditemukan.");
  const file = await resolveExistingProjectFile(row.project.rootPath, row.version.relativePath); await launch([file.absolutePath]);
}
export async function openVersionFolder(versionId: string) {
  const row = getVersion(versionId); if (!row) throw new DomainError("Versi aset tidak ditemukan.");
  const file = await resolveExistingProjectFile(row.project.rootPath, row.version.relativePath); await launch([file.absolutePath.replace(/[\\/][^\\/]+$/, "")]);
}
