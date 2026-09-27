import { NextResponse } from "next/server";
import { updateContinuityCheckStatus } from "@/lib/qc";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; checkId: string }> }
) {
  const { projectId, checkId } = await context.params;
  try {
    const body = await request.json();
    const updated = updateContinuityCheckStatus(checkId, projectId, body.status);
    return NextResponse.json({ check: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal memperbarui status check kontinuitas." },
      { status: 400 }
    );
  }
}
