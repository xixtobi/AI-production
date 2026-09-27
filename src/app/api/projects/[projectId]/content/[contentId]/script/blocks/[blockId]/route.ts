import { NextResponse } from "next/server";
import { updateBlock, deleteBlock } from "@/lib/script/script-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string; blockId: string }> }
) {
  const { blockId } = await context.params;
  try {
    const body = await request.json();
    const updated = updateBlock(blockId, body);
    return NextResponse.json({ success: true, block: updated });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal memperbarui blok skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string; blockId: string }> }
) {
  const { blockId } = await context.params;
  try {
    deleteBlock(blockId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menghapus blok skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
