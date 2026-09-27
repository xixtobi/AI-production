import { NextResponse } from "next/server";
import { updateContentMilestones } from "@/lib/qc";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; contentId: string }> }
) {
  const { projectId, contentId } = await context.params;
  try {
    const body = await request.json();
    const content = updateContentMilestones({
      projectId,
      contentItemId: contentId,
      audioStatus: body.audioStatus,
      editStatus: body.editStatus,
    });
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal memperbarui milestone konten." },
      { status: 400 }
    );
  }
}
