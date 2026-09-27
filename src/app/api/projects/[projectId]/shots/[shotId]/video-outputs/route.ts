import { NextResponse } from "next/server";
import { listVideoOutputsForShot, registerVideoOutput } from "@/lib/flow";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; shotId: string }> }
) {
  const { shotId } = await context.params;
  try {
    const outputs = listVideoOutputsForShot(shotId);
    return NextResponse.json({ outputs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal memuat daftar video output." },
      { status: 400 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string }> }
) {
  const { projectId, shotId } = await context.params;
  try {
    const body = await request.json();
    const result = await registerVideoOutput({
      projectId,
      shotId,
      contentItemId: body.contentItemId,
      sceneId: body.sceneId,
      flowQueueItemId: body.flowQueueItemId || null,
      generationAttemptId: body.generationAttemptId || null,
      filePath: body.filePath,
      model: body.model,
      status: body.status,
      notes: body.notes,
      creditsUsed: body.creditsUsed != null ? Number(body.creditsUsed) : null,
      customDuration: body.customDuration != null ? Number(body.customDuration) : null,
      customResolution: body.customResolution || null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal mendaftarkan video output." },
      { status: 400 }
    );
  }
}
