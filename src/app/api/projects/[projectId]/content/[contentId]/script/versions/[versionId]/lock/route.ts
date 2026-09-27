import { NextResponse } from "next/server";
import { lockVersion } from "@/lib/script/script-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string; versionId: string }> }
) {
  const { versionId } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const locked = lockVersion(versionId, body.notes);
    return NextResponse.json({ success: true, version: locked });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal mengunci versi skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
