import { NextResponse } from "next/server";
import { analyzeContinuityWithGemini } from "@/lib/qc";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json();
    if (!body.shotId) {
      return NextResponse.json({ error: "shotId wajib disertakan." }, { status: 400 });
    }

    const result = await analyzeContinuityWithGemini({
      projectId,
      shotId: body.shotId,
      referenceShotId: body.referenceShotId,
      selectedRuleIds: body.selectedRuleIds,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal menjalankan analisis kontinuitas AI." },
      { status: 400 }
    );
  }
}
