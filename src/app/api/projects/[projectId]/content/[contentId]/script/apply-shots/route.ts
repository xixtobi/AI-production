import { NextResponse } from "next/server";
import { applyGeneratedShots } from "@/lib/script/scene-shot-generator";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string }> }
) {
  const { projectId, contentId } = await context.params;
  try {
    const body = await request.json();
    const { sceneId, shots } = body;
    if (!Array.isArray(shots)) {
      return NextResponse.json({ success: false, error: "shots array wajib disertakan." }, { status: 400 });
    }

    applyGeneratedShots({
      projectId,
      contentItemId: contentId,
      sceneId,
      shots,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menerapkan shot ke produksi.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
