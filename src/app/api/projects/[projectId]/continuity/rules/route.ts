import { NextResponse } from "next/server";
import { createContinuityRule, listContinuityRules } from "@/lib/qc";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const rules = listContinuityRules(projectId, false);
  return NextResponse.json({ rules });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json();
    const rule = createContinuityRule({
      projectId,
      ruleType: body.ruleType,
      name: body.name,
      description: body.description,
      severity: body.severity,
      enabled: body.enabled,
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal membuat aturan kontinuitas." },
      { status: 400 }
    );
  }
}
