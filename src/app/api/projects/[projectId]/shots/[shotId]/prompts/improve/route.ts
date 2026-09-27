import { NextResponse } from "next/server";
import { improvePrompt } from "@/lib/prompts/prompt-ai-service";
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
    const body = await request.json();
    const { currentPrompt, currentNegative, targetEngine, thinkingLevel, instructions } = body;

    if (!currentPrompt || typeof currentPrompt !== "string") {
      return NextResponse.json(
        { success: false, error: "Prompt saat ini tidak boleh kosong." },
        { status: 400 }
      );
    }

    const res = await improvePrompt({
      projectId,
      shotId,
      currentPrompt,
      currentNegative,
      targetEngine,
      thinkingLevel: thinkingLevel as GeminiThinkingLevel | undefined,
      instructions,
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
    const message = (error as Error)?.message || "Gagal menyempurnakan prompt dengan Gemini.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
