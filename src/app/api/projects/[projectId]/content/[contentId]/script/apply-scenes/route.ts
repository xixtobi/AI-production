import { NextResponse } from "next/server";
import { applyGeneratedScenes } from "@/lib/script/scene-shot-generator";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scriptVersionId, scenes } = body;
    if (!scriptVersionId || !Array.isArray(scenes)) {
      return NextResponse.json({ success: false, error: "scriptVersionId dan scenes array wajib disertakan." }, { status: 400 });
    }

    applyGeneratedScenes({
      scriptVersionId,
      scenes,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menerapkan adegan ke skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
