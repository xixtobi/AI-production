import { NextResponse } from "next/server";
import { getOrCreateScriptDocument, createNewVersion } from "@/lib/script/script-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string }> }
) {
  const { projectId, contentId } = await context.params;
  try {
    const docDetail = getOrCreateScriptDocument(projectId, contentId);
    const body = await request.json().catch(() => ({}));
    const newVersion = createNewVersion(docDetail.id, {
      cloneFromVersionId: body.cloneFromVersionId,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, version: newVersion }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal membuat versi skrip baru.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
