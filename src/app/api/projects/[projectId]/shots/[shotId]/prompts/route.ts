import { NextResponse } from "next/server";
import { getPromptForShot, createPromptVersion } from "@/lib/prompts/prompt-service";
import { buildShotContext } from "@/lib/gemini/context-builder";
import { DomainError } from "@/lib/projects/domain-error";
import type { PromptType, PromptSource, PromptParameters } from "@/lib/prompts/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string }> }
) {
  const { projectId, shotId } = await context.params;
  try {
    const url = new URL(request.url);
    const promptType = (url.searchParams.get("type") as PromptType) || undefined;

    const data = getPromptForShot(projectId, shotId, promptType);
    let shotContext;
    try {
      shotContext = buildShotContext(projectId, shotId);
    } catch {
      shotContext = null;
    }

    return NextResponse.json({
      success: true,
      document: data.document,
      currentVersion: data.currentVersion,
      versions: data.versions,
      context: shotContext,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    const message = (error as Error)?.message || "Gagal memuat prompt data.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string }> }
) {
  const { projectId, shotId } = await context.params;
  try {
    const body = await request.json();
    const { promptText, negativePrompt, parameters, source, notes, isLocked, forceNewVersion, promptType } = body;

    if (!promptText || typeof promptText !== "string") {
      return NextResponse.json({ success: false, error: "Teks prompt tidak boleh kosong." }, { status: 400 });
    }

    const { document } = getPromptForShot(projectId, shotId, promptType as PromptType);
    const version = createPromptVersion({
      documentId: document.id,
      promptText,
      negativePrompt,
      parameters: parameters as PromptParameters,
      source: (source as PromptSource) || "MANUAL",
      notes,
      isLocked,
      forceNewVersion,
    });

    return NextResponse.json({
      success: true,
      version,
      documentId: document.id,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menyimpan versi prompt.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
