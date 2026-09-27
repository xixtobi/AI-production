import { NextResponse } from "next/server";
import { getFlowQueueItem, updateFlowQueueItemStatus } from "@/lib/flow";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; itemId: string }> }
) {
  const { itemId } = await context.params;
  const detail = getFlowQueueItem(itemId);
  if (!detail) {
    return NextResponse.json({ error: "Item Flow Queue tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ item: detail });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; itemId: string }> }
) {
  const { itemId } = await context.params;
  try {
    const body = await request.json();
    const updated = updateFlowQueueItemStatus(itemId, body.status, body.notes);
    return NextResponse.json({ item: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal memperbarui status item." },
      { status: 400 }
    );
  }
}
