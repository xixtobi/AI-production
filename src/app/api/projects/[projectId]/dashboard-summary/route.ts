import { NextResponse } from "next/server";
import { getProductionDashboardMetrics } from "@/lib/qc";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const metrics = getProductionDashboardMetrics(projectId);
  return NextResponse.json({ metrics });
}
