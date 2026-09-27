import { NextResponse } from "next/server";
import { executeShotTask } from "@/lib/gemini/task-service";
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
    const taskCode = String(body.taskCode || "PROMPT_GENERATION");
    const thinkingLevel = body.thinkingLevel as GeminiThinkingLevel | undefined;

    const res = await executeShotTask({
      projectId,
      shotId,
      taskCode,
      thinkingLevel,
    });

    return NextResponse.json({
      success: true,
      request: res.request,
      result: res.result,
      draftText: res.draftText,
    });
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 400 }
      );
    }
    if (error instanceof DomainError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
    const message = (error as Error)?.message || "Gagal memproses permintaan AI.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
