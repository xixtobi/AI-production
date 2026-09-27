import { NextResponse } from "next/server";
import { executeScriptAiAssist } from "@/lib/script/script-ai-service";
import { GeminiError } from "@/lib/gemini/client";
import { DomainError } from "@/lib/projects/domain-error";
import type { ScriptAiAction } from "@/lib/script/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string }> }
) {
  const { projectId, contentId } = await context.params;
  try {
    const body = await request.json();
    const action = body.action as ScriptAiAction;
    const targetContent = String(body.targetContent ?? "");
    const scriptVersionId = String(body.scriptVersionId ?? "");

    if (!action || !scriptVersionId) {
      return NextResponse.json(
        { success: false, error: "action dan scriptVersionId wajib disertakan." },
        { status: 400 }
      );
    }

    const result = await executeScriptAiAssist({
      projectId,
      contentItemId: contentId,
      scriptVersionId,
      scriptSceneId: body.scriptSceneId,
      scriptBlockId: body.scriptBlockId,
      action,
      targetContent,
      instructions: body.instructions,
      characterName: body.characterName,
      environmentName: body.environmentName,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 });
    }
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal memproses bantuan AI skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
