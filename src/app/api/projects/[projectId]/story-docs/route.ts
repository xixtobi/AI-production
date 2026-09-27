import { NextResponse } from "next/server";
import { listStoryDocuments, createStoryDocument } from "@/lib/script/story-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const contentItemId = url.searchParams.get("contentItemId") || undefined;

  try {
    const docs = listStoryDocuments(projectId, contentItemId);
    return NextResponse.json({ success: true, documents: docs });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal mengambil dokumen cerita.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  try {
    const body = await request.json();
    const doc = createStoryDocument({
      projectId,
      contentItemId: body.contentItemId,
      docType: body.docType,
      title: body.title,
      initialContent: body.initialContent,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, document: doc }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal membuat dokumen cerita.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
