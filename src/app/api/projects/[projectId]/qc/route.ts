import { NextResponse } from "next/server";
import { createQcReview, listQcReviews } from "@/lib/qc";
import { DomainError } from "@/lib/projects/domain-error";
import type { QcReviewType, QcReviewStatus, QcSeverity } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);

  const reviews = listQcReviews({
    projectId,
    contentItemId: url.searchParams.get("contentItemId") || undefined,
    sceneId: url.searchParams.get("sceneId") || undefined,
    shotId: url.searchParams.get("shotId") || undefined,
    assetVersionId: url.searchParams.get("assetVersionId") || undefined,
    videoOutputId: url.searchParams.get("videoOutputId") || undefined,
    reviewType: (url.searchParams.get("reviewType") as QcReviewType) || undefined,
    status: (url.searchParams.get("status") as QcReviewStatus) || undefined,
    severity: (url.searchParams.get("severity") as QcSeverity) || undefined,
  });

  return NextResponse.json({ reviews });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json();
    const review = createQcReview({
      projectId,
      contentItemId: body.contentItemId,
      sceneId: body.sceneId,
      shotId: body.shotId,
      assetVersionId: body.assetVersionId,
      videoOutputId: body.videoOutputId,
      reviewType: body.reviewType || "VISUAL",
      severity: body.severity || "MINOR",
      issue: body.issue,
      action: body.action,
      reviewer: body.reviewer,
      notes: body.notes,
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal membuat QC issue." },
      { status: 400 }
    );
  }
}
