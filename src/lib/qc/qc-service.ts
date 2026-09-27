import "server-only";

import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import type {
  CreateQcReviewInput,
  QcReviewFilters,
  UpdateQcReviewInput,
} from "./types";

export function createQcReview(input: CreateQcReviewInput): schema.QcReview {
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, input.projectId))
    .get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");

  if (!input.issue || input.issue.trim() === "") {
    throw new DomainError("Deskripsi issue QC tidak boleh kosong.");
  }

  // Validate shot belongs to project if provided
  if (input.shotId) {
    const shot = db
      .select()
      .from(schema.shots)
      .where(and(eq(schema.shots.id, input.shotId), eq(schema.shots.projectId, input.projectId)))
      .get();
    if (!shot) throw new DomainError("Shot tidak ditemukan dalam proyek ini.");
  }

  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.qcReviews)
    .values({
      id,
      projectId: input.projectId,
      contentItemId: input.contentItemId || null,
      sceneId: input.sceneId || null,
      shotId: input.shotId || null,
      assetVersionId: input.assetVersionId || null,
      videoOutputId: input.videoOutputId || null,
      reviewType: input.reviewType,
      status: "OPEN",
      severity: input.severity,
      issue: input.issue.trim(),
      action: (input.action || "").trim(),
      reviewer: input.reviewer || "User",
      notes: (input.notes || "").trim(),
      createdAt: now,
      resolvedAt: null,
    })
    .run();

  const review = db.select().from(schema.qcReviews).where(eq(schema.qcReviews.id, id)).get();
  if (!review) throw new DomainError("Gagal mengambil QC review yang baru dibuat.");
  return review;
}

export function getQcReview(id: string, projectId: string): schema.QcReview | null {
  const review = db
    .select()
    .from(schema.qcReviews)
    .where(and(eq(schema.qcReviews.id, id), eq(schema.qcReviews.projectId, projectId)))
    .get();
  return review || null;
}

export function listQcReviews(filters: QcReviewFilters): schema.QcReview[] {
  const query = db
    .select()
    .from(schema.qcReviews)
    .where(eq(schema.qcReviews.projectId, filters.projectId))
    .orderBy(desc(schema.qcReviews.createdAt));

  const allReviews = query.all();

  return allReviews.filter((r) => {
    if (filters.contentItemId && r.contentItemId !== filters.contentItemId) return false;
    if (filters.sceneId && r.sceneId !== filters.sceneId) return false;
    if (filters.shotId && r.shotId !== filters.shotId) return false;
    if (filters.assetVersionId && r.assetVersionId !== filters.assetVersionId) return false;
    if (filters.videoOutputId && r.videoOutputId !== filters.videoOutputId) return false;
    if (filters.reviewType && r.reviewType !== filters.reviewType) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.severity && r.severity !== filters.severity) return false;
    return true;
  });
}

export function updateQcReview(
  id: string,
  projectId: string,
  input: UpdateQcReviewInput
): schema.QcReview {
  const existing = getQcReview(id, projectId);
  if (!existing) throw new DomainError("QC review tidak ditemukan.");

  const values: Partial<typeof schema.qcReviews.$inferInsert> = {};
  if (input.reviewType !== undefined) values.reviewType = input.reviewType;
  if (input.status !== undefined) values.status = input.status;
  if (input.severity !== undefined) values.severity = input.severity;
  if (input.issue !== undefined) values.issue = input.issue.trim();
  if (input.action !== undefined) values.action = input.action.trim();
  if (input.reviewer !== undefined) values.reviewer = input.reviewer;
  if (input.notes !== undefined) values.notes = input.notes.trim();
  if (input.resolvedAt !== undefined) values.resolvedAt = input.resolvedAt;

  db.update(schema.qcReviews)
    .set(values)
    .where(and(eq(schema.qcReviews.id, id), eq(schema.qcReviews.projectId, projectId)))
    .run();

  const updated = getQcReview(id, projectId);
  if (!updated) throw new DomainError("Gagal memperbarui QC review.");
  return updated;
}

export function resolveQcReview(id: string, projectId: string, notes?: string): schema.QcReview {
  const existing = getQcReview(id, projectId);
  if (!existing) throw new DomainError("QC review tidak ditemukan.");

  const updatedNotes = notes ? `${existing.notes ? existing.notes + "\n" : ""}[RESOLVED]: ${notes}` : existing.notes;

  db.update(schema.qcReviews)
    .set({
      status: "RESOLVED",
      resolvedAt: new Date(),
      notes: updatedNotes,
    })
    .where(and(eq(schema.qcReviews.id, id), eq(schema.qcReviews.projectId, projectId)))
    .run();

  const updated = getQcReview(id, projectId);
  if (!updated) throw new DomainError("Gagal me-resolve QC review.");
  return updated;
}

export function waiveQcReview(id: string, projectId: string, notes?: string): schema.QcReview {
  const existing = getQcReview(id, projectId);
  if (!existing) throw new DomainError("QC review tidak ditemukan.");

  const updatedNotes = notes ? `${existing.notes ? existing.notes + "\n" : ""}[WAIVED]: ${notes}` : existing.notes;

  db.update(schema.qcReviews)
    .set({
      status: "WAIVED",
      resolvedAt: new Date(),
      notes: updatedNotes,
    })
    .where(and(eq(schema.qcReviews.id, id), eq(schema.qcReviews.projectId, projectId)))
    .run();

  const updated = getQcReview(id, projectId);
  if (!updated) throw new DomainError("Gagal me-waive QC review.");
  return updated;
}

export function deleteQcReview(id: string, projectId: string): void {
  const existing = getQcReview(id, projectId);
  if (!existing) throw new DomainError("QC review tidak ditemukan.");

  db.delete(schema.qcReviews)
    .where(and(eq(schema.qcReviews.id, id), eq(schema.qcReviews.projectId, projectId)))
    .run();
}

export function listQcChecklistItems(
  projectId?: string,
  category?: schema.QcChecklistCategory
): schema.QcChecklistItem[] {
  const items = projectId
    ? db
        .select()
        .from(schema.qcChecklistItems)
        .where(
          or(
            isNull(schema.qcChecklistItems.projectId),
            eq(schema.qcChecklistItems.projectId, projectId)
          )
        )
        .all()
    : db.select().from(schema.qcChecklistItems).all();

  return items.filter((item) => {
    if (!item.isEnabled) return false;
    if (category && item.category !== category) return false;
    return true;
  });
}
