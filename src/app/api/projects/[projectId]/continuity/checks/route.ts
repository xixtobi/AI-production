import { NextResponse } from "next/server";
import { createContinuityCheck, listContinuityChecks } from "@/lib/qc";
import { DomainError } from "@/lib/projects/domain-error";
import type { ContinuityCheckStatus, QcSeverity } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);

  const checks = listContinuityChecks({
    projectId,
    contentItemId: url.searchParams.get("contentItemId") || undefined,
    shotId: url.searchParams.get("shotId") || undefined,
    status: (url.searchParams.get("status") as ContinuityCheckStatus) || undefined,
    severity: (url.searchParams.get("severity") as QcSeverity) || undefined,
  });

  return NextResponse.json({ checks });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json();
    const check = createContinuityCheck({
      projectId,
      contentItemId: body.contentItemId,
      sceneId: body.sceneId,
      shotId: body.shotId,
      referenceShotId: body.referenceShotId,
      ruleId: body.ruleId,
      severity: body.severity || "MAJOR",
      finding: body.finding,
    });
    return NextResponse.json({ check }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal menyimpan temuan kontinuitas." },
      { status: 400 }
    );
  }
}
