import { NextResponse } from "next/server";
import { setCurrentPromptVersion, getPromptForShot } from "@/lib/prompts/prompt-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; shotId: string; versionId: string }> }
) {
  const { projectId, shotId, versionId } = await context.params;
  try {
    const { document } = getPromptForShot(projectId, shotId);
    const activeVersion = setCurrentPromptVersion(document.id, versionId);
    return NextResponse.json({
      success: true,
      version: activeVersion,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal mengaktifkan versi prompt.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
