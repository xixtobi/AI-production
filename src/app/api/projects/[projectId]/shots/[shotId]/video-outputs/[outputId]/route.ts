import { NextResponse } from "next/server";
import { getVideoOutput, updateVideoOutputStatus } from "@/lib/flow";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; shotId: string; outputId: string }> }
) {
  const { outputId } = await context.params;
  const output = getVideoOutput(outputId);
  if (!output) {
    return NextResponse.json({ error: "Video output tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ output });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string; outputId: string }> }
) {
  const { outputId } = await context.params;
  try {
    const body = await request.json();
    const updated = updateVideoOutputStatus(outputId, body.status, body.notes);
    return NextResponse.json({ output: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal memperbarui status video output." },
      { status: 400 }
    );
  }
}
