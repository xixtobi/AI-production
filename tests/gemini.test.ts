import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { ThinkingLevel } from "@google/genai";


let dataDir: string;
let projectRoot: string;
let projectRootB: string;
let database: typeof import("../src/lib/db");
let geminiClient: typeof import("../src/lib/gemini/client");
let geminiTaskService: typeof import("../src/lib/gemini/task-service");
let geminiContextBuilder: typeof import("../src/lib/gemini/context-builder");
let geminiSchemas: typeof import("../src/lib/gemini/schemas");
let projectService: typeof import("../src/lib/projects/service");
let contentService: typeof import("../src/lib/content/service");
let sceneService: typeof import("../src/lib/scenes/service");
let shotService: typeof import("../src/lib/shots/service");

let projectAId: string;
let projectBId: string;
let contentAId: string;
let sceneAId: string;
let shot1Id: string;
let shot2Id: string;
let shot3Id: string;

before(async () => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "lpc-gemini-test-db-"));
  projectRoot = mkdtempSync(path.join(os.tmpdir(), "lpc-gemini-test-root-a-"));
  projectRootB = mkdtempSync(path.join(os.tmpdir(), "lpc-gemini-test-root-b-"));
  process.env.PRODUCTION_CONTROL_DATA_DIR = dataDir;

  database = await import("../src/lib/db");
  database.ensureDatabaseReady();

  geminiClient = await import("../src/lib/gemini/client");
  geminiTaskService = await import("../src/lib/gemini/task-service");
  geminiContextBuilder = await import("../src/lib/gemini/context-builder");
  geminiSchemas = await import("../src/lib/gemini/schemas");
  projectService = await import("../src/lib/projects/service");
  contentService = await import("../src/lib/content/service");
  sceneService = await import("../src/lib/scenes/service");
  shotService = await import("../src/lib/shots/service");


  const projA = projectService.createProject({
    code: "PROJ-A",
    name: "Project A Gemini",
    projectType: "ANIMATION_SERIES",
    description: "Panduan gaya kartun 3D petualangan fantasi penuh warna.",
    rootPath: projectRoot,
    defaultAspectRatio: "16:9",
    defaultLanguage: "Indonesian",
  });
  projectAId = projA.id;

  const projB = projectService.createProject({
    code: "PROJ-B",
    name: "Project B Isolation",
    projectType: "YOUTUBE",
    description: "Proyek kedua untuk isolasi.",
    rootPath: projectRootB,
    defaultAspectRatio: "16:9",
    defaultLanguage: "Indonesian",
  });
  projectBId = projB.id;

  const contentA = contentService.createContent(projectAId, {
    seasonId: null,
    code: "EP01",
    title: "Episode Perdana",
    contentType: "EPISODE",
    contentNumber: 1,
    description: "Awal mula petualangan.",
    durationTarget: null,
    status: "NOT_STARTED",
    priority: "NORMAL",
  });
  contentAId = contentA.id;

  const sceneA = sceneService.createScene(projectAId, contentAId, {
    code: "SC01",
    sceneNumber: 1,
    title: "Di Gerbang Hutan",
    location: "Gerbang Kayu Kuno",
    description: "Kabut tipis menyelimuti pepohonan.",
    durationTarget: null,
    status: "NOT_STARTED",
  });
  sceneAId = sceneA.id;

  const s1 = shotService.createShot(projectAId, {
    contentItemId: contentAId,
    sceneId: sceneAId,
    shotCode: "SH001",
    shotNumber: 1,
    title: "Establishing Gerbang",
    description: "",
    durationTarget: null,
    cameraType: "WIDE",
    action: "Kamera mengarah ke gerbang tua yang berlumut.",
    dialogue: "",
    notes: "Pencahayaan senja temaram.",
    status: "NOT_STARTED",
    priority: "NORMAL",
  });
  shot1Id = s1.id;

  const s2 = shotService.createShot(projectAId, {
    contentItemId: contentAId,
    sceneId: sceneAId,
    shotCode: "SH002",
    shotNumber: 2,
    title: "Budi Melangkah Masuk",
    description: "",
    durationTarget: null,
    cameraType: "MEDIUM",
    action: "Budi membuka ransel dan menatap ke dalam hutan.",
    dialogue: "Budi: 'Kita sudah sampai di sini.'",
    notes: "",
    status: "NOT_STARTED",
    priority: "NORMAL",
  });
  shot2Id = s2.id;

  const s3 = shotService.createShot(projectAId, {
    contentItemId: contentAId,
    sceneId: sceneAId,
    shotCode: "SH003",
    shotNumber: 3,
    title: "Reaksi Burung Hantu",
    description: "",
    durationTarget: null,
    cameraType: "CLOSE_UP",
    action: "Mata burung hantu terbuka lebar di dahan pohon.",
    dialogue: "",
    notes: "",
    status: "NOT_STARTED",
    priority: "NORMAL",
  });
  shot3Id = s3.id;


  const now = new Date();
  const charAssetId = crypto.randomUUID();
  database.db.insert(database.schema.assets).values({
    id: charAssetId,
    projectId: projectAId,
    assetCode: "CHAR_BUDI",
    assetType: "REFERENCE",
    name: "Model Sheet Budi",
    description: "Anak laki-laki berusia 12 tahun memakai jaket kuning bertopi biru.",
    status: "NOT_STARTED",
    isShared: false,
    createdAt: now,
    updatedAt: now,
  }).run();

  database.db.insert(database.schema.assetVersions).values({
    id: crypto.randomUUID(),
    projectId: projectAId,
    assetId: charAssetId,
    versionNumber: 1,
    versionLabel: "v1",
    filename: "budi.png",
    relativePath: "CHARACTERS/budi.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    sha256: "dummy-sha-char-budi-1234567890",
    isCurrent: true,
    isLocked: false,
    createdAt: now,
    notes: "",
  }).run();

  const envAssetId = crypto.randomUUID();
  database.db.insert(database.schema.assets).values({
    id: envAssetId,
    projectId: projectAId,
    assetCode: "ENV_GATE",
    assetType: "REFERENCE",
    name: "Konsep Gerbang Tua",
    description: "Gerbang kayu lapuk dengan ukiran simbol kuno.",
    status: "NOT_STARTED",
    isShared: false,
    createdAt: now,
    updatedAt: now,
  }).run();

  database.db.insert(database.schema.assetVersions).values({
    id: crypto.randomUUID(),
    projectId: projectAId,
    assetId: envAssetId,
    versionNumber: 1,
    versionLabel: "v1",
    filename: "gate.png",
    relativePath: "ENVIRONMENTS/gate.png",
    mimeType: "image/png",
    sizeBytes: 2048,
    sha256: "dummy-sha-env-gate-1234567890",
    isCurrent: true,
    isLocked: false,
    createdAt: now,
    notes: "",
  }).run();

  database.db.insert(database.schema.shotAssets).values({
    id: crypto.randomUUID(),
    projectId: projectAId,
    shotId: shot2Id,
    assetId: charAssetId,
    role: "CHARACTER_REFERENCE",
    notes: "Karakter utama dalam frame",
    sortOrder: 1,
  }).run();

  database.db.insert(database.schema.shotAssets).values({
    id: crypto.randomUUID(),
    projectId: projectAId,
    shotId: shot2Id,
    assetId: envAssetId,
    role: "ENVIRONMENT_REFERENCE",
    notes: "Latar belakang gerbang",
    sortOrder: 2,
  }).run();
});

after(() => {
  geminiClient.resetGeminiClientOverride();
  delete process.env.GEMINI_API_KEY;
  rmSync(projectRoot, { recursive: true, force: true });
  rmSync(projectRootB, { recursive: true, force: true });
});


test("1. missing API key returns readable Indonesian message and application survives", async () => {
  geminiClient.resetGeminiClientOverride();
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    assert.equal(geminiClient.isGeminiConfigured(), false);

    const testConn = await geminiClient.testGeminiConnection();
    assert.equal(testConn.ok, false);
    assert.equal(testConn.status, "NOT_CONFIGURED");
    assert.match(testConn.message, /belum dikonfigurasi/i);

    await assert.rejects(
      async () => {
        await geminiClient.sendGeminiRequest({ prompt: "Halo" });
      },
      (err: unknown) => {
        const error = err as { code: string; message: string };
        assert.equal(error.code, "MISSING_API_KEY");
        assert.match(error.message, /GEMINI_API_KEY.*belum dikonfigurasi/i);
        return true;
      }
    );
  } finally {
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  }
});

test("2. successful Gemini call with mocked client", async () => {
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: "Mocked Gemini text response",
          usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 65 },
        };
      },
    },
  });

  const res = await geminiClient.sendGeminiRequest({
    prompt: "Buatkan skenario",
    thinkingLevel: "MEDIUM",
  });

  assert.equal(res.text, "Mocked Gemini text response");
  assert.equal(res.inputTokens, 120);
  assert.equal(res.outputTokens, 65);
});

test("3. rate limit returns specific Indonesian error", async () => {
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        const error = Object.assign(new Error("Resource has been exhausted (e.g. check quota). rateLimitExceeded"), { status: 429 });
        throw error;
      },
    },
  });

  await assert.rejects(
    async () => {
      await geminiClient.sendGeminiRequest({ prompt: "Testing rate limit" });
    },
    (err: unknown) => {
      const error = err as { code: string; message: string };
      assert.equal(error.code, "RATE_LIMIT");
      assert.match(error.message, /rate limit.*terlampaui/i);
      return true;
    }
  );
});

test("4. invalid response from Gemini is handled gracefully", async () => {
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: "",
          candidates: [],
        };
      },
    },
  });

  await assert.rejects(
    async () => {
      await geminiClient.sendGeminiRequest({ prompt: "Testing empty response" });
    },
    (err: unknown) => {
      const error = err as { code: string; message: string };
      assert.equal(error.code, "INVALID_RESPONSE");
      assert.match(error.message, /tidak valid atau kosong/i);
      return true;
    }
  );
});

test("5. structured output validation validates schema and rejects invalid JSON/structure", () => {
  const validPromptJson = JSON.stringify({
    positivePrompt: "A 12-year-old boy Budi wearing a yellow jacket and blue cap in front of an ancient mossy wooden gate in a foggy forest, 3D Pixar animation style, warm dusk lighting",
    negativePrompt: "low quality, distorted, extra limbs, blur, photorealistic",
    artStyle: "3D stylized animation, vibrant lighting",
    cameraAndComposition: "Medium shot, eye-level framing",
    lighting: "Dusk golden hour with misty blue rim light",
    motionDescription: "Character looks up cautiously as he unzips his backpack",
    notes: "Pertahankan konsistensi warna jaket kuning Budi",
  });

  const validRes = geminiSchemas.validateStructuredOutput("PROMPT_GENERATION", validPromptJson);
  assert.equal(validRes.success, true);

  const invalidStructureJson = JSON.stringify({
    positivePrompt: "Missing other required fields",
  });

  const invalidRes = geminiSchemas.validateStructuredOutput("PROMPT_GENERATION", invalidStructureJson);
  assert.equal(invalidRes.success, false);
  if (!invalidRes.success) {
    assert.match(invalidRes.error, /tidak sesuai dengan skema/i);
  }

  const malformedJson = "{ positivePrompt: not valid json }";
  const malformedRes = geminiSchemas.validateStructuredOutput("PROMPT_GENERATION", malformedJson);
  assert.equal(malformedRes.success, false);
  if (!malformedRes.success) {
    assert.match(malformedRes.error, /bukan JSON yang valid/i);
  }
});

test("6. project isolation: prevents cross-project access", () => {
  assert.throws(
    () => {
      geminiContextBuilder.buildShotContext(projectBId, shot2Id);
    },
    (err: unknown) => {
      const error = err as Error;
      assert.match(error.message, /Shot tidak ditemukan pada proyek ini/i);
      return true;
    }
  );
});


test("7. shot context contains all 12 required items", () => {
  const ctx = geminiContextBuilder.buildShotContext(projectAId, shot2Id);

  assert.equal(ctx.project.id, projectAId);
  assert.equal(ctx.project.projectType, "ANIMATION_SERIES");
  assert.ok(ctx.styleBible);
  assert.equal(ctx.content.code, "EP01");
  assert.equal(ctx.scene?.code, "SC01");
  assert.equal(ctx.shot.shotCode, "SH002");
  assert.equal(ctx.previousShot?.shotCode, "SH001");
  assert.equal(ctx.nextShot?.shotCode, "SH003");
  assert.equal(ctx.nextShot?.id, shot3Id);
  assert.equal(ctx.characterReferences.length, 1);

  assert.equal(ctx.characterReferences[0].assetCode, "CHAR_BUDI");
  assert.equal(ctx.environmentReferences.length, 1);
  assert.equal(ctx.environmentReferences[0].assetCode, "ENV_GATE");
  assert.equal(ctx.linkedAssets.length, 2);

  const formattedPrompt = geminiContextBuilder.buildShotContextPrompt(ctx, "Pembuatan Prompt");
  assert.match(formattedPrompt, /PROYEK/);
  assert.match(formattedPrompt, /STYLE BIBLE/);
  assert.match(formattedPrompt, /KONTEN/);
  assert.match(formattedPrompt, /SCENE/);
  assert.match(formattedPrompt, /SHOT SAAT INI/);
  assert.match(formattedPrompt, /SHOT SEBELUMNYA/);
  assert.match(formattedPrompt, /SHOT BERIKUTNYA/);
  assert.match(formattedPrompt, /REFERENSI KARAKTER/);
  assert.match(formattedPrompt, /SEMUA ASET YANG DITAUTKAN/);
});

test("8. AI request logging records task, model, thinking level, and token usage in database", async () => {
  const mockResultJson = JSON.stringify({
    positivePrompt: "Cinematic shot of Budi in the misty forest",
    negativePrompt: "blur, low quality",
    artStyle: "3D Animation",
    cameraAndComposition: "Medium angle",
    lighting: "Warm rim light",
    motionDescription: "Slow pan",
    notes: "Catatan produksi terverifikasi",
  });

  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: mockResultJson,
          usageMetadata: { promptTokenCount: 250, candidatesTokenCount: 80 },
        };
      },
    },
  });

  const executed = await geminiTaskService.executeShotTask({
    projectId: projectAId,
    shotId: shot2Id,
    taskCode: "PROMPT_GENERATION",
    thinkingLevel: "MEDIUM",
  });

  assert.equal(executed.request.status, "SUCCEEDED");
  assert.equal(executed.request.model, "gemini-3.8-flash");
  assert.equal(executed.request.thinkingLevel, "MEDIUM");
  assert.equal(executed.request.inputTokens, 250);
  assert.equal(executed.request.outputTokens, 80);
  assert.ok(executed.request.estimatedCost != null && executed.request.estimatedCost > 0);

  const history = geminiTaskService.listAiHistory({ projectId: projectAId, shotId: shot2Id });
  assert.ok(history.length >= 1);
  assert.equal(history[0].task.code, "PROMPT_GENERATION");
});


test("9. accept result writes to shot records and marks request ACCEPTED", async () => {
  const mockResultJson = JSON.stringify({
    positivePrompt: "Accepted positive prompt for SH002",
    negativePrompt: "worst quality",
    artStyle: "Stylized 3D",
    cameraAndComposition: "Close-up",
    lighting: "Dramatic rim",
    motionDescription: "Character looks into camera",
    notes: "Approved notes",
  });

  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: mockResultJson,
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
        };
      },
    },
  });

  const executed = await geminiTaskService.executeShotTask({
    projectId: projectAId,
    shotId: shot2Id,
    taskCode: "PROMPT_GENERATION",
  });

  const acceptRes = await geminiTaskService.acceptShotTaskResult({
    requestId: executed.request.id,
  });

  assert.equal(acceptRes.success, true);
  assert.match(acceptRes.shot.notes, /Accepted positive prompt for SH002/);

  const updatedReq = database.db.select().from(database.schema.aiRequests).where(eq(database.schema.aiRequests.id, executed.request.id)).get()!;
  assert.equal(updatedReq.status, "ACCEPTED");
});

test("10. reject result marks request REJECTED and leaves production data untouched", async () => {
  const initialShot = shotService.getShotDetail(projectAId, shot1Id)!.shot;
  const initialNotes = initialShot.notes;

  const mockResultJson = JSON.stringify({
    positivePrompt: "Rejected prompt text",
    negativePrompt: "none",
    artStyle: "3D",
    cameraAndComposition: "Wide",
    lighting: "Flat",
    motionDescription: "None",
    notes: "Should not be saved",
  });

  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: mockResultJson,
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 },
        };
      },
    },
  });

  const executed = await geminiTaskService.executeShotTask({
    projectId: projectAId,
    shotId: shot1Id,
    taskCode: "PROMPT_GENERATION",
  });

  const rejectRes = await geminiTaskService.rejectShotTaskResult({
    requestId: executed.request.id,
  });

  assert.equal(rejectRes.success, true);

  const updatedReq = database.db.select().from(database.schema.aiRequests).where(eq(database.schema.aiRequests.id, executed.request.id)).get()!;
  assert.equal(updatedReq.status, "REJECTED");

  const shotAfter = shotService.getShotDetail(projectAId, shot1Id)!.shot;
  assert.equal(shotAfter.notes, initialNotes);
});

test("11. thinking-level routing passes correct ThinkingLevel to Gemini API config", async () => {
  let capturedThinkingLevel: ThinkingLevel | undefined;

  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async (args: {
        config?: {
          thinkingConfig?: { thinkingLevel?: ThinkingLevel };
          responseSchema?: { properties?: { visualDescription?: unknown } };
        };
      }) => {
        capturedThinkingLevel = args.config?.thinkingConfig?.thinkingLevel;

        const isShotBreakdown = args.config?.responseSchema?.properties?.visualDescription;
        const text = isShotBreakdown
          ? JSON.stringify({
              summary: "Breakdown shot Budi",
              visualDescription: "Budi berjalan melintasi gerbang",
              cameraWork: "Medium tracking shot",
              lightingAndAtmosphere: "Golden hour dusk",
              audioAndDialogue: "Langkah kaki dan desau angin",
              characters: ["Budi"],
              propsAndEnvironment: ["Gerbang Tua"],
              estimatedDurationSeconds: 4.5,
              productionNotes: ["Perhatikan konsistensi jaket"],
            })
          : JSON.stringify({
              positivePrompt: "Test prompt",
              negativePrompt: "none",
              artStyle: "3D",
              cameraAndComposition: "Medium",
              lighting: "Soft",
              motionDescription: "Idle",
              notes: "Thinking test",
            });

        return {
          text,
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 },
        };
      },
    },
  });

  await geminiTaskService.executeShotTask({
    projectId: projectAId,
    shotId: shot2Id,
    taskCode: "PROMPT_GENERATION",
    thinkingLevel: "HIGH",
  });
  assert.equal(capturedThinkingLevel, ThinkingLevel.HIGH);

  await geminiTaskService.executeShotTask({
    projectId: projectAId,
    shotId: shot2Id,
    taskCode: "PROMPT_GENERATION",
    thinkingLevel: "LOW",
  });
  assert.equal(capturedThinkingLevel, ThinkingLevel.LOW);

  // When not specified, defaults to task's default thinking level (PROMPT_GENERATION = MEDIUM)
  await geminiTaskService.executeShotTask({
    projectId: projectAId,
    shotId: shot2Id,
    taskCode: "PROMPT_GENERATION",
  });
  assert.equal(capturedThinkingLevel, ThinkingLevel.MEDIUM);

  // When SHOT_BREAKDOWN (task default is HIGH)
  await geminiTaskService.executeShotTask({
    projectId: projectAId,
    shotId: shot2Id,
    taskCode: "SHOT_BREAKDOWN",
  });
  assert.equal(capturedThinkingLevel, ThinkingLevel.HIGH);
});


test("12. prepareContextPack creates AI_CONTEXT_PACK with all required files", async () => {
  const pack = await geminiContextBuilder.prepareContextPack(projectAId, shot2Id, "PROMPT_GENERATION");
  assert.ok(existsSync(pack.outputDir));

  const expectedFiles = [
    "manifest.json",
    "project.md",
    "style-bible.md",
    "characters.md",
    "environments.md",
    "content.md",
    "scene.md",
    "shot.md",
    "previous-shot.md",
    "next-shot.md",
    "prompt-history.md",
    "task.md",
  ];

  for (const file of expectedFiles) {
    assert.ok(
      existsSync(path.join(pack.outputDir, file)),
      `File ${file} must exist in AI_CONTEXT_PACK`
    );
  }
  assert.ok(existsSync(path.join(pack.outputDir, "references", "README.md")));
});
