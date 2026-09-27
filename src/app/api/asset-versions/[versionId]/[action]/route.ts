import { NextResponse } from "next/server";
import { getVersion } from "@/lib/assets/service";
import { openVersion, openVersionFolder, revealVersion } from "@/lib/filesystem/explorer-service";
import { DomainError } from "@/lib/projects/domain-error";
export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ versionId: string; action: string }> }) {
  const { versionId, action } = await context.params;
  try {
    if (action === "reveal") await revealVersion(versionId);
    else if (action === "open") await openVersion(versionId);
    else if (action === "open-folder") await openVersionFolder(versionId);
    else if (action === "copy-path") { const row = getVersion(versionId); if (!row) return NextResponse.json({ error: "Versi tidak ditemukan." }, { status: 404 }); const { spawn } = await import("node:child_process"); const child = spawn("clip.exe", [], { shell: false, windowsHide: true, stdio: ["pipe", "ignore", "ignore"] }); child.stdin.end((await import("@/lib/filesystem/path-service")).resolveProjectPath(row.project.rootPath, row.version.relativePath)); }
    else return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof DomainError ? error.message : "Aksi file gagal." }, { status: 400 }); }
}
