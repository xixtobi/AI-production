import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";

let dataDir: string;
let testRootPath: string;
let database: typeof import("../src/lib/db");
let geminiClient: typeof import("../src/lib/gemini/client");
let promptService: typeof import("../src/lib/prompts/prompt-service");
let templateService: typeof import("../src/lib/prompts/template-service");
let promptAiService: typeof import("../src/lib/prompts/prompt-ai-service");
let flowQueueService: typeof import("../src/lib/prompts/flow-queue-service");
let contextBuilder: typeof import("../src/lib/gemini/context-builder");

let projectId: string;
let sh016Id: string;
let kfB08AssetId: string;

before(async () => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "lpc-prompt-studio-test-db-"));
  testRootPath = path.join(dataDir, "project-storage");
  process.env.PRODUCTION_CONTROL_DATA_DIR = dataDir;

  database = await import("../src/lib/db");
  database.ensureDatabaseReady();

  geminiClient = await import("../src/lib/gemini/client");
  promptService = await import("../src/lib/prompts/prompt-service");
  templateService = await import("../src/lib/prompts/template-service");
  promptAiService = await import("../src/lib/prompts/prompt-ai-service");
  flowQueueService = await import("../src/lib/prompts/flow-queue-service");
  contextBuilder = await import("../src/lib/gemini/context-builder");

  // Fetch seeded project LEMBAH-AWAN
  const project = database.db
    .select()
    .from(database.schema.projects)
    .where(eq(database.schema.projects.code, "LEMBAH-AWAN"))
    .get();

  assert.ok(project, "Proyek Lembah Awan harus ter-seed otomatis.");
  projectId = project.id;

  // Update rootPath to testRootPath for clean filesystem isolation
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

  const sh016 = database.db
    .select()
    .from(database.schema.shots)
    .where(and(eq(database.schema.shots.projectId, projectId), eq(database.schema.shots.shotCode, "SH016")))
    .get();

  assert.ok(sh016, "Shot SH016 harus ter-seed otomatis.");
  sh016Id = sh016.id;

  const kfB08 = database.db
    .select()
    .from(database.schema.assets)
    .where(and(eq(database.schema.assets.projectId, projectId), eq(database.schema.assets.assetCode, "KF-B08")))
    .get();

  assert.ok(kfB08, "Asset KF-B08 harus ter-seed otomatis.");
  kfB08AssetId = kfB08.id;
});

after(() => {
  geminiClient.resetGeminiClientOverride();
  delete process.env.GEMINI_API_KEY;
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {}
});

// ==================== TEST 1: SH016 CONTEXT VERIFICATION ====================
test("1. SH016 context and reference asset linking (Acceptance Step 1 & 2)", () => {
  const ctx = contextBuilder.buildShotContext(projectId, sh016Id);

  // 1. Script action and dialogue
  assert.equal(ctx.shot.shotCode, "SH016");
  assert.match(ctx.shot.title, /Kompas/i);
  assert.match(ctx.shot.action, /Pak Arga/i);
  assert.match(ctx.shot.action, /kompas kuno/i);
  assert.match(ctx.shot.dialogue, /Pak Arga:/i);

  // 2. Start frame reference KF-B08
  const startFrameLink = ctx.linkedAssets.find((a) => a.link.role === "START_FRAME");
  assert.ok(startFrameLink, "Harus ada aset yang ditautkan sebagai START_FRAME.");
  assert.equal(startFrameLink.asset.assetCode, "KF-B08");
  assert.equal(startFrameLink.asset.id, kfB08AssetId);

  // 3. Style Bible & Environment
  assert.ok(ctx.styleBible, "Style Bible harus ada.");
  assert.match(ctx.styleBible, /3D|animation/i);
});

// ==================== TEST 2: BUILT-IN PROMPT TEMPLATES ====================
test("2. Built-in Prompt Templates are seeded (Animation & UGC)", () => {
  const templates = templateService.listPromptTemplates();
  assert.ok(templates.length >= 11, "Harus ada minimal 11 template bawaan.");

  const codes = templates.map((t) => t.code);
  assert.ok(codes.includes("IMAGE_ESTABLISHING"));
  assert.ok(codes.includes("IMAGE_CHARACTER"));
  assert.ok(codes.includes("IMAGE_ENVIRONMENT"));
  assert.ok(codes.includes("VIDEO_I2V_FAMILY_ADVENTURE"));
  assert.ok(codes.includes("VIDEO_DIALOGUE"));
  assert.ok(codes.includes("VIDEO_ACTION"));
  assert.ok(codes.includes("VIDEO_MYSTERY"));
  assert.ok(codes.includes("UGC_HOOK"));
  assert.ok(codes.includes("UGC_TALKING_HEAD"));
  assert.ok(codes.includes("UGC_PRODUCT"));
  assert.ok(codes.includes("UGC_BROLL"));
});

// ==================== TEST 3: APPLY TEMPLATE WITH AUTO-FILL ====================
test("3. Apply template VIDEO_I2V_FAMILY_ADVENTURE auto-fills placeholders from shot (Acceptance Step 3 & 4)", () => {
  const applied = templateService.applyTemplateToShot({
    templateIdOrCode: "VIDEO_I2V_FAMILY_ADVENTURE",
    shotId: sh016Id,
    projectId,
  });

  assert.ok(applied.promptText, "Teks prompt harus terisi.");
  assert.match(applied.promptText, /Starting from keyframe image KF-B08/i, "Placeholder start frame harus terisi KF-B08.");
  assert.match(applied.promptText, /Rumah Pak Arga/i, "Placeholder environment harus terisi.");
  assert.match(applied.promptText, /Pak Arga/i, "Placeholder aksi harus terisi.");
  assert.ok(applied.negativePrompt.length > 10, "Negative prompt template harus terisi.");
  assert.equal(applied.parameters.engine, "VEO");
});

// ==================== TEST 4: MANUAL OFFLINE STRUCTURED PROMPT COMPILATION ====================
test("4. Offline structured prompt compilation works completely without Gemini", () => {
  const compiledVideo = promptService.compileStructuredPrompt("VIDEO", {
    startFrameRef: "KF-B08",
    actionMovement: "Pak Arga opens the wooden box",
    cameraMotion: "Slow push-in, eye-level",
    speedPacing: "Cinematic calm",
    environmentDynamics: "Sunlight dust particles",
    moodTone: "Warm wonder",
    dialogueAudioCues: "Soft latch click",
    endFrameRef: "",
    negativeConstraints: "flickering, jitter",
  });

  assert.match(compiledVideo.promptText, /Starting from keyframe KF-B08/);
  assert.match(compiledVideo.promptText, /Pak Arga opens the wooden box/);
  assert.match(compiledVideo.promptText, /Slow push-in/);
  assert.equal(compiledVideo.negativePrompt, "flickering, jitter");

  const compiledImage = promptService.compileStructuredPrompt("IMAGE", {
    subject: "Pak Arga and children",
    actionPose: "inspecting the ancient compass",
    cameraFraming: "Medium two-shot",
    environmentBackground: "wooden workshop",
    lightingAtmosphere: "morning golden rays",
    styleRendering: "3D animation",
    qualityTags: "masterpiece, 8k",
    negativeConstraints: "blurry, low quality",
  });

  assert.match(compiledImage.promptText, /Pak Arga and children/);
  assert.match(compiledImage.promptText, /in wooden workshop/);
  assert.equal(compiledImage.negativePrompt, "blurry, low quality");
});

// ==================== TEST 5: GEMINI PROMPT GENERATION (ACCEPTANCE STEP 5) ====================
test("5. Gemini prompt generation with structured output and KF-B08 context (Acceptance Step 5)", async () => {
  let promptSentToGemini = "";
  let thinkingLevelUsed = "";

  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async (req: { contents: Array<{ text: string }> | string; config?: { thinkingConfig?: { thinkingLevel?: string } } }) => {
        promptSentToGemini = typeof req.contents === "string" ? req.contents : req.contents?.[0]?.text || "";
        thinkingLevelUsed = req.config?.thinkingConfig?.thinkingLevel || "";

        return {
          text: JSON.stringify({
            positivePrompt: "Starting from keyframe KF-B08: Pak Arga, a wise village archivist with gentle eyes, carefully lifts the ancient brass compass from its velvet box, as Raka and Lila lean forward in awe",
            negativePrompt: "jitter, morphing, sudden camera jerk, extra fingers, photorealistic human textures, modern elements",
            artStyle: "Storybook 3D family animation feature film quality, warm rendered textures",
            cameraAndComposition: "Medium two-shot slowly pushing in at children's eye-level",
            lighting: "Soft warm morning sunlight streaming through vintage wooden blinds, golden volumetric haze",
            motionDescription: "Subtle character breathing, gentle upward movement of compass, dust particles floating in light shafts",
            notes: "Prompt disusun berdasarkan referensi start frame KF-B08 dan karakter Pak Arga.",
          }),
          usageMetadata: { promptTokenCount: 140, candidatesTokenCount: 95 },
        };
      },
    },
  });

  const res = await promptAiService.generatePromptFromContext({
    projectId,
    shotId: sh016Id,
    thinkingLevel: "HIGH",
    targetEngine: "VEO",
    promptType: "VIDEO",
  });

  // Verify server-side call and structured output
  assert.ok(res.requestId, "AI request ID harus dihasilkan.");
  assert.match(res.result.positivePrompt, /Starting from keyframe KF-B08/);
  assert.match(res.result.artStyle, /3D family animation/i);
  assert.equal(thinkingLevelUsed, "HIGH");

  // Verify Style Bible and Start Frame KF-B08 were included in context sent to Gemini
  assert.match(promptSentToGemini, /KF-B08/);
  assert.match(promptSentToGemini, /STYLE BIBLE/i);
  assert.match(promptSentToGemini, /SH016/);

  // Verify request logged in ai_requests table
  const reqRow = database.db
    .select()
    .from(database.schema.aiRequests)
    .where(eq(database.schema.aiRequests.id, res.requestId))
    .get();

  assert.ok(reqRow);
  assert.equal(reqRow.status, "SUCCEEDED");
  assert.equal(reqRow.actionType, "GENERATE");
});

// ==================== TEST 6: ACCEPT GEMINI OUTPUT → V01 (ACCEPTANCE STEPS 6 & 7 & 13) ====================
let v01Id: string;
test("6. Accept Gemini output saved as V01 and writes local file (Acceptance Steps 6, 7 & 13)", () => {
  const doc = promptService.getOrCreatePromptDocumentForShot({ projectId, shotId: sh016Id });

  const v01Text = "Starting from keyframe KF-B08: Pak Arga, a wise village archivist with gentle eyes, carefully lifts the ancient brass compass from its velvet box, as Raka and Lila lean forward in awe";
  const v01Negative = "jitter, morphing, sudden camera jerk, extra fingers, photorealistic human textures";

  const v01 = promptService.createPromptVersion({
    documentId: doc.id,
    promptText: v01Text,
    negativePrompt: v01Negative,
    parameters: {
      engine: "VEO",
      aspectRatio: "16:9",
      duration: 4,
      resolution: "1080p",
      audio: false,
    },
    source: "GEMINI",
    notes: "Accepted from Gemini 3.8 Flash generation",
    forceNewVersion: true,
  });

  v01Id = v01.id;
  assert.equal(v01.versionNumber, 1);
  assert.equal(v01.versionLabel, "V01");
  assert.equal(v01.isCurrent, true);
  assert.equal(v01.isLocked, false);
  assert.equal(v01.source, "GEMINI");

  // Verify local file creation: <CONTENT_ROOT>/<SHOT_CODE>/PROMPT/V01.md
  assert.ok(v01.localFilePath, "localFilePath harus tercatat di database.");
  assert.ok(existsSync(v01.localFilePath), `File lokal ${v01.localFilePath} harus ada di disk.`);

  const fileContent = readFileSync(v01.localFilePath, "utf8");
  assert.match(fileContent, /version: "V01"/);
  assert.match(fileContent, /source: "GEMINI"/);
  assert.match(fileContent, /engine: "VEO"/);
  assert.match(fileContent, /# Prompt \(V01\)/);
  assert.match(fileContent, /Starting from keyframe KF-B08/);
  assert.match(fileContent, /## Negative Prompt/);
});

// ==================== TEST 7: EDIT PROMPT MANUALLY → V02 (ACCEPTANCE STEPS 8, 9 & 13) ====================
let v02Id: string;
test("7. Edit prompt manually creates V02 with separate local file (Acceptance Steps 8, 9 & 13)", () => {
  const doc = promptService.getOrCreatePromptDocumentForShot({ projectId, shotId: sh016Id });

  // Manual camera motion adjustment
  const v02Text = "Starting from keyframe KF-B08: Pak Arga lifts the ancient brass compass. Dynamic slow camera orbit turning 15 degrees right, warm golden lighting reveals Raka's widened eyes.";
  const v02Negative = "jitter, morphing, sudden camera jerk, extra fingers";

  const v02 = promptService.createPromptVersion({
    documentId: doc.id,
    promptText: v02Text,
    negativePrompt: v02Negative,
    parameters: {
      engine: "VEO",
      aspectRatio: "16:9",
      duration: 4,
      resolution: "1080p",
      audio: false,
    },
    source: "MANUAL",
    notes: "Manual camera motion adjustment (orbit 15 deg)",
    forceNewVersion: true,
  });

  v02Id = v02.id;
  assert.equal(v02.versionNumber, 2);
  assert.equal(v02.versionLabel, "V02");
  assert.equal(v02.isCurrent, true);
  assert.equal(v02.source, "MANUAL");

  // Verify V01 is now isCurrent = false
  const prevV01 = database.db.select().from(database.schema.promptVersions).where(eq(database.schema.promptVersions.id, v01Id)).get();
  assert.equal(prevV01?.isCurrent, false);

  // Verify local file V02.md
  assert.ok(v02.localFilePath && existsSync(v02.localFilePath));
  const v02FileContent = readFileSync(v02.localFilePath, "utf8");
  assert.match(v02FileContent, /version: "V02"/);
  assert.match(v02FileContent, /source: "MANUAL"/);
  assert.match(v02FileContent, /Dynamic slow camera orbit/);
});

// ==================== TEST 8: COMPARE V01 AND V02 (ACCEPTANCE STEP 10) ====================
test("8. Compare V01 and V02 side-by-side (Acceptance Step 10)", () => {
  const comp = promptService.comparePromptVersions(v01Id, v02Id);

  assert.equal(comp.versionA.versionLabel, "V01");
  assert.equal(comp.versionB.versionLabel, "V02");
  assert.equal(comp.sourceDifference.changed, true);
  assert.equal(comp.sourceDifference.sourceA, "GEMINI");
  assert.equal(comp.sourceDifference.sourceB, "MANUAL");

  // Verify prompt text differences detected
  assert.ok(comp.promptTextDiff.length > 0);
  const hasAdd = comp.promptTextDiff.some((d) => d.type === "add");
  const hasRemove = comp.promptTextDiff.some((d) => d.type === "remove");
  assert.ok(hasAdd && hasRemove, "Komparasi harus mendeteksi baris add dan remove.");
});

// ==================== TEST 9: LOCK V02 & IMMUTABILITY (ACCEPTANCE STEPS 11 & 12) ====================
test("9. Lock V02 enforces immutability; subsequent edits create V03 (Acceptance Steps 11 & 12)", () => {
  // Lock V02
  const lockedV02 = promptService.lockPromptVersion(v02Id);
  assert.equal(lockedV02.isLocked, true);

  const doc = promptService.getOrCreatePromptDocumentForShot({ projectId, shotId: sh016Id });

  // Attempt edit without forceNewVersion
  const v03Text = "V03 prompt modification after V02 was locked";
  const nextVer = promptService.createPromptVersion({
    documentId: doc.id,
    promptText: v03Text,
    source: "MANUAL",
  });

  assert.equal(nextVer.versionNumber, 3);
  assert.equal(nextVer.versionLabel, "V03", "Karena V02 terkunci, sistem harus otomatis membuat V03.");
  assert.equal(nextVer.isCurrent, true);

  // Check that V02 was NOT modified
  const v02InDb = database.db.select().from(database.schema.promptVersions).where(eq(database.schema.promptVersions.id, v02Id)).get();
  assert.equal(v02InDb?.isLocked, true);
  assert.notEqual(v02InDb?.promptText, v03Text);

  // Verify V03 local file
  assert.ok(nextVer.localFilePath && existsSync(nextVer.localFilePath));
});

// ==================== TEST 10: FLOW QUEUE STAGING (ACCEPTANCE STEP 14) ====================
test("10. Add to Flow Queue creates STAGED item with complete payload (Acceptance Step 14)", () => {
  const res = flowQueueService.addToFlowQueue({
    projectId,
    shotId: sh016Id,
    promptVersionId: v02Id, // stage the locked V02
    engine: "VEO",
    customParameters: {
      aspectRatio: "16:9",
      duration: 4,
      resolution: "1080p",
      audio: false,
    },
  });

  assert.equal(res.item.status, "STAGED");
  assert.equal(res.item.engine, "VEO");
  assert.equal(res.item.promptVersionId, v02Id);

  // Verify complete payload structure
  const payload = res.payload;
  assert.equal(payload.engine, "VEO");
  assert.match(payload.promptText, /Starting from keyframe KF-B08/);
  assert.equal(payload.parameters.aspectRatio, "16:9");
  assert.equal(payload.parameters.duration, 4);
  assert.equal(payload.parameters.resolution, "1080p");
  assert.equal(payload.parameters.audio, false);

  // Verify startFrame asset path
  assert.ok(payload.referenceAssets.startFrame, "Start frame reference harus disertakan.");
  assert.equal(payload.referenceAssets.startFrame.assetCode, "KF-B08");
  assert.match(payload.referenceAssets.startFrame.path, /KF-B08/);

  // Verify metadata
  assert.equal(payload.metadata.projectCode, "LEMBAH-AWAN");
  assert.equal(payload.metadata.shotCode, "SH016");
  assert.equal(payload.metadata.versionLabel, "V02");

  // Verify DB record
  const inDb = database.db.select().from(database.schema.flowQueueItems).where(eq(database.schema.flowQueueItems.id, res.item.id)).get();
  assert.ok(inDb);
  assert.equal(inDb.status, "STAGED");
});

// ==================== TEST 11: GEMINI IMPROVE & TRANSLATE & NEGATIVE ====================
test("11. Gemini prompt improvement, translation, and negative prompt generation", async () => {
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: JSON.stringify({
            improvedPrompt: "Enhanced cinematic VEO prompt: Close-up two shot, Pak Arga opening the ancient compass...",
            improvedNegativePrompt: "avoid AI video stutter, rubbery limbs, morphing",
            summaryOfChanges: "Added camera lens detail and VEO motion tags",
            targetEngineAdvice: "Use 24fps and seed locking for VEO motion continuity",
          }),
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 60 },
        };
      },
    },
  });

  const improved = await promptAiService.improvePrompt({
    projectId,
    shotId: sh016Id,
    currentPrompt: "Pak Arga opens compass",
    targetEngine: "VEO",
  });

  assert.match(improved.result.improvedPrompt, /Enhanced cinematic VEO prompt/);
  assert.match(improved.result.summaryOfChanges, /camera lens/);

  // Translation mock
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: JSON.stringify({
            englishPrompt: "Pak Arga presents the mysterious compass to Raka and Lila under warm sunlight",
            negativePrompt: "low resolution, distortion",
            notes: "Preserved Indonesian cultural attire and setting nuance",
          }),
          usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 40 },
        };
      },
    },
  });

  const translated = await promptAiService.translateToEnglishPrompt({
    projectId,
    shotId: sh016Id,
    indonesianText: "Pak Arga menunjukkan kompas misterius kepada Raka dan Lila",
    targetEngine: "VEO",
  });

  assert.match(translated.result.englishPrompt, /presents the mysterious compass/);
});

// ==================== TEST 12: GEMINI API FAILURE HANDLING ====================
test("12. Gemini API failure returns readable Indonesian error and does not corrupt records", async () => {
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        const error = Object.assign(new Error("Resource has been exhausted (rateLimitExceeded)"), { status: 429 });
        throw error;
      },
    },
  });

  await assert.rejects(
    async () => {
      await promptAiService.generatePromptFromContext({
        projectId,
        shotId: sh016Id,
        targetEngine: "VEO",
      });
    },
    (err: unknown) => {
      const error = err as { code: string; message: string };
      assert.equal(error.code, "RATE_LIMIT");
      assert.match(error.message, /terlampaui/i);
      return true;
    }
  );

  // Verify that the prompt document and existing versions remain intact and functional
  const docWithVersions = promptService.getPromptForShot(projectId, sh016Id);
  assert.ok(docWithVersions.versions.length >= 3);
});

// ==================== TEST 13: DATA PERSISTENCE ACROSS RE-INITIALIZATION ====================
test("13. All data persists cleanly across ensureDatabaseReady (Acceptance Step 15)", () => {
  database.ensureDatabaseReady();

  // Verify prompt document
  const doc = database.db.select().from(database.schema.promptDocuments).where(eq(database.schema.promptDocuments.shotId, sh016Id)).get();
  assert.ok(doc, "Prompt document harus persisten.");

  // Verify prompt versions
  const versions = database.db.select().from(database.schema.promptVersions).where(eq(database.schema.promptVersions.promptDocumentId, doc.id)).all();
  assert.ok(versions.length >= 3, "Versi V01, V02, V03 harus tetap ada.");

  // Verify Flow Queue item
  const staged = database.db.select().from(database.schema.flowQueueItems).where(eq(database.schema.flowQueueItems.shotId, sh016Id)).all();
  assert.ok(staged.length >= 1, "Item staged Flow Queue harus tetap ada.");
  assert.equal(staged[0].status, "STAGED");
});
