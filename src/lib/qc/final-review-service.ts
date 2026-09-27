import "server-only";

import { existsSync } from "node:fs";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { resolveProjectPath } from "@/lib/filesystem/path-service";
import { DomainError } from "@/lib/projects/domain-error";
import type { FinalReviewEvaluation } from "./types";

export function evaluateContentFinalReadiness(
  projectId: string,
  contentItemId: string
): FinalReviewEvaluation {
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");
  const rootPath = project.rootPath;

  const content = db
    .select()
    .from(schema.contentItems)
    .where(and(eq(schema.contentItems.id, contentItemId), eq(schema.contentItems.projectId, projectId)))
    .get();
  if (!content) throw new DomainError("Content item tidak ditemukan.");

  const shots = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.projectId, projectId), eq(schema.shots.contentItemId, contentItemId)))
    .all();

  const shotIds = shots.map((s) => s.id);

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // 1. Script status (locked is recommended; unlocked is warning)
  const scriptDoc = db
    .select()
    .from(schema.scriptDocuments)
    .where(and(eq(schema.scriptDocuments.projectId, projectId), eq(schema.scriptDocuments.contentItemId, contentItemId)))
    .get();

  let scriptLocked = false;
  if (scriptDoc) {
    const versions = db
      .select()
      .from(schema.scriptVersions)
      .where(eq(schema.scriptVersions.scriptDocumentId, scriptDoc.id))
      .orderBy(desc(schema.scriptVersions.versionNumber))
      .all();

    if (versions.length > 0 && versions[0].isLocked) {
      scriptLocked = true;
    } else {
      warnings.push("Naskah episode belum di-lock (status draft/unlocked). Disarankan me-lock versi naskah sebelum final.");
    }
  } else {
    warnings.push("Dokumen naskah belum dibuat untuk episode ini.");
  }

  // 2. QC Reviews for this content & its shots
  const allQc = db
    .select()
    .from(schema.qcReviews)
    .where(eq(schema.qcReviews.projectId, projectId))
    .all();

  const contentQc = allQc.filter(
    (q) =>
      q.contentItemId === contentItemId ||
      (q.shotId && shotIds.includes(q.shotId))
  );

  const openCritical = contentQc.filter(
    (q) => (q.status === "OPEN" || q.status === "IN_REVIEW") && q.severity === "CRITICAL"
  );
  const openMajor = contentQc.filter(
    (q) => (q.status === "OPEN" || q.status === "IN_REVIEW") && q.severity === "MAJOR"
  );
  const openMinor = contentQc.filter(
    (q) => (q.status === "OPEN" || q.status === "IN_REVIEW") && q.severity === "MINOR"
  );

  // Critical QC: must be resolved or explicitly waived (blocks final)
  if (openCritical.length > 0) {
    blockingReasons.push(
      `Terdapat ${openCritical.length} issue QC Kritis yang belum di-resolve atau di-waive.`
    );
  }

  // Major QC: blocks final unless explicitly waived
  if (openMajor.length > 0) {
    blockingReasons.push(
      `Terdapat ${openMajor.length} issue QC Major yang belum di-resolve atau di-waive.`
    );
  }

  // Minor QC: does NOT block final
  if (openMinor.length > 0) {
    warnings.push(
      `Terdapat ${openMinor.length} issue QC Minor yang masih terbuka (tidak menghambat persetujuan final).`
    );
  }

  // 3. Missing required assets
  let missingAssetsCount = 0;
  if (shotIds.length > 0) {
    const linkedAssets = db
      .select({
        link: schema.shotAssets,
        asset: schema.assets,
        version: schema.assetVersions,
      })
      .from(schema.shotAssets)
      .innerJoin(schema.assets, eq(schema.assets.id, schema.shotAssets.assetId))
      .leftJoin(
        schema.assetVersions,
        and(
          eq(schema.assetVersions.assetId, schema.assets.id),
          eq(schema.assetVersions.isCurrent, true)
        )
      )
      .where(and(eq(schema.shotAssets.projectId, projectId), inArray(schema.shotAssets.shotId, shotIds)))
      .all();

    for (const la of linkedAssets) {
      if (la.version && rootPath) {
        try {
          const abs = resolveProjectPath(rootPath, la.version.relativePath);
          if (!existsSync(abs)) {
            missingAssetsCount++;
            blockingReasons.push(
              `Aset ${la.asset.assetCode} (${la.version.filename}) tidak ditemukan di disk.`
            );
          }
        } catch {
          missingAssetsCount++;
          blockingReasons.push(`Aset ${la.asset.assetCode} memiliki path yang tidak valid.`);
        }
      }
    }
  }

  // 4. Video outputs for shots: all shots must have approved video
  const allVideos = db
    .select()
    .from(schema.videoOutputs)
    .where(eq(schema.videoOutputs.projectId, projectId))
    .all();

  const approvedShotsWithVideo = new Set<string>();
  for (const v of allVideos) {
    if (shotIds.includes(v.shotId) && (v.status === "APPROVED" || v.status === "FINAL")) {
      approvedShotsWithVideo.add(v.shotId);
    }
  }

  // Check shots missing approved video
  const shotsMissingVideo = shots.filter((s) => !approvedShotsWithVideo.has(s.id));
  if (shotsMissingVideo.length > 0) {
    blockingReasons.push(
      `Terdapat ${shotsMissingVideo.length} shot yang belum memiliki video output berstatus APPROVED/FINAL: ${shotsMissingVideo.slice(0, 5).map((s) => s.shotCode).join(", ")}${shotsMissingVideo.length > 5 ? "..." : ""}.`
    );
  }

  // 5. Shot statuses: all shots must be APPROVED or FINAL
  const unapprovedShots = shots.filter((s) => s.status !== "APPROVED" && s.status !== "FINAL");
  if (unapprovedShots.length > 0) {
    blockingReasons.push(
      `Terdapat ${unapprovedShots.length} shot yang belum berstatus APPROVED atau FINAL: ${unapprovedShots.slice(0, 5).map((s) => s.shotCode).join(", ")}${unapprovedShots.length > 5 ? "..." : ""}.`
    );
  }

  const canApprove = blockingReasons.length === 0;

  return {
    contentItemId: content.id,
    contentCode: content.code,
    contentTitle: content.title,
    currentStatus: content.status,
    audioStatus: content.audioStatus,
    editStatus: content.editStatus,
    canApprove,
    blockingReasons,
    warnings,
    checks: {
      scriptLocked,
      allShotsApprovedOrFinal: unapprovedShots.length === 0,
      allVideosRegistered: shotsMissingVideo.length === 0,
      noMissingAssets: missingAssetsCount === 0,
      noOpenCriticalQc: openCritical.length === 0,
      noOpenMajorQc: openMajor.length === 0,
    },
    stats: {
      totalShots: shots.length,
      approvedOrFinalShots: shots.length - unapprovedShots.length,
      totalVideos: allVideos.filter((v) => shotIds.includes(v.shotId)).length,
      missingAssetsCount,
      openCriticalQcCount: openCritical.length,
      openMajorQcCount: openMajor.length,
      openMinorQcCount: openMinor.length,
    },
  };
}

export function approveContentFinal(
  projectId: string,
  contentItemId: string
): schema.ContentItem {
  const evalResult = evaluateContentFinalReadiness(projectId, contentItemId);

  if (!evalResult.canApprove) {
    throw new DomainError(
      `Episode ${evalResult.contentCode} belum dapat disetujui sebagai FINAL:\n- ${evalResult.blockingReasons.join("\n- ")}`
    );
  }

  const now = new Date();
  db.update(schema.contentItems)
    .set({
      status: "FINAL",
      updatedAt: now,
    })
    .where(and(eq(schema.contentItems.id, contentItemId), eq(schema.contentItems.projectId, projectId)))
    .run();

  const updated = db
    .select()
    .from(schema.contentItems)
    .where(and(eq(schema.contentItems.id, contentItemId), eq(schema.contentItems.projectId, projectId)))
    .get();

  if (!updated) throw new DomainError("Gagal memperbarui status episode ke FINAL.");
  return updated;
}

export function updateContentMilestones(params: {
  projectId: string;
  contentItemId: string;
  audioStatus?: schema.ProductionMilestoneStatus;
  editStatus?: schema.ProductionMilestoneStatus;
}): schema.ContentItem {
  const values: Partial<typeof schema.contentItems.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (params.audioStatus) values.audioStatus = params.audioStatus;
  if (params.editStatus) values.editStatus = params.editStatus;

  db.update(schema.contentItems)
    .set(values)
    .where(and(eq(schema.contentItems.id, params.contentItemId), eq(schema.contentItems.projectId, params.projectId)))
    .run();

  const updated = db
    .select()
    .from(schema.contentItems)
    .where(and(eq(schema.contentItems.id, params.contentItemId), eq(schema.contentItems.projectId, params.projectId)))
    .get();

  if (!updated) throw new DomainError("Gagal memperbarui milestone konten.");
  return updated;
}
