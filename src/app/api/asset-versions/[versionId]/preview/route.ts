import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getVersion } from "@/lib/assets/service";
import { resolveExistingProjectFile } from "@/lib/filesystem/path-service";
import { imageExtensions, videoExtensions, audioExtensions } from "@/lib/filesystem/config";
import { sha256File } from "@/lib/filesystem/metadata-service";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ versionId: string }> }) {
  const row = getVersion((await context.params).versionId); if (!row) return new NextResponse("Versi tidak ditemukan.", { status: 404 });
  const ext = row.version.filename.slice(row.version.filename.lastIndexOf(".")).toLowerCase();
  if (![...imageExtensions, ...videoExtensions, ...audioExtensions].some((item) => item === ext)) return new NextResponse("Preview tidak didukung.", { status: 415 });
  try {
    const file = await resolveExistingProjectFile(row.project.rootPath, row.version.relativePath);
    if (file.stat.size !== row.version.sizeBytes || await sha256File(file.absolutePath) !== row.version.sha256) return new NextResponse("File berubah sejak versi ini didaftarkan. Periksa hasil pemindaian.", { status: 409 });
    const stream = Readable.toWeb(createReadStream(file.absolutePath)) as ReadableStream;
    return new NextResponse(stream, { headers: { "Content-Type": row.version.mimeType, "Content-Length": String(file.stat.size), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch { return new NextResponse("File versi tidak ditemukan.", { status: 404 }); }
}
