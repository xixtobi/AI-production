import { NextResponse } from "next/server";
import { copyTextToWindowsClipboard, getVideoOutput, openFileInDefaultApp, revealFileInExplorer } from "@/lib/flow";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveProjectPath } from "@/lib/filesystem/path-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string; outputId: string }> }
) {
  const { projectId, shotId, outputId } = await context.params;
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });

  const output = getVideoOutput(outputId);
  if (!output || output.projectId !== projectId || output.shotId !== shotId) {
    return NextResponse.json({ error: "Video output tidak ditemukan." }, { status: 404 });
  }

  let absoluteFilePath: string;
  try {
    absoluteFilePath = resolveProjectPath(project.rootPath, output.filePath);
  } catch {
    return NextResponse.json({ error: "Akses ke file tidak diizinkan." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "reveal") {
      await revealFileInExplorer(absoluteFilePath);
      return NextResponse.json({ ok: true, path: absoluteFilePath });
    }

    if (action === "open") {
      await openFileInDefaultApp(absoluteFilePath);
      return NextResponse.json({ ok: true, path: absoluteFilePath });
    }

    if (action === "copy-path") {
      await copyTextToWindowsClipboard(absoluteFilePath);
      return NextResponse.json({ ok: true, path: absoluteFilePath });
    }

    return NextResponse.json({ error: `Aksi '${action}' tidak dikenal.` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Aksi file gagal." },
      { status: 400 }
    );
  }
}
