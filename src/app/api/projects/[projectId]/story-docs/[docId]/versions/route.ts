import { NextResponse } from "next/server";
import { createStoryDocumentVersion } from "@/lib/script/story-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; docId: string }> }
) {
  const { docId } = await context.params;

  try {
    const body = await request.json();
    const version = createStoryDocumentVersion(docId, {
      title: body.title,
      content: body.content ?? "",
      notes: body.notes,
    });
    return NextResponse.json({ success: true, version }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal membuat versi dokumen cerita.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
