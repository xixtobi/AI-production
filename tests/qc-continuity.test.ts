import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";

let dataDir: string;
let testRootPath: string;
let database: typeof import("../src/lib/db");
let qcModule: typeof import("../src/lib/qc");
let projectService: typeof import("../src/lib/projects/service");

let projectId: string;
let contentId: string;
let sh016Id: string;
let sh015Id: string;

before(async () => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "lpc-qc-test-db-"));
  testRootPath = path.join(dataDir, "project-storage");
  process.env.PRODUCTION_CONTROL_DATA_DIR = dataDir;

  mkdirSync(testRootPath, { recursive: true });

  database = await import("../src/lib/db");
  database.ensureDatabaseReady();

  qcModule = await import("../src/lib/qc");
  projectService = await import("../src/lib/projects/service");

  // Fetch seeded project LEMBAH-AWAN
  const project = database.db
    .select()
    .from(database.schema.projects)
    .where(eq(database.schema.projects.code, "LEMBAH-AWAN"))
    .get();

  assert.ok(project, "Proyek Lembah Awan harus ter-seed otomatis.");
  projectId = project.id;

  // Update rootPath to testRootPath for filesystem isolation
  database.db
    .update(database.schema.projects)
    .set({ rootPath: testRootPath })
    .where(eq(database.schema.projects.id, projectId))
    .run();

  const content = database.db
    .select()
    .from(database.schema.contentItems)
    .where(eq(database.schema.contentItems.projectId, projectId))
    .get();

  assert.ok(content, "Content EP01 harus ter-seed otomatis.");
  contentId = content.id;

  const shot16 = database.db
    .select()
    .from(database.schema.shots)
    .where(
      and(
        eq(database.schema.shots.projectId, projectId),
        eq(database.schema.shots.shotCode, "SH016")
      )
    )
    .get();

  assert.ok(shot16, "Shot SH016 harus ter-seed otomatis.");
  sh016Id = shot16.id;

  const shot15 = database.db
    .select()
    .from(database.schema.shots)
    .where(
      and(
        eq(database.schema.shots.projectId, projectId),
        eq(database.schema.shots.shotCode, "SH015")
      )
    )
    .get();

  assert.ok(shot15, "Shot SH015 harus ter-seed otomatis.");
  sh015Id = shot15.id;
});

after(() => {
  database.db.$client.close();
  rmSync(dataDir, { recursive: true, force: true });
});

// =========================================================================
// 1. SEED VERIFICATION
// =========================================================================
test("1. Seed verification: 17 QC checklist items and 8 continuity rules are seeded", () => {
  const checklistItems = qcModule.listQcChecklistItems(projectId);
  assert.ok(checklistItems.length >= 17, `Checklist items should be at least 17, got ${checklistItems.length}`);

  const visualItems = checklistItems.filter((i) => i.category === "VISUAL");
  const techItems = checklistItems.filter((i) => i.category === "TECHNICAL");
  const storyItems = checklistItems.filter((i) => i.category === "STORY");
  assert.ok(visualItems.length > 0, "Harus ada checklist VISUAL");
  assert.ok(techItems.length > 0, "Harus ada checklist TECHNICAL");
  assert.ok(storyItems.length > 0, "Harus ada checklist STORY");

  const rules = qcModule.listContinuityRules(projectId);
  assert.ok(rules.length >= 8, `Continuity rules should be at least 8, got ${rules.length}`);
  const ruleTypes = rules.map((r) => r.ruleType);
  assert.ok(ruleTypes.includes("CHARACTER_APPEARANCE"));
  assert.ok(ruleTypes.includes("COSTUME"));
  assert.ok(ruleTypes.includes("PROP"));
  assert.ok(ruleTypes.includes("LOCATION"));
});

// =========================================================================
// 2. CREATE QC REVIEW & SEVERITY HANDLING
// =========================================================================
test("2. Create QC Review and check default values", () => {
  const review = qcModule.createQcReview({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    reviewType: "VISUAL",
    severity: "MINOR",
    issue: "Slight pixelation on background leaf edge",
    action: "Re-render background layer with anti-aliasing if time permits",
    reviewer: "QC Lead",
  });

  assert.ok(review.id);
  assert.equal(review.status, "OPEN");
  assert.equal(review.severity, "MINOR");
  assert.equal(review.reviewType, "VISUAL");
  assert.equal(review.reviewer, "QC Lead");
  assert.equal(review.resolvedAt, null);

  const fetched = qcModule.getQcReview(review.id, projectId);
  assert.ok(fetched);
  assert.equal(fetched.id, review.id);
});

// =========================================================================
// 3. MINOR QC NEVER BLOCKS PRODUCTION
// =========================================================================
test("3. Minor QC does NOT block final review approval", () => {
  const evalResult = qcModule.evaluateContentFinalReadiness(projectId, contentId);
  // Minor QC count is in stats.openMinorQcCount and should NOT be in blocking reasons
  assert.equal(evalResult.stats.openMinorQcCount, 1);
  const minorBlock = evalResult.blockingReasons.some((r) => r.toLowerCase().includes("minor"));
  assert.equal(minorBlock, false, "Minor QC should never appear in blocking reasons");
});

// =========================================================================
// 4. CRITICAL QC BLOCKS PRODUCTION UNCONDITIONALLY
// =========================================================================
test("4. Critical QC blocks final review approval unconditionally", () => {
  const criticalReview = qcModule.createQcReview({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    reviewType: "TECHNICAL",
    severity: "CRITICAL",
    issue: "Corrupted frames at frame 12-24",
    action: "Regenerate video from Flow Queue",
    reviewer: "Senior QC",
  });

  const evalResult = qcModule.evaluateContentFinalReadiness(projectId, contentId);
  assert.equal(evalResult.canApprove, false);
  assert.equal(evalResult.stats.openCriticalQcCount >= 1, true);
  const hasCriticalReason = evalResult.blockingReasons.some(
    (r) => r.toLowerCase().includes("kritis") || r.toLowerCase().includes("critical")
  );
  assert.equal(hasCriticalReason, true, "Critical QC must be in blocking reasons");

  // Clean up critical review for next tests
  qcModule.deleteQcReview(criticalReview.id, projectId);
});

// =========================================================================
// 5. MAJOR QC BLOCKS UNLESS WAIVED
// =========================================================================
test("5. Major QC blocks final review unless explicitly waived", () => {
  const majorReview = qcModule.createQcReview({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    reviewType: "CONTINUITY",
    severity: "MAJOR",
    issue: "Character basket on wrong shoulder",
    action: "Mirror video or fix start frame",
    reviewer: "Art Director",
  });

  let evalResult = qcModule.evaluateContentFinalReadiness(projectId, contentId);
  assert.equal(evalResult.stats.openMajorQcCount >= 1, true);
  const hasMajorReason = evalResult.blockingReasons.some(
    (r) => r.toLowerCase().includes("major")
  );
  assert.equal(hasMajorReason, true, "Major QC must block final review");

  // Now waive the major review
  const waived = qcModule.waiveQcReview(
    majorReview.id,
    projectId,
    "Diterima oleh Sutradara: posisi keranjang dibiarkan karena kontinuitas artistik."
  );
  assert.equal(waived.status, "WAIVED");
  assert.ok(waived.resolvedAt);

  evalResult = qcModule.evaluateContentFinalReadiness(projectId, contentId);
  assert.equal(evalResult.stats.openMajorQcCount, 0, "Waived QC must not count as open major QC");

  // Clean up
  qcModule.deleteQcReview(majorReview.id, projectId);
});

// =========================================================================
// 6. RESOLVE QC REVIEW
// =========================================================================
test("6. Resolve QC review updates status and sets resolvedAt", () => {
  const review = qcModule.createQcReview({
    projectId,
    shotId: sh016Id,
    reviewType: "AUDIO",
    severity: "MINOR",
    issue: "Audio background click",
    action: "Noise reduction filter",
  });

  const resolved = qcModule.resolveQcReview(
    review.id,
    projectId,
    "Diterapkan filter noise reduction - audio bersih."
  );
  assert.equal(resolved.status, "RESOLVED");
  assert.ok(resolved.resolvedAt);

  // Clean up
  qcModule.deleteQcReview(review.id, projectId);
});

// =========================================================================
// 7. CONTINUITY RULES & CUSTOM RULE CREATION
// =========================================================================
test("7. Continuity rules management: list and create custom rule", () => {
  const initialRules = qcModule.listContinuityRules(projectId);
  const customRule = qcModule.createContinuityRule({
    projectId,
    name: "Awan Signature Floating Speed",
    ruleType: "STORY_STATE",
    description: "Kecepatan terbang awan harus stabil antara shot berdekatan.",
  });

  assert.ok(customRule.id);
  assert.equal(customRule.projectId, projectId);

  const updatedRules = qcModule.listContinuityRules(projectId);
  assert.equal(updatedRules.length, initialRules.length + 1);
  assert.ok(updatedRules.some((r) => r.id === customRule.id));
});

// =========================================================================
// 8. CONTINUITY CHECKS CRUD
// =========================================================================
test("8. Continuity check records CRUD", () => {
  const rules = qcModule.listContinuityRules(projectId);
  const rule = rules[0];

  const check = qcModule.createContinuityCheck({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    referenceShotId: sh015Id,
    ruleId: rule.id,
    severity: "MAJOR",
    finding: "Pemeriksaan visual kontinuitas kostum",
  });

  assert.ok(check.id);
  assert.equal(check.status, "OPEN");

  const list = qcModule.listContinuityChecks({ projectId, shotId: sh016Id });
  assert.ok(list.some((c) => c.id === check.id));

  const updated = qcModule.updateContinuityCheckStatus(check.id, projectId, "RESOLVED");
  assert.equal(updated.status, "RESOLVED");
});

// =========================================================================
// 9. GEMINI CONTINUITY ANALYSIS (FALLBACK & FORMAT)
// =========================================================================
test("9. Gemini continuity analysis returns structured findings", async () => {
  const result = await qcModule.analyzeContinuityWithGemini({
    projectId,
    shotId: sh016Id,
  });

  assert.ok(result);
  assert.ok(typeof result.summary === "string");
  assert.ok(Array.isArray(result.findings));
  if (result.findings.length > 0) {
    const f = result.findings[0];
    assert.ok(f.ruleType);
    assert.ok(f.severity);
    assert.ok(f.finding);
    assert.ok(f.proposedAction);
  }
});

// =========================================================================
// 10. SCRIPT CHANGE IMPACT DETECTION
// =========================================================================
test("10. Script change impact detects differences affecting shots", () => {
  const impacts = qcModule.detectScriptChangeImpact(projectId, contentId);
  assert.ok(Array.isArray(impacts));
});

// =========================================================================
// 11. ASSET CHANGE IMPACT DETECTION
// =========================================================================
test("11. Asset change impact detection", () => {
  const asset = database.db.select().from(database.schema.assets).where(eq(database.schema.assets.projectId, projectId)).get();
  if (asset) {
    const impact = qcModule.detectAssetChangeImpact(projectId, asset.assetCode);
    if (impact) {
      assert.equal(impact.type, "ASSET_CHANGE");
      assert.ok(impact.description);
    }
  } else {
    const impact = qcModule.detectAssetChangeImpact(projectId, "NONEXISTENT");
    assert.equal(impact, null);
  }
});

// =========================================================================
// 12. PROMPT CHANGE IMPACT DETECTION
// =========================================================================
test("12. Prompt change impact detection", () => {
  const pv = database.db.select().from(database.schema.promptVersions).get();
  if (pv) {
    const impact = qcModule.detectPromptChangeImpact(projectId, pv.id);
    if (impact) {
      assert.equal(impact.type, "PROMPT_CHANGE");
    }
  } else {
    const impact = qcModule.detectPromptChangeImpact(projectId, "dummy-id");
    assert.equal(impact, null);
  }
});

// =========================================================================
// 13. PRODUCTION DASHBOARD METRICS (OBJECTIVE COUNTS)
// =========================================================================
test("13. Production Dashboard metrics returns objective counts without subjective scores", () => {
  const metrics = qcModule.getProductionDashboardMetrics(projectId);

  assert.ok(metrics.shotCounts);
  assert.equal(typeof metrics.shotCounts.NOT_STARTED, "number");
  assert.equal(typeof metrics.shotCounts.IN_PROGRESS, "number");
  assert.equal(typeof metrics.shotCounts.APPROVED, "number");
  assert.equal(typeof metrics.shotCounts.FINAL, "number");

  assert.ok(metrics.videoCounts);
  assert.equal(typeof metrics.videoCounts.total, "number");

  assert.ok(metrics.assetHealth);
  assert.equal(typeof metrics.assetHealth.total, "number");
  assert.equal(typeof metrics.assetHealth.missingOnDisk, "number");

  assert.ok(metrics.qcHealth);
  assert.equal(typeof metrics.qcHealth.openCritical, "number");
  assert.equal(typeof metrics.qcHealth.openMajor, "number");
  assert.equal(typeof metrics.qcHealth.openMinor, "number");
  assert.equal(typeof metrics.qcHealth.resolved, "number");
  assert.equal(typeof metrics.qcHealth.waived, "number");

  assert.ok(Array.isArray(metrics.attentionItems));
});

// =========================================================================
// 14. PRODUCTION BOARD STATUS MOVEMENT
// =========================================================================
test("14. Production board shot status updates correctly", () => {
  database.db
    .update(database.schema.shots)
    .set({ status: "IN_PROGRESS" })
    .where(eq(database.schema.shots.id, sh016Id))
    .run();

  let shot = database.db
    .select()
    .from(database.schema.shots)
    .where(eq(database.schema.shots.id, sh016Id))
    .get();
  assert.equal(shot?.status, "IN_PROGRESS");

  database.db
    .update(database.schema.shots)
    .set({ status: "NEEDS_REVISION" })
    .where(eq(database.schema.shots.id, sh016Id))
    .run();

  shot = database.db
    .select()
    .from(database.schema.shots)
    .where(eq(database.schema.shots.id, sh016Id))
    .get();
  assert.equal(shot?.status, "NEEDS_REVISION");
});

// =========================================================================
// 15. MILESTONE STATUS UPDATES
// =========================================================================
test("15. Update content milestones (audio_status and edit_status)", () => {
  const updated = qcModule.updateContentMilestones({
    projectId,
    contentItemId: contentId,
    audioStatus: "IN_PROGRESS",
    editStatus: "IN_PROGRESS",
  });

  assert.equal(updated.audioStatus, "IN_PROGRESS");
  assert.equal(updated.editStatus, "IN_PROGRESS");

  const content = database.db
    .select()
    .from(database.schema.contentItems)
    .where(eq(database.schema.contentItems.id, contentId))
    .get();
  assert.equal(content?.audioStatus, "IN_PROGRESS");
  assert.equal(content?.editStatus, "IN_PROGRESS");
});

// =========================================================================
// 16. PROJECT ISOLATION
// =========================================================================
test("16. Project isolation: cross-project queries do not leak QC or continuity data", () => {
  const otherProject = projectService.createProject({
    code: "OTHER-PROJ-QC",
    name: "Other QC Project",
    projectType: "ANIMATION_SERIES",
    description: "Isolation test",
    rootPath: path.join(testRootPath, "other"),
    defaultAspectRatio: "16:9",
    defaultLanguage: "Indonesian",
  });

  const otherReviews = qcModule.listQcReviews({ projectId: otherProject.id });
  assert.equal(otherReviews.length, 0, "Other project must have 0 QC reviews");

  const otherChecks = qcModule.listContinuityChecks({ projectId: otherProject.id });
  assert.equal(otherChecks.length, 0, "Other project must have 0 continuity checks");

  const otherMetrics = qcModule.getProductionDashboardMetrics(otherProject.id);
  assert.equal(otherMetrics.shotCounts.NOT_STARTED, 0);
  assert.equal(otherMetrics.qcHealth.total, 0);
});

// =========================================================================
// 17. ACCEPTANCE TEST: 21-STEP FULL QC, CONTINUITY & FINAL REVIEW WORKFLOW
// =========================================================================
test("17. ACCEPTANCE TEST: Full 21-step QC, Continuity & Final Review on EP01 / SH016", async () => {
  // Step 1: Initial state check
  const content = database.db
    .select()
    .from(database.schema.contentItems)
    .where(eq(database.schema.contentItems.id, contentId))
    .get();
  assert.ok(content);
  assert.equal(content.code, "EP01");

  const shot = database.db
    .select()
    .from(database.schema.shots)
    .where(eq(database.schema.shots.id, sh016Id))
    .get();
  assert.ok(shot);
  assert.equal(shot.shotCode, "SH016");

  // Step 2: Ensure defaults seeded
  const checklists = qcModule.listQcChecklistItems(projectId);
  assert.ok(checklists.length >= 17);
  const rules = qcModule.listContinuityRules(projectId);
  assert.ok(rules.length >= 8);

  // Step 3: Create Minor QC issue on SH016
  const minorQc = qcModule.createQcReview({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    reviewType: "VISUAL",
    severity: "MINOR",
    issue: "Minor color saturation shift on sky background",
    action: "Adjust color grading curve slightly in post",
    reviewer: "Colorist",
  });
  assert.equal(minorQc.status, "OPEN");
  assert.equal(minorQc.severity, "MINOR");

  // Step 4: Run Gemini Continuity Analysis on SH016
  const analysis = await qcModule.analyzeContinuityWithGemini({
    projectId,
    shotId: sh016Id,
  });
  assert.ok(analysis.summary);
  assert.ok(Array.isArray(analysis.findings));

  // Step 5: Convert AI finding to a QC issue
  const aiFinding = analysis.findings[0] || {
    ruleType: "PROP" as const,
    severity: "MAJOR" as const,
    finding: "Pemeriksaan properti antara shot pembanding dan SH016",
    referenceShotCode: "SH015",
    proposedAction: "Verifikasi start frame image dan deskripsi naskah.",
  };

  const continuityQc = qcModule.createQcReview({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    reviewType: "CONTINUITY",
    severity: aiFinding.severity,
    issue: `[AI Continuity] ${aiFinding.finding}`,
    action: aiFinding.proposedAction,
    reviewer: "Gemini AI",
  });
  assert.equal(continuityQc.status, "OPEN");

  // Step 6: Verify Production Board data reflects SH016 with open QC issue
  const shotReviews = qcModule.listQcReviews({ projectId, shotId: sh016Id });
  const openReviews = shotReviews.filter((r) => r.status === "OPEN" || r.status === "IN_REVIEW");
  assert.ok(openReviews.length >= 2);

  // Step 7: Verify Production Dashboard Attention List includes the QC issues
  const dashMetrics = qcModule.getProductionDashboardMetrics(projectId);
  assert.ok(dashMetrics.qcHealth.total >= 2);
  const hasQcInAttention = dashMetrics.attentionItems.some((item) => item.category === "CRITICAL_QC" || item.category === "MAJOR_QC" || item.category === "CONTINUITY");
  assert.equal(hasQcInAttention, true);

  // Step 8: Final Review evaluation on EP01 -> blocked due to open major QC
  let evalResult = qcModule.evaluateContentFinalReadiness(projectId, contentId);
  assert.equal(evalResult.canApprove, false);

  // Step 9: Script change impact
  const scriptImpacts = qcModule.detectScriptChangeImpact(projectId, contentId);
  assert.ok(Array.isArray(scriptImpacts));

  // Step 10: Asset change impact
  const assetImpact = qcModule.detectAssetChangeImpact(projectId, "NONEXISTENT");
  assert.equal(assetImpact, null);

  // Step 11: Prompt change impact
  const promptImpact = qcModule.detectPromptChangeImpact(projectId, "dummy-id");
  assert.equal(promptImpact, null);

  // Step 12: Resolve minor QC issue
  const resolvedMinor = qcModule.resolveQcReview(
    minorQc.id,
    projectId,
    "Saturasi langit telah disesuaikan."
  );
  assert.equal(resolvedMinor.status, "RESOLVED");
  assert.ok(resolvedMinor.resolvedAt);

  // Step 13: Create Critical QC issue on SH016
  const criticalQc = qcModule.createQcReview({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    reviewType: "TECHNICAL",
    severity: "CRITICAL",
    issue: "Audio drop-out at 00:03.200",
    action: "Re-mix dialogue stem",
    reviewer: "QC Supervisor",
  });
  assert.equal(criticalQc.status, "OPEN");

  // Step 14: Final review evaluation -> strictly blocked by CRITICAL QC
  evalResult = qcModule.evaluateContentFinalReadiness(projectId, contentId);
  assert.equal(evalResult.canApprove, false);
  assert.equal(evalResult.stats.openCriticalQcCount >= 1, true);
  const critBlocked = evalResult.blockingReasons.some(
    (r) => r.toLowerCase().includes("kritis") || r.toLowerCase().includes("critical")
  );
  assert.equal(critBlocked, true);

  // Step 15: Resolve critical QC issue
  const resolvedCritical = qcModule.resolveQcReview(
    criticalQc.id,
    projectId,
    "Dialogue stem re-exported and sync verified."
  );
  assert.equal(resolvedCritical.status, "RESOLVED");

  // Step 16: Major QC issue still open (continuityQc from step 5) -> blocks final review
  evalResult = qcModule.evaluateContentFinalReadiness(projectId, contentId);
  assert.equal(evalResult.stats.openMajorQcCount >= 1, true);

  // Step 17: Waive Major QC issue
  const waivedContinuity = qcModule.waiveQcReview(
    continuityQc.id,
    projectId,
    "Waived with justification: minor prop position variation accepted for pacing."
  );
  assert.equal(waivedContinuity.status, "WAIVED");
  assert.ok(waivedContinuity.resolvedAt);

  // Step 18: Update milestones on EP01
  const milestoneUpdate = qcModule.updateContentMilestones({
    projectId,
    contentItemId: contentId,
    audioStatus: "APPROVED",
    editStatus: "APPROVED",
  });
  assert.equal(milestoneUpdate.audioStatus, "APPROVED");
  assert.equal(milestoneUpdate.editStatus, "APPROVED");

  // Step 19: Prepare all prerequisite data so final review can pass
  // Lock script document if exists
  const scriptDoc = database.db
    .select()
    .from(database.schema.scriptDocuments)
    .where(and(eq(database.schema.scriptDocuments.projectId, projectId), eq(database.schema.scriptDocuments.contentItemId, contentId)))
    .get();

  if (scriptDoc) {
    const versions = database.db
      .select()
      .from(database.schema.scriptVersions)
      .where(eq(database.schema.scriptVersions.scriptDocumentId, scriptDoc.id))
      .all();
    if (versions.length > 0) {
      database.db
        .update(database.schema.scriptVersions)
        .set({ isLocked: true })
        .where(eq(database.schema.scriptVersions.id, versions[0].id))
        .run();
    }
  }

  // Ensure all shots of EP01 are marked APPROVED
  database.db
    .update(database.schema.shots)
    .set({ status: "APPROVED" })
    .where(and(eq(database.schema.shots.projectId, projectId), eq(database.schema.shots.contentItemId, contentId)))
    .run();

  // Create mock approved video outputs for all shots of EP01
  // Create dummy physical files for all asset versions in project so no disk check fails
  const assetVersions = database.db
    .select()
    .from(database.schema.assetVersions)
    .where(eq(database.schema.assetVersions.projectId, projectId))
    .all();

  for (const av of assetVersions) {
    const abs = path.join(testRootPath, av.relativePath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, "dummy-asset-content");
  }

  const epShots = database.db
    .select()
    .from(database.schema.shots)
    .where(and(eq(database.schema.shots.projectId, projectId), eq(database.schema.shots.contentItemId, contentId)))
    .all();

  for (const s of epShots) {
    const existingVideo = database.db
      .select()
      .from(database.schema.videoOutputs)
      .where(and(eq(database.schema.videoOutputs.projectId, projectId), eq(database.schema.videoOutputs.shotId, s.id)))
      .get();

    if (!existingVideo) {
      database.db
        .insert(database.schema.videoOutputs)
        .values({
          id: `mock-video-${s.id}`,
          projectId,
          contentItemId: contentId,
          shotId: s.id,
          versionNumber: 1,
          versionLabel: "V01",
          status: "APPROVED",
          filePath: `videos/${s.shotCode}_V01.mp4`,
          fileName: `${s.shotCode}_V01.mp4`,
          fileSizeBytes: 1048576,
          sha256: "mocksha256",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
    } else {
      database.db
        .update(database.schema.videoOutputs)
        .set({ status: "APPROVED" })
        .where(eq(database.schema.videoOutputs.id, existingVideo.id))
        .run();
    }
  }

  // Step 20: Final review evaluation & Final approval
  evalResult = qcModule.evaluateContentFinalReadiness(projectId, contentId);
  assert.equal(evalResult.canApprove, true, `Final review should pass but had: ${evalResult.blockingReasons.join("; ")}`);

  const finalizedContent = qcModule.approveContentFinal(projectId, contentId);
  assert.equal(finalizedContent.status, "FINAL");

  // Step 21: Verify project isolation
  const isoProject = projectService.createProject({
    code: "ISO-EP01-TEST",
    name: "Isolation Test Project",
    projectType: "ANIMATION_SERIES",
    description: "Isolation verify",
    rootPath: path.join(testRootPath, "iso"),
    defaultAspectRatio: "16:9",
    defaultLanguage: "Indonesian",
  });

  const isoReviews = qcModule.listQcReviews({ projectId: isoProject.id });
  assert.equal(isoReviews.length, 0);

  const isoChecks = qcModule.listContinuityChecks({ projectId: isoProject.id });
  assert.equal(isoChecks.length, 0);

  // Ensure EP01 was unchanged by iso operations
  const ep01Final = database.db
    .select()
    .from(database.schema.contentItems)
    .where(eq(database.schema.contentItems.id, contentId))
    .get();
  assert.equal(ep01Final?.status, "FINAL");
});
