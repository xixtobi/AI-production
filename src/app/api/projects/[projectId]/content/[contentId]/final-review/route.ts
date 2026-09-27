import { NextResponse } from "next/server";
import { approveContentFinal, evaluateContentFinalReadiness } from "@/lib/qc";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; contentId: string }> }
) {
  const { projectId, contentId } = await context.params;
  try {
    const evaluation = evaluateContentFinalReadiness(projectId, contentId);
    return NextResponse.json({ evaluation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal mengevaluasi kesiapan final episode." },
      { status: 400 }
    );
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; contentId: string }> }
) {
  const { projectId, contentId } = await context.params;
  try {
    const content = approveContentFinal(projectId, contentId);
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal menyetujui final konten." },
      { status: 400 }
    );
  }
}
