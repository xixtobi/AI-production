import { NextResponse } from "next/server";
import { lockPromptVersion } from "@/lib/prompts/prompt-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; shotId: string; versionId: string }> }
) {
  const { versionId } = await context.params;
  try {
    const lockedVersion = lockPromptVersion(versionId);
    return NextResponse.json({
      success: true,
      version: lockedVersion,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal mengunci versi prompt.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
