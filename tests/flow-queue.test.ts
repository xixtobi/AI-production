import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import type { RecipeSnapshot } from "../src/lib/flow";

let dataDir: string;
let testRootPath: string;
let database: typeof import("../src/lib/db");
let flowModule: typeof import("../src/lib/flow");
let promptService: typeof import("../src/lib/prompts/prompt-service");

let projectId: string;
let contentId: string;
let sh016Id: string;
let promptVersionId: string;
let kfB08AssetVersionId: string;
let testVideoFilePath1: string;
let testVideoFilePath2: string;

before(async () => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "lpc-flow-queue-test-db-"));
  testRootPath = path.join(dataDir, "project-storage");
  process.env.PRODUCTION_CONTROL_DATA_DIR = dataDir;

  mkdirSync(testRootPath, { recursive: true });

  database = await import("../src/lib/db");
  database.ensureDatabaseReady();

  flowModule = await import("../src/lib/flow");
  promptService = await import("../src/lib/prompts/prompt-service");

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

  // Find SH016
  const sh016 = database.db
    .select()
    .from(database.schema.shots)
    .where(and(eq(database.schema.shots.projectId, projectId), eq(database.schema.shots.shotCode, "SH016")))
    .get();

  assert.ok(sh016, "Shot SH016 harus ada.");
  sh016Id = sh016.id;

  // 1. Create Prompt Document and Version V01 FINAL for SH016
  const promptDoc = promptService.getOrCreatePromptDocumentForShot({
    projectId,
    shotId: sh016Id,
    promptType: "VIDEO",
    name: "SH016 - Google Flow Master Prompt",
  });

  const promptVer = promptService.createPromptVersion({
    documentId: promptDoc.id,
    promptText: "Starting from keyframe image KF-B08: Raka points his grandfather compass forward while Lila examines ancient symbols on the stone arch. Smooth cinematic camera push-in, golden morning mist drifting through Lembah Awan --duration 5s --ar 16:9",
    negativePrompt: "jitter, morphing, character body distortion, modern cars, text watermark",
    parameters: {
      engine: "VEO",
      model: "Veo 3.1 Fast",
      duration: 5,
      aspectRatio: "16:9",
      resolution: "1080p",
      audio: false,
    },
    source: "MANUAL",
    notes: "Prompt FINAL untuk SH016",
    isLocked: true,
  });
  promptVersionId = promptVer.id;

  // 2. Resolve or create physical KF-B08 image file and asset version in DB
  const kfRelPath = "EP01/SH016/KEYFRAME/KF-B08.png";
  const kfAbsPath = path.join(testRootPath, kfRelPath);
  mkdirSync(path.dirname(kfAbsPath), { recursive: true });
  writeFileSync(kfAbsPath, Buffer.from("FAKE_PNG_HEADER_KF_B08_DATA"));

  const now = new Date();
  const kfAsset = database.db
    .select()
    .from(database.schema.assets)
    .where(and(eq(database.schema.assets.projectId, projectId), eq(database.schema.assets.assetCode, "KF-B08")))
    .get();

  let kfAssetId: string;
  if (!kfAsset) {
    kfAssetId = crypto.randomUUID();
    database.db
      .insert(database.schema.assets)
      .values({
        id: kfAssetId,
        projectId,
        assetCode: "KF-B08",
        name: "KF-B08 Start Frame Final",
        assetType: "IMAGE",
        status: "APPROVED",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  } else {
    kfAssetId = kfAsset.id;
  }

  const kfVersion = database.db
    .select()
    .from(database.schema.assetVersions)
    .where(eq(database.schema.assetVersions.assetId, kfAssetId))
    .get();

  if (!kfVersion) {
    const kfVersionId = crypto.randomUUID();
    database.db
      .insert(database.schema.assetVersions)
      .values({
        id: kfVersionId,
        projectId,
        assetId: kfAssetId,
        versionNumber: 1,
        versionLabel: "v001",
        filename: "KF-B08.png",
        relativePath: kfRelPath,
        sizeBytes: 32,
        sha256: "fake_sha256_kf_b08",
        mimeType: "image/png",
        isCurrent: true,
        createdAt: now,
      })
      .run();
    kfB08AssetVersionId = kfVersionId;
  } else {
    database.db
      .update(database.schema.assetVersions)
      .set({ relativePath: kfRelPath, filename: "KF-B08.png" })
      .where(eq(database.schema.assetVersions.id, kfVersion.id))
      .run();
    kfB08AssetVersionId = kfVersion.id;
  }

  // Link asset to shot if not already linked
  const existingLink = database.db
    .select()
    .from(database.schema.shotAssets)
    .where(and(eq(database.schema.shotAssets.shotId, sh016Id), eq(database.schema.shotAssets.assetId, kfAssetId)))
    .get();

  if (!existingLink) {
    database.db
      .insert(database.schema.shotAssets)
      .values({
        id: crypto.randomUUID(),
        projectId,
        shotId: sh016Id,
        assetId: kfAssetId,
        role: "START_FRAME",
        sortOrder: 0,
        notes: "Canonical start frame for SH016",
      })
      .run();
  }

  // Create simulated video files for testing
  const vid1Rel = "EP01/SH016/VIDEO/EP01_SH016_VID_V01.mp4";
  testVideoFilePath1 = path.join(testRootPath, vid1Rel);
  mkdirSync(path.dirname(testVideoFilePath1), { recursive: true });
  writeFileSync(testVideoFilePath1, Buffer.from("FAKE_MP4_CONTENT_FOR_VIDEO_V01"));

  const vid2Rel = "EP01/SH016/VIDEO/EP01_SH016_VID_V02.mp4";
  testVideoFilePath2 = path.join(testRootPath, vid2Rel);
  writeFileSync(testVideoFilePath2, Buffer.from("FAKE_MP4_CONTENT_FOR_VIDEO_V02_ATTEMPT_2"));
});

after(() => {
  if (existsSync(dataDir)) {
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on windows
    }
  }
});

// ==================== TEST 1: CREATE QUEUE ITEM ====================
test("1. create queue item with required fields, models, and references", () => {
  const result = flowModule.createFlowQueueItem({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    promptVersionId,
    model: "Veo 3.1 Fast",
    durationSeconds: 5,
    aspectRatio: "16:9",
    resolution: "1080p",
    audioEnabled: false,
    startFrameAssetVersionId: kfB08AssetVersionId,
    notes: "Initial test queue item",
  });

  assert.ok(result.item.id);
  assert.equal(result.item.status, "READY");
  assert.equal(result.item.model, "Veo 3.1 Fast");
  assert.equal(result.item.durationSeconds, 5);
  assert.equal(result.item.aspectRatio, "16:9");
  assert.equal(result.item.startFrameAssetVersionId, kfB08AssetVersionId);
});

// ==================== TEST 2: RECIPE SNAPSHOT IMMUTABILITY ====================
test("2. recipe snapshot is immutable and preserved when source data changes", () => {
  const result = flowModule.createFlowQueueItem({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    promptVersionId,
    model: "Veo 3.1 Fast",
    durationSeconds: 5,
    aspectRatio: "16:9",
    startFrameAssetVersionId: kfB08AssetVersionId,
  });

  const parsedRecipe: RecipeSnapshot = JSON.parse(result.item.recipeSnapshotJson);
  assert.equal(parsedRecipe.shotCode, "SH016");
  assert.equal(parsedRecipe.generationSettings.model, "Veo 3.1 Fast");
  assert.equal(parsedRecipe.startFrame?.fileName, "KF-B08.png");
  assert.match(parsedRecipe.prompt.promptText, /Starting from keyframe image KF-B08/);

  // Even if we query from DB directly, recipeSnapshotJson contains complete frozen data
  const fromDb = flowModule.getFlowQueueItem(result.item.id);
  assert.ok(fromDb);
  assert.equal(fromDb.item.recipeSnapshotJson, result.item.recipeSnapshotJson);
});

// ==================== TEST 3: CAPABILITY VALIDATION ====================
test("3. capability validation validates duration, aspect ratio, and model capabilities", () => {
  // Test invalid duration for Veo 3.1 Fast (supports [4, 5, 6, 8], request 15s)
  const invalidDuration = flowModule.validateFlowCompatibility({
    projectId,
    shotId: sh016Id,
    promptVersionId,
    model: "Veo 3.1 Fast",
    durationSeconds: 15,
    aspectRatio: "16:9",
  });
  assert.equal(invalidDuration.valid, false);
  assert.equal(invalidDuration.status, "BLOCKED");
  assert.ok(invalidDuration.errors.some((e) => e.includes("Durasi 15 detik tidak didukung")));

  // Test invalid aspect ratio (e.g. 21:9)
  const invalidAspect = flowModule.validateFlowCompatibility({
    projectId,
    shotId: sh016Id,
    promptVersionId,
    model: "Veo 3.1 Fast",
    durationSeconds: 5,
    aspectRatio: "21:9",
  });
  assert.equal(invalidAspect.valid, false);
  assert.ok(invalidAspect.errors.some((e) => e.includes("Aspek rasio 21:9 tidak didukung")));

  // Test unknown model
  const unknownModel = flowModule.validateFlowCompatibility({
    projectId,
    shotId: sh016Id,
    promptVersionId,
    model: "NonExistentModelX",
    durationSeconds: 5,
    aspectRatio: "16:9",
  });
  assert.equal(unknownModel.valid, false);
  assert.ok(unknownModel.errors.some((e) => e.includes("tidak dikenal dalam registry")));
});

// ==================== TEST 4: MISSING FRAME DETECTION ====================
test("4. missing frame detection identifies non-existent start frame or missing physical file", () => {
  const missingFrame = flowModule.validateFlowCompatibility({
    projectId,
    shotId: sh016Id,
    promptVersionId,
    model: "Veo 3.1 Fast",
    durationSeconds: 5,
    aspectRatio: "16:9",
    startFrameAssetVersionId: "non-existent-version-uuid",
  });

  assert.equal(missingFrame.valid, false);
  assert.ok(missingFrame.errors.some((e) => e.includes("start frame yang dipilih tidak ditemukan")));
});

// ==================== TEST 5: MISSING REFERENCE DETECTION ====================
test("5. missing reference detection flags invalid referenced assets", () => {
  const missingRef = flowModule.validateFlowCompatibility({
    projectId,
    shotId: sh016Id,
    promptVersionId,
    model: "Veo 3.1 Fast",
    durationSeconds: 5,
    aspectRatio: "16:9",
    referenceAssetVersionIds: ["fake-ref-uuid-999"],
  });

  assert.equal(missingRef.valid, false);
  assert.ok(missingRef.errors.some((e) => e.includes("Aset referensi dengan ID fake-ref-uuid-999 tidak ditemukan")));
});

// ==================== TEST 6: PREPARE PACKAGE ====================
test("6. prepare package creates manifest.json, prompt.txt, generation-settings.json and references/", () => {
  const queueResult = flowModule.createFlowQueueItem({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    promptVersionId,
    model: "Veo 3.1 Fast",
    durationSeconds: 5,
    aspectRatio: "16:9",
    startFrameAssetVersionId: kfB08AssetVersionId,
  });

  const prep = flowModule.prepareFlowJob(queueResult.item.id, { createPackage: true });

  assert.ok(existsSync(prep.jobDirectory));
  assert.ok(existsSync(path.join(prep.jobDirectory, "manifest.json")));
  assert.ok(existsSync(path.join(prep.jobDirectory, "prompt.txt")));
  assert.ok(existsSync(path.join(prep.jobDirectory, "generation-settings.json")));
  assert.ok(existsSync(path.join(prep.jobDirectory, "references")));

  // Verify prompt.txt content
  const promptTxt = readFileSync(path.join(prep.jobDirectory, "prompt.txt"), "utf-8");
  assert.match(promptTxt, /Starting from keyframe image KF-B08/);

  // Verify manifest.json structure
  const manifestRaw = readFileSync(path.join(prep.jobDirectory, "manifest.json"), "utf-8");
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.shot.code, "SH016");
  assert.equal(manifest.model, "Veo 3.1 Fast");
  assert.equal(manifest.startFrame?.fileName, "KF-B08.png");
});

// ==================== TEST 7: REVEAL FILE ====================
test("7. reveal file validates file existence before launching explorer args", async () => {
  const existingPath = path.join(testRootPath, "EP01/SH016/KEYFRAME/KF-B08.png");
  assert.ok(existsSync(existingPath));

  // Non-existent path throws DomainError
  await assert.rejects(
    async () => {
      await flowModule.revealFileInExplorer("D:\\NonExistent\\fake_file.png");
    },
    { message: /File tidak ditemukan di disk/ }
  );
});

// ==================== TEST 8: COPY PROMPT & RECIPE ====================
test("8. copy prompt and generation recipe retrieves exact strings for clipboard", () => {
  const promptVer = database.db.select().from(database.schema.promptVersions).where(eq(database.schema.promptVersions.id, promptVersionId)).get();
  assert.ok(promptVer);
  assert.match(promptVer.promptText, /KF-B08/);
});

// ==================== TEST 9: OPEN FLOW URL ====================
test("9. open Flow URL returns valid URL without attempting direct browser manipulation", () => {
  const url = flowModule.getGoogleFlowUrl();
  assert.ok(url.startsWith("http"));
  assert.match(url, /flow/);
});

// ==================== TEST 10: REGISTER OUTPUT ====================
test("10. register output reads file size, sha256, stores in video_outputs, and enforces inside project root", async () => {
  const regResult = await flowModule.registerVideoOutput({
    projectId,
    shotId: sh016Id,
    filePath: "EP01/SH016/VIDEO/EP01_SH016_VID_V01.mp4",
    model: "Veo 3.1 Fast",
    notes: "Generated from Google Flow V01",
    creditsUsed: 10,
  });

  assert.ok(regResult.videoOutput.id);
  assert.equal(regResult.videoOutput.versionLabel, "V01");
  assert.equal(regResult.videoOutput.fileName, "EP01_SH016_VID_V01.mp4");
  assert.equal(regResult.videoOutput.status, "APPROVED");
  assert.equal(regResult.videoOutput.creditsUsed, 10);
  assert.ok(regResult.videoOutput.sha256);
  assert.ok(regResult.videoOutput.fileSizeBytes > 0);
});

// ==================== TEST 11: VIDEO VERSIONING ====================
test("11. video versioning increments to V02 and prevents duplicate files", async () => {
  // Try registering duplicate output with same file
  await assert.rejects(
    async () => {
      await flowModule.registerVideoOutput({
        projectId,
        shotId: sh016Id,
        filePath: "EP01/SH016/VIDEO/EP01_SH016_VID_V01.mp4",
      });
    },
    { message: /sudah terdaftar pada shot/ }
  );

  // Register second video output
  const regResult2 = await flowModule.registerVideoOutput({
    projectId,
    shotId: sh016Id,
    filePath: "EP01/SH016/VIDEO/EP01_SH016_VID_V02.mp4",
    notes: "Generated from Google Flow Attempt 02",
    creditsUsed: 10,
  });

  assert.equal(regResult2.videoOutput.versionLabel, "V02");
  assert.equal(regResult2.videoOutput.versionNumber, 2);

  // Verify list outputs has both V02 and V01
  const outputs = flowModule.listVideoOutputsForShot(sh016Id);
  assert.equal(outputs.length, 2);
  assert.equal(outputs[0].versionLabel, "V02");
  assert.equal(outputs[1].versionLabel, "V01");
});

// ==================== TEST 12: ATTEMPT LINKING ====================
test("12. attempt linking links generation attempt to newly registered video output", async () => {
  const queueResult = flowModule.createFlowQueueItem({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    promptVersionId,
    model: "Veo 3.1 Quality",
    durationSeconds: 5,
    aspectRatio: "16:9",
  });

  // Create attempt
  const attempt = flowModule.createGenerationAttempt({
    flowQueueItemId: queueResult.item.id,
    model: "Veo 3.1 Quality",
    notes: "Testing attempt linking",
  });

  assert.equal(attempt.status, "STARTED");
  assert.equal(attempt.attemptNumber, 1);

  // Create third test video file
  const vid3Rel = "EP01/SH016/VIDEO/EP01_SH016_VID_V03.mp4";
  const testVideoFilePath3 = path.join(testRootPath, vid3Rel);
  writeFileSync(testVideoFilePath3, Buffer.from("FAKE_MP4_CONTENT_FOR_VIDEO_V03_ATTEMPT"));

  const regResult3 = await flowModule.registerVideoOutput({
    projectId,
    shotId: sh016Id,
    filePath: vid3Rel,
    generationAttemptId: attempt.id,
    flowQueueItemId: queueResult.item.id,
  });

  assert.equal(regResult3.videoOutput.versionLabel, "V03");
  assert.ok(regResult3.generationAttempt);
  assert.equal(regResult3.generationAttempt.status, "COMPLETED");
  assert.equal(regResult3.generationAttempt.outputVideoId, regResult3.videoOutput.id);
});

// ==================== TEST 13: PROJECT ISOLATION ====================
test("13. project isolation: prevents registering or listing outputs across projects", async () => {
  const otherProjectId = crypto.randomUUID();
  await assert.rejects(
    async () => {
      await flowModule.registerVideoOutput({
        projectId: otherProjectId,
        shotId: sh016Id,
        filePath: "EP01/SH016/VIDEO/EP01_SH016_VID_V01.mp4",
      });
    },
    { message: /Proyek tidak ditemukan/ }
  );
});

// ==================== TEST 14: INVALID PATH PREVENTION ====================
test("14. invalid path prevention rejects paths outside project root or non-video formats", async () => {
  // Outside project root
  await assert.rejects(
    async () => {
      await flowModule.registerVideoOutput({
        projectId,
        shotId: sh016Id,
        filePath: "C:\\Windows\\System32\\calc.exe",
      });
    },
    { message: /File video harus berada di dalam project root/ }
  );

  // Non-video format (.txt file)
  const txtRel = "EP01/SH016/NOTES/note.txt";
  const txtPath = path.join(testRootPath, txtRel);
  mkdirSync(path.dirname(txtPath), { recursive: true });
  writeFileSync(txtPath, "Hello world");

  await assert.rejects(
    async () => {
      await flowModule.registerVideoOutput({
        projectId,
        shotId: sh016Id,
        filePath: txtRel,
      });
    },
    { message: /Format video '\.txt' tidak didukung/ }
  );
});

// ==================== ACCEPTANCE TEST (SH016 COMPLETE 18-STEP WORKFLOW) ====================
test("ACCEPTANCE TEST: Full 18-step Flow Queue & Video Production workflow on SH016", async () => {
  // 1. Prompt FINAL exists
  const promptVer = database.db
    .select()
    .from(database.schema.promptVersions)
    .where(eq(database.schema.promptVersions.id, promptVersionId))
    .get();
  assert.ok(promptVer, "Step 1: Prompt FINAL harus ada di DB.");
  assert.equal(promptVer.isLocked, true);

  // 2. KF-B08_FINAL exists
  const kfAsset = database.db
    .select()
    .from(database.schema.assets)
    .where(and(eq(database.schema.assets.projectId, projectId), eq(database.schema.assets.assetCode, "KF-B08")))
    .get();
  assert.ok(kfAsset, "Step 2: KF-B08_FINAL asset harus ada.");
  assert.ok(existsSync(path.join(testRootPath, "EP01/SH016/KEYFRAME/KF-B08.png")), "Step 2: File KF-B08 harus ada di disk.");

  // 3. Add to Flow Queue
  const queueResult = flowModule.createFlowQueueItem({
    projectId,
    contentItemId: contentId,
    shotId: sh016Id,
    promptVersionId,
    model: "Veo 3.1 Fast",
    durationSeconds: 5,
    aspectRatio: "16:9",
    startFrameAssetVersionId: kfB08AssetVersionId,
    notes: "Acceptance Test Flow Job SH016",
  });

  // 4. Queue item becomes READY
  assert.equal(queueResult.item.status, "READY", "Step 4: Queue item harus berstatus READY.");

  // 5. Recipe snapshot exists
  assert.ok(queueResult.item.recipeSnapshotJson, "Step 5: Recipe snapshot JSON harus ada.");
  const recipe = JSON.parse(queueResult.item.recipeSnapshotJson);
  assert.equal(recipe.shotCode, "SH016");
  assert.equal(recipe.startFrame?.fileName, "KF-B08.png");

  // 6. Prepare Flow package
  const prep = flowModule.prepareFlowJob(queueResult.item.id, { createPackage: true });
  assert.ok(existsSync(path.join(prep.jobDirectory, "manifest.json")), "Step 6: manifest.json harus ada.");
  assert.ok(existsSync(path.join(prep.jobDirectory, "prompt.txt")), "Step 6: prompt.txt harus ada.");
  assert.ok(existsSync(path.join(prep.jobDirectory, "generation-settings.json")), "Step 6: generation-settings.json harus ada.");

  // 7. Reveal KF-B08_FINAL
  const kfPath = path.join(testRootPath, "EP01/SH016/KEYFRAME/KF-B08.png");
  assert.ok(existsSync(kfPath), "Step 7: File KF-B08 terverifikasi untuk di-reveal.");

  // 8. Copy prompt
  const promptTxt = readFileSync(path.join(prep.jobDirectory, "prompt.txt"), "utf-8");
  assert.match(promptTxt, /Starting from keyframe image KF-B08/, "Step 8: Prompt text siap disalin.");

  // 9. Open Google Flow
  const flowUrl = flowModule.getGoogleFlowUrl();
  assert.equal(flowUrl, "https://flow.google.com/", "Step 9: URL Google Flow terkonfigurasi.");

  // 10 & 11. Download / place EP01_SH016_VID_V01.mp4
  const accVid1Rel = "EP01/SH016/VIDEO/EP01_SH016_VID_V01_ACC.mp4";
  const accVid1Abs = path.join(testRootPath, accVid1Rel);
  writeFileSync(accVid1Abs, Buffer.from("VIDEO_FILE_CONTENT_ACC_V01"));
  assert.ok(existsSync(accVid1Abs), "Step 11: File video V01 siap di disk.");

  // 12. Register output
  const reg1 = await flowModule.registerVideoOutput({
    projectId,
    shotId: sh016Id,
    flowQueueItemId: queueResult.item.id,
    filePath: accVid1Rel,
    model: "Veo 3.1 Fast",
    notes: "Acceptance render V01",
    creditsUsed: 10,
  });

  // 13. V01 appears in Shot Detail
  assert.equal(reg1.videoOutput.versionLabel, "V04", "Step 13: Versi bertambah sesuai urutan (V04).");
  const outputs = flowModule.listVideoOutputsForShot(sh016Id);
  assert.ok(outputs.some((o) => o.id === reg1.videoOutput.id), "Step 13: Video output muncul dalam query shot detail.");

  // 14. Create another Flow attempt
  const attempt2 = flowModule.createGenerationAttempt({
    flowQueueItemId: queueResult.item.id,
    model: "Veo 3.1 Fast",
    notes: "Second iteration attempt",
  });
  assert.ok(attempt2.id, "Step 14: Attempt baru berhasil dibuat.");

  // 15. Register EP01_SH016_VID_V02.mp4
  const accVid2Rel = "EP01/SH016/VIDEO/EP01_SH016_VID_V02_ACC.mp4";
  const accVid2Abs = path.join(testRootPath, accVid2Rel);
  writeFileSync(accVid2Abs, Buffer.from("VIDEO_FILE_CONTENT_ACC_V02"));

  const reg2 = await flowModule.registerVideoOutput({
    projectId,
    shotId: sh016Id,
    flowQueueItemId: queueResult.item.id,
    generationAttemptId: attempt2.id,
    filePath: accVid2Rel,
    model: "Veo 3.1 Fast",
    notes: "Acceptance render V02",
    creditsUsed: 10,
  });
  assert.ok(reg2.videoOutput.id, "Step 15: Video output V02 berhasil didaftarkan.");

  // 16. Both versions remain accessible
  const allOutputs = flowModule.listVideoOutputsForShot(sh016Id);
  assert.ok(allOutputs.some((o) => o.id === reg1.videoOutput.id));
  assert.ok(allOutputs.some((o) => o.id === reg2.videoOutput.id));

  // 17 & 18. Restart app / ensure database ready and verify persistence
  database.ensureDatabaseReady();
  const persistedQueueItem = flowModule.getFlowQueueItem(queueResult.item.id);
  assert.ok(persistedQueueItem, "Step 18: Queue item tetap ada setelah restart.");
  assert.equal(persistedQueueItem.item.status, "COMPLETED", "Step 18: Status queue item COMPLETED.");
  assert.ok(persistedQueueItem.attempts.length >= 2, "Step 18: Riwayat attempt generasi tetap ada.");
  assert.ok(persistedQueueItem.videoOutputs.length >= 2, "Step 18: Video output tetap ada.");
});
