import { NextResponse } from "next/server";
import { addToFlowQueue, listFlowQueueItems } from "@/lib/prompts/flow-queue-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; shotId: string }> }
) {
  const { projectId, shotId } = await context.params;
  try {
    const items = listFlowQueueItems(projectId, shotId);
    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal memuat item flow queue.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string }> }
) {
  const { projectId, shotId } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const { promptVersionId, engine, customParameters } = body;

    const res = addToFlowQueue({
      projectId,
      shotId,
      promptVersionId,
      engine,
      customParameters,
    });

    return NextResponse.json({
      success: true,
      item: res.item,
      payload: res.payload,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menambahkan prompt ke Flow Queue.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
