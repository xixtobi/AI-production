import { NextResponse } from "next/server";
import { getVersionDetail } from "@/lib/script/script-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string; versionId: string }> }
) {
  const { versionId } = await context.params;
  try {
    const detail = getVersionDetail(versionId);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Versi skrip tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ success: true, version: detail });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal mengambil detail versi skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
