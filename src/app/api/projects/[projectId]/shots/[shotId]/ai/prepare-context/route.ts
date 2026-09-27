import { NextResponse } from "next/server";
import { prepareContextPack } from "@/lib/gemini/context-builder";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string }> }
) {
  const { projectId, shotId } = await context.params;
  try {
    let taskCode = "PROMPT_GENERATION";
    try {
      const body = await request.json();
      if (body?.taskCode) taskCode = String(body.taskCode);
    } catch {
      // body optional
    }

    const res = await prepareContextPack(projectId, shotId, taskCode);
    return NextResponse.json({
      success: true,
      outputDir: res.outputDir,
      files: res.files,
      message: `Konteks berhasil disiapkan di AI_CONTEXT_PACK/ (${res.files.length} berkas).`,
    });
  } catch (error) {
    const message = error instanceof DomainError ? error.message : (error as Error)?.message || "Gagal menyiapkan berkas konteks.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
