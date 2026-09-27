import { NextResponse } from "next/server";
import { getOrCreateScriptDocument } from "@/lib/script/script-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string }> }
) {
  const { projectId, contentId } = await context.params;
  try {
    const detail = getOrCreateScriptDocument(projectId, contentId);
    return NextResponse.json({ success: true, script: detail });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal memuat dokumen skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
