import { NextResponse } from "next/server";
import { generateNegativePrompt } from "@/lib/prompts/prompt-ai-service";
import { GeminiError } from "@/lib/gemini/client";
import { DomainError } from "@/lib/projects/domain-error";
import type { GeminiThinkingLevel } from "@/lib/gemini/config";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string }> }
) {
  const { projectId, shotId } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const { targetEngine, thinkingLevel } = body;

    const res = await generateNegativePrompt({
      projectId,
      shotId,
      targetEngine,
      thinkingLevel: thinkingLevel as GeminiThinkingLevel | undefined,
    });

    return NextResponse.json({
      success: true,
      requestId: res.requestId,
      result: res.result,
    });
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 400 }
      );
    }
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menghasilkan negative prompt dengan Gemini.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
