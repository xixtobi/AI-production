import { NextResponse } from "next/server";
import { reorderBlocks } from "@/lib/script/script-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string; sceneId: string }> }
) {
  const { sceneId } = await context.params;
  try {
    const body = await request.json();
    const orderedBlockIds = body.orderedBlockIds;
    if (!Array.isArray(orderedBlockIds)) {
      return NextResponse.json({ success: false, error: "orderedBlockIds wajib berupa array." }, { status: 400 });
    }

    reorderBlocks(sceneId, orderedBlockIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal mengubah urutan blok skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
