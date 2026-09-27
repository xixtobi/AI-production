import { NextResponse } from "next/server";
import { generateScenesFromScript } from "@/lib/script/scene-shot-generator";
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
    const { scriptVersionId, instructions } = body;
    if (!scriptVersionId) {
      return NextResponse.json({ success: false, error: "scriptVersionId wajib disertakan." }, { status: 400 });
    }

    const scenes = await generateScenesFromScript({
      projectId,
      contentItemId: contentId,
      scriptVersionId,
      instructions,
    });

    return NextResponse.json({ success: true, scenes });
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 });
    }
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal membuat proposal struktur adegan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
