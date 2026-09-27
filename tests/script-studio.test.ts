import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";

let dataDir: string;
let database: typeof import("../src/lib/db");
let geminiClient: typeof import("../src/lib/gemini/client");
let scriptService: typeof import("../src/lib/script/script-service");
let storyService: typeof import("../src/lib/script/story-service");
let bibleService: typeof import("../src/lib/script/bible-service");
let changeImpactService: typeof import("../src/lib/script/change-impact-service");
let scriptAiService: typeof import("../src/lib/script/script-ai-service");
let sceneShotGen: typeof import("../src/lib/script/scene-shot-generator");

let projectId: string;
let contentId: string;
let anchorBSceneId: string;

before(async () => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "lpc-script-studio-test-db-"));
  process.env.PRODUCTION_CONTROL_DATA_DIR = dataDir;

  database = await import("../src/lib/db");
  database.ensureDatabaseReady();

  geminiClient = await import("../src/lib/gemini/client");
  scriptService = await import("../src/lib/script/script-service");
  storyService = await import("../src/lib/script/story-service");
  bibleService = await import("../src/lib/script/bible-service");
  changeImpactService = await import("../src/lib/script/change-impact-service");
  scriptAiService = await import("../src/lib/script/script-ai-service");
  sceneShotGen = await import("../src/lib/script/scene-shot-generator");

  // Fetch seeded project LEMBAH-AWAN
  const project = database.db
    .select()
    .from(database.schema.projects)
    .where(eq(database.schema.projects.code, "LEMBAH-AWAN"))
    .get();

  assert.ok(project, "Proyek Lembah Awan harus ter-seed otomatis.");
  projectId = project.id;

  const content = database.db
    .select()
    .from(database.schema.contentItems)
    .where(eq(database.schema.contentItems.projectId, projectId))
    .get();

  assert.ok(content, "Content EP01 harus ter-seed otomatis.");
  contentId = content.id;

  const anchorB = database.db
    .select()
    .from(database.schema.scenes)
    .where(eq(database.schema.scenes.code, "ANCHOR_B"))
    .get();

  assert.ok(anchorB, "Scene ANCHOR_B harus ter-seed otomatis.");
  anchorBSceneId = anchorB.id;
});

after(() => {
  geminiClient.resetGeminiClientOverride();
  delete process.env.GEMINI_API_KEY;
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {}
});

// ==================== TEST 1: LEMBAH AWAN CANON SEEDING ====================
test("1. Lembah Awan characters and environments are seeded with canonical details", () => {
  const characters = bibleService.listCharacters(projectId);
  assert.equal(characters.length, 4, "Harus ada 4 karakter kanon Lembah Awan.");

  const names = characters.map((c) => c.name);
  assert.ok(names.includes("Raka"));
  assert.ok(names.includes("Lila"));
  assert.ok(names.includes("Bimo"));
  assert.ok(names.includes("Mimo"));

  const raka = characters.find((c) => c.name === "Raka")!;
  assert.equal(raka.role, "Protagonis utama");
  assert.match(raka.signatureProps, /kompas tua/i);

  const environments = bibleService.listEnvironments(projectId);
  assert.equal(environments.length, 7, "Harus ada 7 lingkungan kanon Lembah Awan.");
  const envNames = environments.map((e) => e.name);
  assert.ok(envNames.includes("Desa Lembah Awan"));
  assert.ok(envNames.includes("Rumah Pak Arga"));
  assert.ok(envNames.includes("Hutan Bisikan"));
  assert.ok(envNames.includes("Gunung Awan"));
  assert.ok(envNames.includes("Sungai & Jembatan Tua"));
  assert.ok(envNames.includes("Pintu Rahasia & Lorong Kuno"));
  assert.ok(envNames.includes("Menara Lonceng Awan"));

  const storyBible = bibleService.getStoryBible(projectId);
  assert.ok(storyBible);
  assert.match(storyBible.constraints, /kekerasan|aman untuk.*anak/i);

  const styleBible = bibleService.getStyleBible(projectId);
  assert.ok(styleBible);
  assert.match(styleBible.audience, /anak-anak.*keluarga/i);
});

// ==================== TEST 2: STORY DOCUMENTS & VERSIONING ====================
test("2. Story documents CRUD and versioning never destroys previous versions", () => {
  const doc = storyService.createStoryDocument({
    projectId,
    contentItemId: contentId,
    docType: "CONCEPT",
    title: "Konsep Lonceng Lembah Awan",
    initialContent: "Draf awal premis misteri lonceng.",
    notes: "Inisiasi konsep",
  });

  assert.equal(doc.versions.length, 1);
  assert.equal(doc.currentVersion?.versionNumber, 1);
  assert.equal(doc.currentVersion?.content, "Draf awal premis misteri lonceng.");

  // Add version 2
  const v2 = storyService.createStoryDocumentVersion(doc.id, {
    title: "Konsep Lonceng Revisi 2",
    content: "Draf revisi: kompas bergetar saat lonceng berdentang.",
    notes: "Menambahkan detail kompas",
  });

  assert.equal(v2.versionNumber, 2);
  assert.equal(v2.isCurrent, true);

  // Retrieve document and verify older version remains intact
  const retrieved = storyService.getStoryDocument(doc.id);
  assert.ok(retrieved);
  assert.equal(retrieved.versions.length, 2, "Harus ada 2 versi dan tidak menimpa versi sebelumnya.");
  const v1 = retrieved.versions.find((v) => v.versionNumber === 1);
  assert.ok(v1);
  assert.equal(v1.content, "Draf awal premis misteri lonceng.");
  assert.equal(v1.isCurrent, false);
});

// ==================== TEST 3: SCRIPT DOCUMENT & V01 CREATION ====================
let scriptDocId: string;
let version1Id: string;
let scene1Id: string;
let dialogueBlockId: string;

test("3. Script document initialization creates editable V01 and supports scene/block additions", () => {
  const scriptDetail = scriptService.getOrCreateScriptDocument(projectId, contentId);
  assert.ok(scriptDetail);
  assert.ok(scriptDetail.currentVersion);
  assert.equal(scriptDetail.currentVersion.versionLabel, "V01");
  assert.equal(scriptDetail.currentVersion.isLocked, false);
  assert.equal(scriptDetail.currentVersion.isCurrent, true);

  scriptDocId = scriptDetail.id;
  version1Id = scriptDetail.currentVersion.id;

  // Add Scene 1 linked to ANCHOR_B
  const scene = scriptService.addScene(version1Id, {
    sceneNumber: 1,
    sceneCode: "ANCHOR_B",
    heading: "EXT. RUMAH PAK ARGA - SORE",
    location: "Rumah Pak Arga",
    timeOfDay: "SORE",
    description: "Sore hari berkabut tipis. Tiga anak berkumpul di teras.",
    linkedSceneId: anchorBSceneId,
  });

  scene1Id = scene.id;
  assert.equal(scene.sceneCode, "ANCHOR_B");

  // Add blocks to Scene 1
  const actionBlock = scriptService.addBlock(scene1Id, {
    blockType: "ACTION",
    content: "Raka meletakkan kompas tua berukir simbol awan di atas meja kayu.",
  });
  assert.ok(actionBlock);

  const charBlock = scriptService.addBlock(scene1Id, {
    blockType: "CHARACTER",
    content: "RAKA",
    character: "Raka",
  });
  assert.ok(charBlock);

  const dialogueBlock = scriptService.addBlock(scene1Id, {
    blockType: "DIALOGUE",
    character: "Raka",
    content: "Jarumnya bergerak sendiri ke arah puncak gunung!",
  });
  dialogueBlockId = dialogueBlock.id;
  assert.equal(dialogueBlock.character, "Raka");

  const sfxBlock = scriptService.addBlock(scene1Id, {
    blockType: "SFX",
    content: "DENTING LONCENG MENGGEMA LEMBUT DARI KEJAUHAN",
  });
  assert.ok(sfxBlock);

  // Test screenplay export
  const versionDetail = scriptService.getVersionDetail(version1Id)!;
  const exported = scriptService.exportToScreenplayText(versionDetail);
  assert.match(exported, /SCENE 1: EXT\. RUMAH PAK ARGA - SORE/);
  assert.match(exported, /RAKA/);
  assert.match(exported, /Jarumnya bergerak sendiri/);
  assert.match(exported, /SFX: DENTING LONCENG/);
});

// ==================== TEST 4: LOCKING V01 IMMUTABILITY ====================
test("4. Locking V01 creates immutable snapshot and prevents any further modifications", () => {
  const lockedVersion = scriptService.lockVersion(version1Id, "Snapshot resmi pra-produksi");
  assert.equal(lockedVersion.isLocked, true);
  assert.ok(lockedVersion.lockedAt);
  assert.ok(lockedVersion.snapshotJson);

  // Parse snapshot JSON to verify scene and block integrity
  const parsed = JSON.parse(lockedVersion.snapshotJson);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].blocks.length, 4);

  // Modifying locked version MUST fail
  assert.throws(
    () => {
      scriptService.addBlock(scene1Id, {
        blockType: "ACTION",
        content: "Blok ilegal setelah dikunci.",
      });
    },
    /telah dikunci \(LOCKED\)/i
  );

  assert.throws(
    () => {
      scriptService.updateBlock(dialogueBlockId, {
        content: "Perubahan ilegal dialog.",
      });
    },
    /telah dikunci \(LOCKED\)/i
  );

  assert.throws(
    () => {
      scriptService.addScene(version1Id, {
        sceneNumber: 2,
        sceneCode: "SC002",
        heading: "EXT. JALAN SETAPAK - SORE",
      });
    },
    /telah dikunci \(LOCKED\)/i
  );
});

// ==================== TEST 5: CREATE V02 CLONING V01 ====================
let version2Id: string;
let v2Scene1Id: string;
let v2DialogueBlockId: string;

test("5. Creating V02 clones scenes & blocks, unlocks editing, and sets V02 as current", () => {
  const v2 = scriptService.createNewVersion(scriptDocId, {
    cloneFromVersionId: version1Id,
    notes: "Draf revisi V02",
  });

  assert.equal(v2.versionNumber, 2);
  assert.equal(v2.versionLabel, "V02");
  assert.equal(v2.isLocked, false, "V02 harus dapat diedit.");
  assert.equal(v2.isCurrent, true, "V02 harus menjadi versi aktif.");
  assert.equal(v2.scenes.length, 1, "V02 harus mengklon 1 adegan dari V01.");
  assert.equal(v2.scenes[0].blocks.length, 4, "V02 harus mengklon 4 blok dari V01.");

  version2Id = v2.id;
  v2Scene1Id = v2.scenes[0].id;

  const v2Dialogue = v2.scenes[0].blocks.find((b) => b.blockType === "DIALOGUE")!;
  assert.ok(v2Dialogue);
  v2DialogueBlockId = v2Dialogue.id;

  // V01 must now be isCurrent = false
  const v1Check = scriptService.getVersionDetail(version1Id)!;
  assert.equal(v1Check.isCurrent, false);
});

// ==================== TEST 6: GEMINI AI SCRIPT ASSIST ====================
test("6. Gemini AI script assist generates suggestion without directly overwriting production records", async () => {
  // Mock Gemini response for DIALOGUE_POLISH
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: JSON.stringify({
            suggestion: "Raka: 'Lonceng itu berdenting lagi! Lihat jarumnya, Lila... arahnya persis ke Gunung Awan!'",
            reasoning: "Meningkatkan emosi penasaran dan spontanitas anak saat melihat fenomena aneh.",
            suggestedBlocks: [
              {
                blockType: "DIALOGUE",
                character: "Raka",
                content: "Lonceng itu berdenting lagi! Lihat jarumnya, Lila... arahnya persis ke Gunung Awan!",
              },
            ],
          }),
          usageMetadata: {
            promptTokenCount: 150,
            candidatesTokenCount: 50,
          },
        };
      },
    },
  });

  const assistResult = await scriptAiService.executeScriptAiAssist({
    projectId,
    contentItemId: contentId,
    scriptVersionId: version2Id,
    scriptSceneId: v2Scene1Id,
    scriptBlockId: v2DialogueBlockId,
    action: "DIALOGUE_POLISH",
    targetContent: "Jarumnya bergerak sendiri ke arah puncak gunung!",
    characterName: "Raka",
    environmentName: "Rumah Pak Arga",
    instructions: "Buat ekspresi terkejut khas anak-anak.",
  });

  assert.equal(assistResult.action, "DIALOGUE_POLISH");
  assert.match(assistResult.suggestion, /Lonceng itu berdenting lagi/i);
  assert.match(assistResult.reasoning, /penasaran/i);

  // CRITICAL RULE: Database block MUST NOT be changed automatically by AI!
  const blockBeforeAccept = database.db
    .select()
    .from(database.schema.scriptBlocks)
    .where(eq(database.schema.scriptBlocks.id, v2DialogueBlockId))
    .get()!;

  assert.equal(
    blockBeforeAccept.content,
    "Jarumnya bergerak sendiri ke arah puncak gunung!",
    "AI tidak boleh langsung menimpa data produksi tanpa konfirmasi pengguna."
  );

  // Now simulate user explicit review & Accept
  const updatedBlock = scriptService.updateBlock(v2DialogueBlockId, {
    content: assistResult.suggestion,
  });

  assert.equal(updatedBlock.content, assistResult.suggestion);
});

// ==================== TEST 7: SCENE & SHOT GENERATION ====================
test("7. Gemini scene structure and shot breakdown generation with user application", async () => {
  // Mock Gemini for Scene Generation
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: JSON.stringify({
            scenes: [
              {
                sceneNumber: 2,
                sceneCode: "SC002",
                heading: "EXT. JALAN SETAPAK HUTAN BISIKAN - SORE",
                location: "Hutan Bisikan",
                timeOfDay: "SORE",
                description: "Tiga anak berjalan menyusuri hutan pinus berkabut.",
                charactersInvolved: ["Raka", "Lila", "Bimo", "Mimo"],
              },
            ],
          }),
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 80 },
        };
      },
    },
  });

  const sceneProposals = await sceneShotGen.generateScenesFromScript({
    projectId,
    contentItemId: contentId,
    scriptVersionId: version2Id,
  });

  assert.equal(sceneProposals.length, 1);
  assert.equal(sceneProposals[0].sceneCode, "SC002");

  // Apply generated scene
  sceneShotGen.applyGeneratedScenes({
    scriptVersionId: version2Id,
    scenes: sceneProposals,
  });

  const v2Detail = scriptService.getVersionDetail(version2Id)!;
  assert.equal(v2Detail.scenes.length, 2);

  // Mock Gemini for Shot Breakdown
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        return {
          text: JSON.stringify({
            shots: [
              {
                shotNumber: 92,
                shotCode: "SH092",
                title: "Raka Menatap Puncak",
                cameraType: "CLOSE UP",
                action: "Raka memegang kompas dengan mata terbelalak penasaran.",
                dialogue: "Ayo kita berangkat sekarang!",
                durationTarget: 3,
                notes: "Lighting keemasan sore hari.",
              },
            ],
          }),
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 60 },
        };
      },
    },
  });

  const shotProposals = await sceneShotGen.generateShotsFromScene({
    projectId,
    contentItemId: contentId,
    scriptSceneId: v2Scene1Id,
    startingShotNumber: 92,
  });

  assert.equal(shotProposals.length, 1);
  assert.equal(shotProposals[0].shotCode, "SH092");

  // Apply to production shots
  sceneShotGen.applyGeneratedShots({
    projectId,
    contentItemId: contentId,
    sceneId: anchorBSceneId,
    shots: shotProposals,
  });

  const prodShot92 = database.db
    .select()
    .from(database.schema.shots)
    .where(eq(database.schema.shots.shotCode, "SH092"))
    .get();

  assert.ok(prodShot92);
  assert.equal(prodShot92.title, "Raka Menatap Puncak");
});

// ==================== TEST 8: SCRIPT CHANGE IMPACT & SH016 WARNING ====================
test("8. Change impact comparison detects modified dialogue in ANCHOR_B and flags SH016 warning without blocking", () => {
  // Compare locked V01 against V02 (which has modified dialogue on scene ANCHOR_B)
  const report = changeImpactService.compareScriptVersions(version1Id, version2Id);

  assert.equal(report.hasModifications, true);
  assert.ok(report.diffs.length > 0);

  const blockDiff = report.diffs.find((d) => d.type === "BLOCK_MODIFIED");
  assert.ok(blockDiff, "Harus terdeteksi BLOCK_MODIFIED pada adegan ANCHOR_B.");
  assert.equal(blockDiff.sceneCode, "ANCHOR_B");

  // In Lembah Awan canon, ANCHOR_B covers shots 9 to 31, which includes SH016!
  assert.ok(report.affectedShots.length > 0, "Harus mendeteksi shot produksi yang terdampak.");
  const sh016 = report.affectedShots.find((s) => s.shotCode === "SH016");
  assert.ok(sh016, "Shot SH016 WAJIB terdeteksi sebagai shot terdampak perubahan skrip!");
  assert.equal(sh016.impactLevel, "HIGH");
  assert.match(sh016.reason, /mengalami perubahan dialog atau aksi/i);

  // Warning banner must be present and non-blocking
  assert.ok(report.warningMessage);
  assert.match(report.warningMessage, /mempengaruhi.*shot produksi.*SH016/i);
});

// ==================== TEST 9: RESILIENCE & ERROR HANDLING ====================
test("9. Gemini API failure returns clear Indonesian error and manual workflow remains functional", async () => {
  // Simulate Gemini API network failure
  geminiClient.setGeminiClientOverride({
    models: {
      generateContent: async () => {
        throw new Error("fetch failed: ECONNREFUSED");
      },
    },
  });

  await assert.rejects(
    async () => {
      await scriptAiService.executeScriptAiAssist({
        projectId,
        contentItemId: contentId,
        scriptVersionId: version2Id,
        scriptSceneId: v2Scene1Id,
        action: "REWRITE",
        targetContent: "Teks uji kegagalan",
      });
    },
    (err: unknown) => {
      const error = err as { code: string; message: string };
      assert.equal(error.code, "NETWORK_FAILURE");
      assert.match(error.message, /Gagal terhubung.*koneksi internet/i);
      return true;
    }
  );

  // Manual block editing MUST continue to function flawlessly
  const manualBlock = scriptService.addBlock(v2Scene1Id, {
    blockType: "ACTION",
    content: "Aksi manual tetap tersimpan meskipun Gemini tidak dapat diakses.",
  });

  assert.ok(manualBlock);
  assert.equal(
    manualBlock.content,
    "Aksi manual tetap tersimpan meskipun Gemini tidak dapat diakses."
  );
});
