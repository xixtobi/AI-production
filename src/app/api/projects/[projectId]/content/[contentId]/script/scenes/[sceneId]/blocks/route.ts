import { NextResponse } from "next/server";
import { addBlock } from "@/lib/script/script-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string; sceneId: string }> }
) {
  const { sceneId } = await context.params;
  try {
    const body = await request.json();
    const block = addBlock(sceneId, {
      blockType: body.blockType || "ACTION",
      character: body.character,
      content: body.content ?? "",
      notes: body.notes,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ success: true, block }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menambahkan blok skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
