import path from "node:path";
import { NextResponse } from "next/server";
import {
  copyTextToWindowsClipboard,
  getFlowQueueItem,
  openFolderInExplorer,
  revealFileInExplorer,
} from "@/lib/flow";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; itemId: string }> }
) {
  const { projectId, itemId } = await context.params;
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });

  const detail = getFlowQueueItem(itemId);
  if (!detail) return NextResponse.json({ error: "Item Flow Queue tidak ditemukan." }, { status: 404 });

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "reveal-start-frame") {
      if (!detail.startFrameVersion) {
        throw new DomainError("Tidak ada start frame yang ditautkan pada job ini.");
      }
      const fullPath = path.resolve(project.rootPath, detail.startFrameVersion.relativePath);
      await revealFileInExplorer(fullPath);
      return NextResponse.json({ ok: true, path: fullPath });
    }

    if (action === "reveal-end-frame") {
      if (!detail.endFrameVersion) {
        throw new DomainError("Tidak ada end frame yang ditautkan pada job ini.");
      }
      const fullPath = path.resolve(project.rootPath, detail.endFrameVersion.relativePath);
      await revealFileInExplorer(fullPath);
      return NextResponse.json({ ok: true, path: fullPath });
    }

    if (action === "reveal-reference") {
      const refId = body.assetVersionId as string;
      const ref = detail.references.find((r) => r.version.id === refId);
      if (!ref) throw new DomainError("Referensi aset tidak ditemukan dalam job ini.");
      const fullPath = path.resolve(project.rootPath, ref.version.relativePath);
      await revealFileInExplorer(fullPath);
      return NextResponse.json({ ok: true, path: fullPath });
    }

    if (action === "open-job-folder") {
      const folder = body.jobDirectory as string;
      if (!folder) throw new DomainError("Direktori job tidak ditentukan.");
      await openFolderInExplorer(folder);
      return NextResponse.json({ ok: true, folder });
    }

    if (action === "copy-prompt") {
      await copyTextToWindowsClipboard(detail.promptVersion.promptText);
      return NextResponse.json({ ok: true, promptText: detail.promptVersion.promptText });
    }

    if (action === "copy-recipe") {
      await copyTextToWindowsClipboard(detail.item.recipeSnapshotJson);
      return NextResponse.json({ ok: true, recipe: detail.item.recipeSnapshotJson });
    }

    if (action === "copy-path") {
      const targetPath = body.targetPath as string;
      if (!targetPath) throw new DomainError("Path tidak ditentukan.");
      await copyTextToWindowsClipboard(targetPath);
      return NextResponse.json({ ok: true, targetPath });
    }

    return NextResponse.json({ error: `Aksi '${action}' tidak dikenal.` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Aksi Windows gagal." },
      { status: 400 }
    );
  }
}
