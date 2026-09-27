import { NextResponse } from "next/server";
import { getStoryDocument, updateStoryDocument, deleteStoryDocument } from "@/lib/script/story-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; docId: string }> }
) {
  const { docId } = await context.params;

  try {
    const doc = getStoryDocument(docId);
    if (!doc) {
      return NextResponse.json({ success: false, error: "Dokumen cerita tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal mengambil detail dokumen cerita.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; docId: string }> }
) {
  const { docId } = await context.params;

  try {
    const body = await request.json();
    const doc = updateStoryDocument(docId, { title: body.title });
    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal memperbarui dokumen cerita.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string; docId: string }> }
) {
  const { docId } = await context.params;

  try {
    deleteStoryDocument(docId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menghapus dokumen cerita.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
