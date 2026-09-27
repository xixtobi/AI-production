import { NextResponse } from "next/server";
import { createFlowQueueItem, listFlowQueueItems } from "@/lib/flow";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);

  const contentItemId = url.searchParams.get("contentItemId") || undefined;
  const sceneId = url.searchParams.get("sceneId") || undefined;
  const shotId = url.searchParams.get("shotId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const model = url.searchParams.get("model") || undefined;
  const readyState = (url.searchParams.get("readyState") as "READY" | "NOT_READY") || undefined;
  const search = url.searchParams.get("search") || undefined;

  try {
    const items = listFlowQueueItems({
      projectId,
      contentItemId,
      sceneId,
      shotId,
      status,
      model,
      readyState,
      search,
    });
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal memuat Flow Queue." },
      { status: 400 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json();
    const result = createFlowQueueItem({
      projectId,
      contentItemId: body.contentItemId,
      sceneId: body.sceneId,
      shotId: body.shotId,
      promptVersionId: body.promptVersionId,
      engine: body.engine,
      model: body.model,
      durationSeconds: body.durationSeconds != null ? Number(body.durationSeconds) : undefined,
      aspectRatio: body.aspectRatio,
      resolution: body.resolution,
      audioEnabled: Boolean(body.audioEnabled),
      startFrameAssetVersionId: body.startFrameAssetVersionId || null,
      endFrameAssetVersionId: body.endFrameAssetVersionId || null,
      references: body.references,
      notes: body.notes,
      estimatedCredits: body.estimatedCredits != null ? Number(body.estimatedCredits) : null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal menambahkan ke Flow Queue." },
      { status: 400 }
    );
  }
}
