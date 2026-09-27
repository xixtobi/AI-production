import { NextResponse } from "next/server";
import { getOrCreateStyleBible, updateStyleBible } from "@/lib/script/bible-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const styleBible = getOrCreateStyleBible(projectId);
    return NextResponse.json({ success: true, styleBible });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal mengambil Style Bible.";
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
    const styleBible = updateStyleBible(projectId, body);
    return NextResponse.json({ success: true, styleBible });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal memperbarui Style Bible.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
