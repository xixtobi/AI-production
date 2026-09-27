import { NextResponse } from "next/server";
import { generateShotsFromScene } from "@/lib/script/scene-shot-generator";
import { GeminiError } from "@/lib/gemini/client";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string }> }
) {
  const { projectId, contentId } = await context.params;
  try {
    const body = await request.json();
    const { scriptSceneId, startingShotNumber, instructions } = body;
    if (!scriptSceneId) {
      return NextResponse.json({ success: false, error: "scriptSceneId wajib disertakan." }, { status: 400 });
    }

    const shots = await generateShotsFromScene({
      projectId,
      contentItemId: contentId,
      scriptSceneId,
      startingShotNumber,
      instructions,
    });

    return NextResponse.json({ success: true, shots });
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 });
    }
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal membuat breakdown shot.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
