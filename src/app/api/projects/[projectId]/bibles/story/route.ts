import { NextResponse } from "next/server";
import { getOrCreateStoryBible, updateStoryBible } from "@/lib/script/bible-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const storyBible = getOrCreateStoryBible(projectId);
    return NextResponse.json({ success: true, storyBible });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal mengambil Story Bible.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json();
    const storyBible = updateStoryBible(projectId, body);
    return NextResponse.json({ success: true, storyBible });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal memperbarui Story Bible.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
