import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getVideoOutput } from "@/lib/flow";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveProjectPath } from "@/lib/filesystem/path-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string; outputId: string }> }
) {
  const { projectId, shotId, outputId } = await context.params;
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) return new NextResponse("Proyek tidak ditemukan.", { status: 404 });

  const output = getVideoOutput(outputId);
  if (!output || output.projectId !== projectId || output.shotId !== shotId) {
    return new NextResponse("Video output tidak ditemukan.", { status: 404 });
  }

  let absoluteFilePath: string;
  try {
    absoluteFilePath = resolveProjectPath(project.rootPath, output.filePath);
  } catch {
    return new NextResponse("Akses ke file tidak diizinkan.", { status: 403 });
  }

  if (!existsSync(absoluteFilePath)) {
    return new NextResponse("File video tidak ditemukan di disk.", { status: 404 });
  }

  const stat = statSync(absoluteFilePath);
  const fileSize = stat.size;
  const rangeHeader = request.headers.get("range");

  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const stream = Readable.toWeb(createReadStream(absoluteFilePath, { start, end })) as ReadableStream;

    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": output.mimeType || "video/mp4",
        "Cache-Control": "private, no-cache, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(absoluteFilePath)) as ReadableStream;
  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
      "Content-Type": output.mimeType || "video/mp4",
      "Cache-Control": "private, no-cache, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
