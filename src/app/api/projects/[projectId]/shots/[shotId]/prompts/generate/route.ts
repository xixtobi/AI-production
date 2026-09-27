import { NextResponse } from "next/server";
import { generatePromptFromContext } from "@/lib/prompts/prompt-ai-service";
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
    const thinkingLevel = body.thinkingLevel as GeminiThinkingLevel | undefined;
    const targetEngine = body.targetEngine as string | undefined;
    const promptType = body.promptType as string | undefined;
    const userInstructions = body.userInstructions as string | undefined;

    const res = await generatePromptFromContext({
      projectId,
      shotId,
      thinkingLevel,
      targetEngine,
      promptType,
      userInstructions,
    });

    return NextResponse.json({
      success: true,
      requestId: res.requestId,
      result: res.result,
      compiledFullPrompt: res.compiledFullPrompt,
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
    const message = (error as Error)?.message || "Gagal membuat prompt dengan Gemini.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
