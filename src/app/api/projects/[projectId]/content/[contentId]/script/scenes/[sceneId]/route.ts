import { NextResponse } from "next/server";
import { updateScene, deleteScene } from "@/lib/script/script-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string; sceneId: string }> }
) {
  const { sceneId } = await context.params;
  try {
    const body = await request.json();
    const updated = updateScene(sceneId, body);
    return NextResponse.json({ success: true, scene: updated });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal memperbarui adegan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string; sceneId: string }> }
) {
  const { sceneId } = await context.params;
  try {
    deleteScene(sceneId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menghapus adegan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
