import { NextResponse } from "next/server";
import { getFlowQueueSummary } from "@/lib/flow";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const contentItemId = url.searchParams.get("contentItemId") || undefined;

  const summary = getFlowQueueSummary(projectId, contentItemId);
  return NextResponse.json({ summary });
}
