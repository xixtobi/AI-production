import "server-only";

import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { resolveProjectPath } from "@/lib/filesystem/path-service";
import type { AttentionItem, ProductionDashboardMetrics } from "./types";

export function getProductionDashboardMetrics(projectId: string): ProductionDashboardMetrics {
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  const rootPath = project?.rootPath || "";

  // 1. Shots by status
  const allShots = db
    .select()
    .from(schema.shots)
    .where(eq(schema.shots.projectId, projectId))
    .all();

  const shotCounts: Record<string, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    NEEDS_REVISION: 0,
    APPROVED: 0,
    FINAL: 0,
    BLOCKED: 0,
  };

  for (const shot of allShots) {
    const st = shot.status || "NOT_STARTED";
    shotCounts[st] = (shotCounts[st] || 0) + 1;
  }

  // 2. Video outputs
  const allVideos = db
    .select()
    .from(schema.videoOutputs)
    .where(eq(schema.videoOutputs.projectId, projectId))
    .all();

  const videoCounts = {
    total: allVideos.length,
    approved: allVideos.filter((v) => v.status === "APPROVED").length,
    needsRevision: allVideos.filter((v) => v.status === "NEEDS_REVISION").length,
    inProgress: allVideos.filter((v) => v.status === "IN_PROGRESS").length,
    final: allVideos.filter((v) => v.status === "FINAL").length,
  };

  // 3. Asset health
  const allAssets = db
    .select()
    .from(schema.assets)
    .where(eq(schema.assets.projectId, projectId))
    .all();

  const allAssetVersions = db
    .select()
    .from(schema.assetVersions)
    .where(eq(schema.assetVersions.projectId, projectId))
    .all();

  let missingOnDiskCount = 0;
  const missingAssetAttention: AttentionItem[] = [];

  for (const v of allAssetVersions) {
    if (rootPath) {
      try {
        const absPath = resolveProjectPath(rootPath, v.relativePath);
        if (!existsSync(absPath)) {
          missingOnDiskCount++;
          const asset = allAssets.find((a) => a.id === v.assetId);
          missingAssetAttention.push({
            id: `missing-${v.id}`,
            category: "MISSING_FILE",
            severity: "CRITICAL",
            title: `File Hilang di Disk: ${asset?.name ? `${asset.name} (${v.filename})` : v.filename}`,
            description: `Berkas versi ${v.versionLabel} tidak ditemukan di lokasi: ${v.relativePath}`,
            linkHref: `/projects/${projectId}/assets/${v.assetId}`,
          });
        }
      } catch {
        missingOnDiskCount++;
      }
    }
  }

  const assetHealth = {
    total: allAssets.length,
    approved: allAssets.filter((a) => a.status === "APPROVED").length,
    missingOnDisk: missingOnDiskCount,
    locked: allAssetVersions.filter((v) => v.isLocked).length,
  };

  // 4. QC Health
  const allQc = db
    .select()
    .from(schema.qcReviews)
    .where(eq(schema.qcReviews.projectId, projectId))
    .all();

  const qcHealth = {
    total: allQc.length,
    openCritical: allQc.filter((q) => q.status === "OPEN" && q.severity === "CRITICAL").length,
    openMajor: allQc.filter((q) => q.status === "OPEN" && q.severity === "MAJOR").length,
    openMinor: allQc.filter((q) => q.status === "OPEN" && q.severity === "MINOR").length,
    resolved: allQc.filter((q) => q.status === "RESOLVED").length,
    waived: allQc.filter((q) => q.status === "WAIVED").length,
  };

  // 5. Continuity Health
  const allContinuity = db
    .select()
    .from(schema.continuityChecks)
    .where(eq(schema.continuityChecks.projectId, projectId))
    .all();

  const continuityHealth = {
    total: allContinuity.length,
    open: allContinuity.filter((c) => c.status === "OPEN").length,
    reviewed: allContinuity.filter((c) => c.status === "REVIEWED").length,
    resolved: allContinuity.filter((c) => c.status === "RESOLVED").length,
    waived: allContinuity.filter((c) => c.status === "WAIVED").length,
  };

  // 6. Attention Items (Objective Work Queue)
  const attentionItems: AttentionItem[] = [...missingAssetAttention];

  // Open Critical QC
  for (const q of allQc.filter((q) => q.status === "OPEN" && q.severity === "CRITICAL")) {
    const shot = q.shotId ? allShots.find((s) => s.id === q.shotId) : null;
    attentionItems.push({
      id: `qc-${q.id}`,
      category: "CRITICAL_QC",
      severity: "CRITICAL",
      title: `Critical QC [${q.reviewType}]: ${shot ? shot.shotCode : "Umum"}`,
      description: q.issue,
      shotId: q.shotId || undefined,
      shotCode: shot?.shotCode,
      linkHref: shot ? `/projects/${projectId}/shots/${shot.id}` : undefined,
    });
  }

  // Open Major QC
  for (const q of allQc.filter((q) => q.status === "OPEN" && q.severity === "MAJOR")) {
    const shot = q.shotId ? allShots.find((s) => s.id === q.shotId) : null;
    attentionItems.push({
      id: `qc-${q.id}`,
      category: "MAJOR_QC",
      severity: "MAJOR",
      title: `Major QC [${q.reviewType}]: ${shot ? shot.shotCode : "Umum"}`,
      description: q.issue,
      shotId: q.shotId || undefined,
      shotCode: shot?.shotCode,
      linkHref: shot ? `/projects/${projectId}/shots/${shot.id}` : undefined,
    });
  }

  // Open Continuity Checks
  for (const c of allContinuity.filter((c) => c.status === "OPEN")) {
    const shot = allShots.find((s) => s.id === c.shotId);
    const refShot = allShots.find((s) => s.id === c.referenceShotId);
    attentionItems.push({
      id: `continuity-${c.id}`,
      category: "CONTINUITY",
      severity: c.severity,
      title: `Temuan Kontinuitas: ${shot?.shotCode || "Shot"} vs ${refShot?.shotCode || "Ref"}`,
      description: c.finding,
      shotId: c.shotId,
      shotCode: shot?.shotCode,
      linkHref: shot ? `/projects/${projectId}/shots/${shot.id}` : undefined,
    });
  }

  // Failed Flow jobs
  const failedJobs = db
    .select()
    .from(schema.flowQueueItems)
    .where(
      and(
        eq(schema.flowQueueItems.projectId, projectId),
        eq(schema.flowQueueItems.status, "FAILED")
      )
    )
    .all();

  for (const job of failedJobs) {
    const shot = allShots.find((s) => s.id === job.shotId);
    attentionItems.push({
      id: `flow-failed-${job.id}`,
      category: "FAILED_FLOW_JOB",
      severity: "MAJOR",
      title: `Flow Job Gagal: ${shot ? shot.shotCode : job.id.slice(0, 8)}`,
      description: `Job model ${job.model} gagal diproses. Catatan: ${job.notes || "Tidak ada rincian."}`,
      shotId: job.shotId,
      shotCode: shot?.shotCode,
      linkHref: `/projects/${projectId}/flow`,
    });
  }

  return {
    shotCounts,
    totalShots: allShots.length,
    videoCounts,
    assetHealth,
    qcHealth,
    continuityHealth,
    attentionItems,
  };
}
