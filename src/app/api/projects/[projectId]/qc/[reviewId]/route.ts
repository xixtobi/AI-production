import { NextResponse } from "next/server";
import { deleteQcReview, getQcReview, resolveQcReview, updateQcReview, waiveQcReview } from "@/lib/qc";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; reviewId: string }> }
) {
  const { projectId, reviewId } = await context.params;
  const review = getQcReview(reviewId, projectId);
  if (!review) {
    return NextResponse.json({ error: "QC review tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ review });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; reviewId: string }> }
) {
  const { projectId, reviewId } = await context.params;
  try {
    const body = await request.json();
    const action = body.actionType;

    let review;
    if (action === "resolve") {
      review = resolveQcReview(reviewId, projectId, body.notes);
    } else if (action === "waive") {
      review = waiveQcReview(reviewId, projectId, body.notes);
    } else {
      review = updateQcReview(reviewId, projectId, {
        reviewType: body.reviewType,
        status: body.status,
        severity: body.severity,
        issue: body.issue,
        action: body.action,
        reviewer: body.reviewer,
        notes: body.notes,
      });
    }

    return NextResponse.json({ review });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal memperbarui QC review." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; reviewId: string }> }
) {
  const { projectId, reviewId } = await context.params;
  try {
    deleteQcReview(reviewId, projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal menghapus QC review." },
      { status: 400 }
    );
  }
}
