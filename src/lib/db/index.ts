import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "./schema";
export { schema };


const dataDirectory = process.env.PRODUCTION_CONTROL_DATA_DIR
  ? path.resolve(process.env.PRODUCTION_CONTROL_DATA_DIR)
  : path.join(process.cwd(), ".local-production-control");

mkdirSync(dataDirectory, { recursive: true });

const sqlite = new Database(path.join(dataDirectory, "production-control.sqlite"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

let migrated = false;

function seedKnownProjectData() {
  const seededProject = db.select().from(schema.projects).where(sql`lower(${schema.projects.code}) = 'lembah-awan' or lower(${schema.projects.name}) = 'petualangan di lembah awan'`).get();
  let project = seededProject;
  if (!project) {
    const now = new Date();
    project = {
      id: crypto.randomUUID(), code: "LEMBAH-AWAN", name: "Petualangan di Lembah Awan", description: "",
      projectType: "ANIMATION_SERIES", status: "NOT_STARTED", rootPath: "D:\\AI-PRODUCTION\\LEMBAH-AWAN",
      defaultAspectRatio: "16:9", defaultLanguage: "Indonesian", isArchived: false, archivedAt: null, createdAt: now, updatedAt: now,
    };
    db.insert(schema.projects).values(project).run();
  }
  const currentProject = project;

  db.transaction((tx) => {
    let season = tx.select().from(schema.seasons).where(and(eq(schema.seasons.projectId, currentProject.id), eq(schema.seasons.seasonNumber, 1))).get();
    if (!season) {
      const now = new Date();
      season = { id: crypto.randomUUID(), projectId: currentProject.id, code: "SEASON_01", seasonNumber: 1, name: "Season 1", description: "", status: "NOT_STARTED", createdAt: now, updatedAt: now };
      tx.insert(schema.seasons).values(season).run();
    }

    let content = tx.select().from(schema.contentItems).where(and(eq(schema.contentItems.projectId, currentProject.id), eq(schema.contentItems.code, "EP01"))).get();
    if (!content) {
      const now = new Date();
      content = {
        id: crypto.randomUUID(),
        projectId: currentProject.id,
        seasonId: season.id,
        code: "EP01",
        contentNumber: 1,
        title: "Lonceng di Puncak Gunung",
        contentType: "EPISODE",
        description: "",
        durationTarget: null,
        status: "NOT_STARTED",
        audioStatus: "NOT_STARTED",
        editStatus: "NOT_STARTED",
        isArchived: false,
        archivedAt: null,
        priority: "NORMAL",
        createdAt: now,
        updatedAt: now,
      };
      tx.insert(schema.contentItems).values(content).run();
    }
    const currentContent = content;

    const anchors = [
      { code: "ANCHOR_A", location: "Gunung Awan / Lonceng", first: 1, last: 8 },
      { code: "ANCHOR_B", location: "Desa / Rumah Pak Arga / Kompas", first: 9, last: 31 },
      { code: "ANCHOR_C", location: "Hutan Bisikan", first: 32, last: 41 },
      { code: "ANCHOR_D", location: "Sungai & Jembatan Tua", first: 42, last: 54 },
      { code: "ANCHOR_E", location: "Pintu Rahasia & Lorong Masuk", first: 55, last: 64 },
      { code: "ANCHOR_F", location: "Lorong Kuno & Gambar Tiga Anak", first: 65, last: 81 },
      { code: "ANCHOR_G", location: "Cliffhanger & Ending", first: 82, last: 91 },
    ];
    const sceneByAnchor = new Map<string, string>();
    for (const [index, anchor] of anchors.entries()) {
      let scene = tx.select().from(schema.scenes).where(and(eq(schema.scenes.contentItemId, currentContent.id), eq(schema.scenes.code, anchor.code))).get();
      if (!scene) {
        const now = new Date();
        scene = { id: crypto.randomUUID(), projectId: currentProject.id, contentItemId: currentContent.id, code: anchor.code, sceneNumber: index + 1, title: anchor.code.replace("_", " "), location: anchor.location, description: "", durationTarget: null, status: "NOT_STARTED", createdAt: now, updatedAt: now };
        tx.insert(schema.scenes).values(scene).run();
      }
      sceneByAnchor.set(anchor.code, scene.id);
    }

    const ranges = anchors.map((anchor) => ({ ...anchor, sceneId: sceneByAnchor.get(anchor.code)! }));
    const existing = new Set(tx.select({ code: schema.shots.shotCode }).from(schema.shots).where(eq(schema.shots.contentItemId, currentContent.id)).all().map((row) => row.code));
    const now = new Date();
    for (let number = 1; number <= 91; number += 1) {
      const shotCode = `SH${String(number).padStart(3, "0")}`;
      if (existing.has(shotCode)) continue;
      const anchor = ranges.find((range) => number >= range.first && number <= range.last)!;
      tx.insert(schema.shots).values({
        id: crypto.randomUUID(), projectId: currentProject.id, contentItemId: currentContent.id, sceneId: anchor.sceneId,
        shotCode, shotNumber: number, title: "Belum diberi judul", description: "", durationTarget: null,
        cameraType: "", action: "", dialogue: "", notes: "Detail shot belum tersedia pada data sumber.",
        status: "NOT_STARTED", priority: "NORMAL", createdAt: now, updatedAt: now,
      }).run();
    }

    seedScriptStudioData(tx, currentProject.id);
    seedPromptStudioData(tx, currentProject.id);
  });
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function seedScriptStudioData(tx: Transaction, projectId: string) {
  const now = new Date();

  // Characters
  const characters = [
    {
      name: "Raka",
      age: "10 tahun",
      role: "Protagonis utama",
      personality: "Pemberani, ingin tahu, setia kawan, bertindak cepat",
      appearance: "Rambut pendek sedikit berantakan, mata berbinar penuh semangat",
      costume: "Rompi petualang cokelat muda dengan banyak saku, kaos hijau zaitun, celana kargo pendek",
      signatureProps: "Kompas tua peninggalan Pak Arga, teropong saku kecil",
      storyFunction: "Penggerak aksi utama, memimpin penyelidikan misteri Lembah Awan",
      rules: "Tidak pernah meninggalkan teman di belakang; selalu memeriksa kompas sebelum mengambil keputusan besar",
      notes: "Karakter kanon Lembah Awan",
    },
    {
      name: "Lila",
      age: "10 tahun",
      role: "Sahabat & analis cerdas",
      personality: "Teliti, analitis, logis, tenang di bawah tekanan, suka membaca tanda alam",
      appearance: "Rambut dikepang rapi samping, tatapan tajam dan observatif",
      costume: "Baju lengan panjang praktis warna biru laut, syal kuning kecil, tas selempang kulit",
      signatureProps: "Buku catatan sketsa dan jurnal pengamatan, kaca pembesar lipat",
      storyFunction: "Menerjemahkan teka-teki, simbol kuno, dan petunjuk peta",
      rules: "Mencatat semua fenomena aneh di jurnalnya; mengingatkan risiko sebelum melangkah",
      notes: "Karakter kanon Lembah Awan",
    },
    {
      name: "Bimo",
      age: "11 tahun",
      role: "Sahabat & kekuatan fisik / pelindung",
      personality: "Hangat, loyal, suka makanan, waspada, cepat melindungi teman saat bahaya",
      appearance: "Berpostur lebih besar dan tegap, senyum ramah",
      costume: "Kaos oranye terang berlapis jaket tanpa lengan tahan cuaca, sepatu bot kokoh",
      signatureProps: "Tali tambang rami serbaguna, bekal camilan dalam kantong kain",
      storyFunction: "Dukungan fisik, mengatasi rintangan medan, penjaga moral kelompok",
      rules: "Selalu memprioritaskan keselamatan Lila dan Raka; tidak suka berada di tempat sempit berlama-lama",
      notes: "Karakter kanon Lembah Awan",
    },
    {
      name: "Mimo",
      age: "Tidak diketahui",
      role: "Maskot & makhluk penjaga kabut",
      personality: "Lincah, jenaka, sensitif terhadap perubahan energi awan/kabut",
      appearance: "Makhluk mungil berbulu putih menyerupai gumpalan awan dengan telinga lembut dan ekor berputar",
      costume: "Kalung lonceng mini perak antik di leher",
      signatureProps: "Lonceng mini yang berdenting saat ada bahaya atau keajaiban",
      storyFunction: "Petunjuk arah naluriah, memperingatkan bahaya kabut gaib",
      rules: "Hanya berkomunikasi dengan gerak-gerik dan suara denting/dengkur lembut",
      notes: "Karakter kanon Lembah Awan",
    },
  ];

  for (const c of characters) {
    const existing = tx.select().from(schema.characters).where(and(eq(schema.characters.projectId, projectId), eq(schema.characters.name, c.name))).get();
    if (!existing) {
      tx.insert(schema.characters).values({
        id: crypto.randomUUID(),
        projectId,
        ...c,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }

  // Environments
  const environments = [
    {
      name: "Desa Lembah Awan",
      description: "Desa asri di lembah dataran tinggi yang dikelilingi perbukitan hijau berkabut",
      visualCharacteristics: "Rumah-rumah panggung kayu beratap ijuk tradisional, jalan setapak batu kali, kabut tipis mengalir di pagi dan sore",
      tone: "Hangat, damai, bersahaja",
      timeOfDayNotes: "Pagi berkabut lembut keemasan, siang sejuk berangin, malam berbintang dengan lentera gantung",
      rules: "Warga desa hidup harmonis dengan ritme alam dan menghormati bunyi lonceng gunung",
      referenceAssets: "",
    },
    {
      name: "Rumah Pak Arga",
      description: "Rumah kayu tua di tepi bukit desa tempat kakek Raka menyimpan catatan dan artefak",
      visualCharacteristics: "Interior penuh rak buku usang, peta-peta tua di dinding, jam bandul kayu kuno, jendela menghadap lembah",
      tone: "Misterius namun hangat dan penuh kenangan",
      timeOfDayNotes: "Cahaya matahari sore menerobos celah jendela kayu",
      rules: "Tempat penemuan kompas misterius dan peta rahasia",
      referenceAssets: "",
    },
    {
      name: "Hutan Bisikan",
      description: "Hutan pinus dan lumut lebat yang pepohonannya bersiul lembut saat angin bertiup",
      visualCharacteristics: "Pohon tinggi menjulang dengan lumut hijau tebal, kabut berputar lambat di sela batang pohon, cahaya menembus kanopi tipis",
      tone: "Misterius, magis, hening",
      timeOfDayNotes: "Cahaya temaram sepanjang hari karena kabut tebal",
      rules: "Jangan berteriak; suara dipantulkan kembali dalam bisikan kabut",
      referenceAssets: "",
    },
    {
      name: "Gunung Awan",
      description: "Puncak gunung tertinggi yang puncaknya hampir selalu terselubung awan tebal",
      visualCharacteristics: "Tebing batu kapur putih, jalur setapak terjal, awan melayang sejajar dengan langkah pendaki",
      tone: "Megah, dingin, sakral",
      timeOfDayNotes: "Angin kencang bersuhu dingin, matahari bersinar menembus lapisan awan",
      rules: "Hanya yang berniat tulus yang dapat menemukan jalan menembus kabut puncak",
      referenceAssets: "",
    },
    {
      name: "Sungai & Jembatan Tua",
      description: "Aliran sungai jernih berarus deras dengan jembatan gantung kayu tali tua di atasnya",
      visualCharacteristics: "Batu-batu sungai besar berlumut, kayu jembatan yang lapuk namun kokoh, gemercik air deras berbusa putih",
      tone: "Menantang, berdesir, penuh ketegangan petualangan",
      timeOfDayNotes: "Pantulan sinar matahari berkilau di permukaan air deras",
      rules: "Hanya satu orang melintas jembatan dalam satu waktu",
      referenceAssets: "",
    },
    {
      name: "Pintu Rahasia & Lorong Kuno",
      description: "Pintu batu berukir simbol kuno yang tersembunyi di balik akar pohon raksasa menuju lorong bawah tanah",
      visualCharacteristics: "Dinding batu berlumut basah dengan relik kuno, tangga batu menurun, gambar tiga anak terukir di dinding",
      tone: "Kuno, rahasia, penuh teka-teki masa lalu",
      timeOfDayNotes: "Gelap gulita, hanya diterangi obor atau kristal pendar alam",
      rules: "Pintu hanya terbuka jika tiga simbol diselaraskan secara bersamaan",
      referenceAssets: "",
    },
    {
      name: "Menara Lonceng Awan",
      description: "Menara batu tua di dataran tinggi tempat lonceng mistis Lembah Awan berada",
      visualCharacteristics: "Arsitektur batu silindris dengan lonceng perunggu raksasa berukir sulur awan di puncak terbuka",
      tone: "Ikonik, bersejarah, menggetarkan hati",
      timeOfDayNotes: "Disinari cahaya fajar keemasan pertama yang menembus lautan awan",
      rules: "Lonceng hanya berdenting sendiri saat peristiwa penting lembah akan terjadi",
      referenceAssets: "",
    },
  ];

  for (const env of environments) {
    const existing = tx.select().from(schema.environments).where(and(eq(schema.environments.projectId, projectId), eq(schema.environments.name, env.name))).get();
    if (!existing) {
      tx.insert(schema.environments).values({
        id: crypto.randomUUID(),
        projectId,
        ...env,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }

  // Story Bible
  const existingStoryBible = tx.select().from(schema.storyBibles).where(eq(schema.storyBibles.projectId, projectId)).get();
  if (!existingStoryBible) {
    tx.insert(schema.storyBibles).values({
      id: crypto.randomUUID(),
      projectId,
      versionNumber: 1,
      versionLabel: "V01",
      premise: "Tiga anak bersahabat di desa tersembunyi Lembah Awan menemukan kompas tua misterius yang bergetar setiap kali lonceng puncak gunung berdentang tanpa ada yang membunyikannya.",
      worldRules: "Kabut di Lembah Awan memiliki sifat gaib yang merespons perasaan dan ketulusan hati para penjelajahnya.",
      mystery: "Siapakah pembangun menara lonceng kuno dan apa arti ramalan lukisan tiga anak di lorong rahasia?",
      themes: "Persahabatan, keberanian, menghormati alam, rasa ingin tahu ilmiah vs keajaiban tradisi",
      storyEngine: "Petualangan penemuan misteri artefak masa lalu untuk melindungi harmoni Lembah Awan",
      tone: "Petualangan anak hangat, penuh imajinasi, ramah keluarga, misterius tanpa horor",
      constraints: "Tidak boleh ada kekerasan visual ekstrem, bahasa kasar, atau elemen horor menakutkan; aman untuk penonton anak dan keluarga.",
      isCurrent: true,
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  // Style Bible
  const existingStyleBible = tx.select().from(schema.styleBibles).where(eq(schema.styleBibles.projectId, projectId)).get();
  if (!existingStyleBible) {
    tx.insert(schema.styleBibles).values({
      id: crypto.randomUUID(),
      projectId,
      visualStyle: "Semi-realistis bertekstur hangat (warm storybook cinematic 3D/2.5D animation aesthetic)",
      audience: "Anak-anak (7-12 tahun) dan keluarga",
      tone: "Petualangan hangat, penuh warna alami, magis dan menenangkan",
      cameraLanguage: "Shot lebar pemandangan megah (establishing landscapes), eye-level anak-anak untuk kedekatan emosional, kamera dinamis lembut saat aksi petualangan",
      lighting: "Golden hour hangat, diffused daylight berkabut lembut, cahaya pendar magis lentera di malam hari",
      paletteNotes: "Hijau zamrud hutan, biru langit awan, cokelat kayu hangat, sentuhan emas kehangatan fajar",
      forbiddenVisuals: "Darah, kekerasan fisik brutal, elemen horor gelap/menakutkan, desain karakter yang terlalu seram atau distopik",
      continuityRules: "Warna rompi Raka selalu cokelat, syal Lila kuning laut, jaket Bimo oranye, dan lonceng mini Mimo selalu di leher",
      createdAt: now,
      updatedAt: now,
    }).run();
  }
}

function seedPromptStudioData(tx: Transaction, projectId: string) {
  const now = new Date();

  // Find SH016
  const sh016 = tx.select().from(schema.shots).where(and(eq(schema.shots.projectId, projectId), eq(schema.shots.shotCode, "SH016"))).get();
  if (sh016) {
    tx.update(schema.shots)
      .set({
        title: "Pak Arga Menunjukkan Kompas Kuno",
        description: "Pak Arga memperlihatkan kompas tua misterius peninggalan leluhur kepada Raka dan Lila di meja kayu dekat jendela Rumah Pak Arga saat cahaya pagi menerobos hangat.",
        action: "Pak Arga perlahan membuka kotak beludru tua dan mengangkat kompas kuno berukir motif sulur awan. Raka dan Lila mencondongkan badan ke depan dengan mata berbinar penuh rasa ingin tahu.",
        dialogue: "Pak Arga: 'Kompas ini tidak menunjuk ke utara, Raka... ia menunjuk ke tempat di mana kabut berbisik.'",
        cameraType: "Medium Two-Shot, eye-level slowly pushing in",
        durationTarget: 4.0,
        updatedAt: now,
      })
      .where(eq(schema.shots.id, sh016.id))
      .run();

    // Check or create KF-B08 asset
    let kfAsset = tx.select().from(schema.assets).where(and(eq(schema.assets.projectId, projectId), eq(schema.assets.assetCode, "KF-B08"))).get();
    if (!kfAsset) {
      kfAsset = {
        id: crypto.randomUUID(),
        projectId,
        assetCode: "KF-B08",
        assetType: "IMAGE",
        name: "Keyframe B08 - Pak Arga Menunjukkan Kompas",
        description: "Start frame keyframe referensi untuk SH016 (Rumah Pak Arga, Pak Arga membuka kompas kuno di hadapan Raka dan Lila)",
        status: "APPROVED",
        isShared: false,
        isArchived: false,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      tx.insert(schema.assets).values(kfAsset).run();
    }
    const currentKfAsset = kfAsset;

    const kfVersion = tx.select().from(schema.assetVersions).where(and(eq(schema.assetVersions.assetId, currentKfAsset.id), eq(schema.assetVersions.versionNumber, 1))).get();
    if (!kfVersion) {
      const versionId = crypto.randomUUID();
      tx.insert(schema.assetVersions).values({
        id: versionId,
        projectId,
        assetId: currentKfAsset.id,
        versionNumber: 1,
        versionLabel: "V01",
        filename: "KF-B08_v01.png",
        relativePath: "CONTENT/EP01/SH016/REFERENCES/KF-B08_v01.png",
        mimeType: "image/png",
        sizeBytes: 245760,
        width: 1920,
        height: 1080,
        durationSeconds: null,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        isCurrent: true,
        isLocked: true,
        createdAt: now,
        notes: "Canonical start frame keyframe for SH016 video generation",
      }).run();
    }

    // Link KF-B08 to SH016 as START_FRAME in shot_assets
    const existingLink = tx.select().from(schema.shotAssets).where(
      and(
        eq(schema.shotAssets.shotId, sh016.id),
        eq(schema.shotAssets.assetId, currentKfAsset.id),
        eq(schema.shotAssets.role, "START_FRAME")
      )
    ).get();

    if (!existingLink) {
      tx.insert(schema.shotAssets).values({
        id: crypto.randomUUID(),
        projectId,
        shotId: sh016.id,
        assetId: currentKfAsset.id,
        role: "START_FRAME",
        sortOrder: 0,
        notes: "Start frame keyframe for video generation",
      }).run();
    }

    // Character & Environment reference assets for SH016
    const refAssets = [
      {
        code: "CHAR-RAKA",
        name: "Model Sheet Raka",
        type: "REFERENCE" as const,
        desc: "Rambut pendek berantakan, rompi petualang cokelat muda, celana kargo pendek",
        role: "CHARACTER_REFERENCE" as const,
      },
      {
        code: "CHAR-LILA",
        name: "Model Sheet Lila",
        type: "REFERENCE" as const,
        desc: "Rambut kepang samping rapi, baju lengan panjang biru laut, syal kuning kecil",
        role: "CHARACTER_REFERENCE" as const,
      },
      {
        code: "CHAR-ARGA",
        name: "Model Sheet Pak Arga",
        type: "REFERENCE" as const,
        desc: "Kakek 68 tahun, janggut putih terawat, kacamata bulat kecil, baju katun pedesaan",
        role: "CHARACTER_REFERENCE" as const,
      },
      {
        code: "ENV-RUMAH-ARGA",
        name: "Concept Art Rumah Pak Arga",
        type: "REFERENCE" as const,
        desc: "Interior rumah kayu tua di tepi bukit desa, rak buku usang, jendela kayu disinari cahaya pagi hangat",
        role: "ENVIRONMENT_REFERENCE" as const,
      },
    ];

    for (const ref of refAssets) {
      let a = tx.select().from(schema.assets).where(and(eq(schema.assets.projectId, projectId), eq(schema.assets.assetCode, ref.code))).get();
      if (!a) {
        a = {
          id: crypto.randomUUID(),
          projectId,
          assetCode: ref.code,
          assetType: ref.type,
          name: ref.name,
          description: ref.desc,
          status: "APPROVED",
          isShared: false,
          isArchived: false,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        tx.insert(schema.assets).values(a).run();
      }
      const currentA = a;

      const hasLink = tx.select().from(schema.shotAssets).where(
        and(
          eq(schema.shotAssets.shotId, sh016.id),
          eq(schema.shotAssets.assetId, currentA.id),
          eq(schema.shotAssets.role, ref.role)
        )
      ).get();

      if (!hasLink) {
        tx.insert(schema.shotAssets).values({
          id: crypto.randomUUID(),
          projectId,
          shotId: sh016.id,
          assetId: currentA.id,
          role: ref.role,
          sortOrder: 1,
          notes: ref.desc,
        }).run();
      }
    }
  }
}

function seedAiFoundation() {
  const now = new Date();
  const tasks = [
    { code: "SCRIPT_GENERATION" as const, name: "Pembuatan skrip", description: "Membuat draf skrip berdasarkan konteks produksi.", defaultThinkingLevel: "HIGH" as const },
    { code: "SCRIPT_REWRITE" as const, name: "Revisi skrip", description: "Merevisi skrip tanpa mengubah data produksi otomatis.", defaultThinkingLevel: "HIGH" as const },
    { code: "DIALOGUE_POLISH" as const, name: "Penyempurnaan dialog", description: "Menyempurnakan dialog sesuai konteks shot.", defaultThinkingLevel: "MEDIUM" as const },
    { code: "SCENE_BREAKDOWN" as const, name: "Breakdown adegan", description: "Menganalisis scene menjadi kebutuhan produksi.", defaultThinkingLevel: "HIGH" as const },
    { code: "SHOT_BREAKDOWN" as const, name: "Breakdown shot", description: "Menganalisis shot menjadi langkah produksi dan teknis.", defaultThinkingLevel: "HIGH" as const },
    { code: "PROMPT_GENERATION" as const, name: "Pembuatan prompt", description: "Menyusun prompt gambar/video berdasarkan konteks shot dan referensi.", defaultThinkingLevel: "MEDIUM" as const },
    { code: "CONTINUITY_CHECK" as const, name: "Pemeriksaan kontinuitas", description: "Memeriksa kontinuitas karakter, lighting, lingkungan, dan aksi antar shot berdekatan.", defaultThinkingLevel: "HIGH" as const },
    { code: "PRODUCTION_REVIEW" as const, name: "Tinjauan produksi", description: "Meninjau kesiapan produksi dan kelayakan teknis shot.", defaultThinkingLevel: "HIGH" as const },
  ];
  for (const task of tasks) {
    const existing = db.select().from(schema.aiTasks).where(eq(schema.aiTasks.code, task.code)).get();
    if (!existing) {
      db.insert(schema.aiTasks).values({
        id: crypto.randomUUID(),
        code: task.code,
        name: task.name,
        description: task.description,
        defaultThinkingLevel: task.defaultThinkingLevel,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }
}

function seedPromptTemplates() {
  const now = new Date();
  const defaultTemplates = [
    {
      code: "IMAGE_ESTABLISHING",
      category: "ANIMATION",
      name: "Animation Establishing Shot",
      promptType: "IMAGE" as const,
      description: "Wide establishing landscape with atmosphere, depth, and environmental storytelling",
      templateText: "Wide cinematic establishing shot of {{environment}}, {{lighting_and_atmosphere}}, {{camera_angle}}, storybook 3D animation style, rich environmental details, volumetric atmosphere, cinematic color palette, highly detailed --ar 16:9",
      negativePrompt: "modern buildings, electrical wires, blurry, low resolution, deformed geometry, oversaturated neon, photorealistic human faces",
      defaultParametersJson: JSON.stringify({ aspectRatio: "16:9", resolution: "1080p", engine: "MIDJOURNEY" }),
      isSystem: true,
    },
    {
      code: "IMAGE_CHARACTER",
      category: "ANIMATION",
      name: "Animation Character Showcase",
      promptType: "IMAGE" as const,
      description: "Character key portrait or action pose in environment",
      templateText: "Medium close-up shot of {{character}}, {{costume}}, {{action_or_pose}} in {{environment}}, {{lighting}}, expressive animated eyes, stylized 3D family animation feature film quality, warm emotional lighting, masterpiece --ar 16:9",
      negativePrompt: "distorted face, extra fingers, malformed hands, asymmetric eyes, dark gritty horror, photorealistic, uncanny valley",
      defaultParametersJson: JSON.stringify({ aspectRatio: "16:9", resolution: "1080p", engine: "MIDJOURNEY" }),
      isSystem: true,
    },
    {
      code: "IMAGE_ENVIRONMENT",
      category: "ANIMATION",
      name: "Animation Environment Setting",
      promptType: "IMAGE" as const,
      description: "Interior or exterior environment setting with focus on props, textures, and mood",
      templateText: "Detailed interior/exterior scene of {{environment}}, featuring {{props_and_details}}, {{time_of_day}} with {{lighting}}, cozy storybook atmospheric animation aesthetic, textured wood and foliage, soft shadows --ar 16:9",
      negativePrompt: "flat lighting, 2d sketch, modern clutter, distorted perspective, gloomy horror",
      defaultParametersJson: JSON.stringify({ aspectRatio: "16:9", resolution: "1080p", engine: "MIDJOURNEY" }),
      isSystem: true,
    },
    {
      code: "VIDEO_I2V_FAMILY_ADVENTURE",
      category: "ANIMATION",
      name: "Animation I2V Family Adventure",
      promptType: "VIDEO" as const,
      description: "Image-to-video motion prompt starting from reference keyframe with gentle camera motion and expressive character acting",
      templateText: "Starting from keyframe image {{start_frame_reference}}: {{character}} is in {{environment}}. {{action_and_movement}}. {{camera_movement}}. Warm golden morning light, subtle atmospheric dust particles floating in the air. Whimsical animated family adventure tone, smooth cinematic motion, fluid cloth and hair physics, no morphing, no distortion --duration 4s --ar 16:9",
      negativePrompt: "jitter, abrupt morphing, flickering, character body warping, unnatural jerky motion, extra limbs, frame glitch, modern cars, text watermark",
      defaultParametersJson: JSON.stringify({ aspectRatio: "16:9", duration: 4, resolution: "1080p", engine: "VEO", audio: false }),
      isSystem: true,
    },
    {
      code: "VIDEO_DIALOGUE",
      category: "ANIMATION",
      name: "Animation Dialogue & Interaction",
      promptType: "VIDEO" as const,
      description: "Subtle facial expressions, eye contact, and character interaction during dialogue",
      templateText: "Close-up / medium two-shot: {{character}} speaks with expressive facial movement and subtle gestures: '{{dialogue}}'. {{camera_movement}}, maintaining steady emotional focus. Soft cinematic key lighting, detailed animated character expressions, natural blinking and lip sync readiness --duration 4s --ar 16:9",
      negativePrompt: "dead eyes, robotic mouth movements, distorted teeth, floating heads, warped features, jump cuts",
      defaultParametersJson: JSON.stringify({ aspectRatio: "16:9", duration: 4, resolution: "1080p", engine: "VEO", audio: true }),
      isSystem: true,
    },
    {
      code: "VIDEO_ACTION",
      category: "ANIMATION",
      name: "Animation Dynamic Action",
      promptType: "VIDEO" as const,
      description: "Dynamic camera follow, rapid movement, and energetic animation action",
      templateText: "Dynamic tracking shot: {{character}} {{action_and_movement}} across {{environment}}. {{camera_movement}}, following the momentum of the action. High energy adventure, dynamic cloth simulation, swirling wind and environmental particles, cinematic action framing --duration 5s --ar 16:9",
      negativePrompt: "slow motion stutter, motion blur smear, missing limbs during fast movement, broken anatomy, temporal flickering",
      defaultParametersJson: JSON.stringify({ aspectRatio: "16:9", duration: 5, resolution: "1080p", engine: "VEO", audio: false }),
      isSystem: true,
    },
    {
      code: "VIDEO_MYSTERY",
      category: "ANIMATION",
      name: "Animation Atmospheric Mystery",
      promptType: "VIDEO" as const,
      description: "Moody, suspenseful discovery shot with lighting reveals and slow push-in",
      templateText: "Slow cinematic push-in shot in {{environment}}: {{character}} discovers {{props_and_details}}. {{action_and_movement}}. Ethereal mist swirls softly, dramatic volumetric shafts of light pierce through the gloom. Suspenseful wonder, quiet awe, family adventure mystery mood --duration 4s --ar 16:9",
      negativePrompt: "jump scares, grotesque monsters, gory elements, noisy grain, jittery camera",
      defaultParametersJson: JSON.stringify({ aspectRatio: "16:9", duration: 4, resolution: "1080p", engine: "VEO", audio: false }),
      isSystem: true,
    },
    {
      code: "UGC_HOOK",
      category: "UGC",
      name: "UGC High Retention Hook",
      promptType: "VIDEO" as const,
      description: "High-energy first 3 seconds hook shot with fast visual pattern interrupt",
      templateText: "Vertical 9:16 UGC video hook: Creator leaning towards the camera with an engaging, surprised expression holding {{prop_or_product}}. Fast zoom-in camera movement, vibrant natural lighting, authentic relatable creator vibe, crisp smartphone camera clarity --ar 9:16 --duration 3s",
      negativePrompt: "overly polished studio commercial, fake corporate aesthetic, blur, bad audio sync, robotic expression",
      defaultParametersJson: JSON.stringify({ aspectRatio: "9:16", duration: 3, resolution: "1080p", engine: "KLING", audio: true }),
      isSystem: true,
    },
    {
      code: "UGC_TALKING_HEAD",
      category: "UGC",
      name: "UGC Talking Head Presentation",
      promptType: "VIDEO" as const,
      description: "Direct to camera conversational presentation with natural gestures",
      templateText: "Vertical 9:16 UGC talking head: Relatable creator speaking warmly directly into the camera lens with natural hand gestures and smile in a modern cozy room setup. Subtle dynamic camera punch-ins on key points, ring light with natural soft fill, sharp 4K mobile video quality --ar 9:16 --duration 6s",
      negativePrompt: "monotone staring, weird hand morphing, blurry background artifacts, stilted body posture",
      defaultParametersJson: JSON.stringify({ aspectRatio: "9:16", duration: 6, resolution: "1080p", engine: "KLING", audio: true }),
      isSystem: true,
    },
    {
      code: "UGC_PRODUCT",
      category: "UGC",
      name: "UGC Product Showcase",
      promptType: "VIDEO" as const,
      description: "Close-up hands-on product demonstration with macro details",
      templateText: "Crisp macro close-up of creator hands unboxing / showcasing {{product}} on a clean wooden desk. Smooth slow pan across texture and details, natural diffused daylight, tactile interaction, aesthetic lifestyle product videography --ar 9:16 --duration 4s",
      negativePrompt: "shaky camera, out of focus, distorted branding, dirty surface, artificial glares",
      defaultParametersJson: JSON.stringify({ aspectRatio: "9:16", duration: 4, resolution: "1080p", engine: "KLING", audio: false }),
      isSystem: true,
    },
    {
      code: "UGC_BROLL",
      category: "UGC",
      name: "UGC Dynamic B-Roll",
      promptType: "VIDEO" as const,
      description: "Atmospheric contextual cutaway shot matching narration",
      templateText: "Cinematic vertical B-roll of {{action_or_setting}}, smooth gimbal tracking camera motion, warm golden sunlight, aesthetic lifestyle vlog composition, soft background bokeh --ar 9:16 --duration 3s",
      negativePrompt: "overexposure, underexposure, sudden shake, chaotic framing",
      defaultParametersJson: JSON.stringify({ aspectRatio: "9:16", duration: 3, resolution: "1080p", engine: "KLING", audio: false }),
      isSystem: true,
    },
  ];

  for (const t of defaultTemplates) {
    const existing = db.select().from(schema.promptTemplates).where(eq(schema.promptTemplates.code, t.code)).get();
    if (!existing) {
      db.insert(schema.promptTemplates).values({
        id: crypto.randomUUID(),
        ...t,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }
}

function seedQcAndContinuityDefaults() {
  const now = new Date();

  const defaultContinuityRules: Array<{
    id: string;
    ruleType: schema.ContinuityRuleType;
    name: string;
    description: string;
    severity: schema.QcSeverity;
  }> = [
    {
      id: "CR_CHAR_01",
      ruleType: "CHARACTER_APPEARANCE",
      name: "Konsistensi Karakter",
      description: "Wajah, warna kulit, bentuk rambut, dan ciri fisik utama karakter harus konsisten antar shot.",
      severity: "MAJOR",
    },
    {
      id: "CR_COST_01",
      ruleType: "COSTUME",
      name: "Konsistensi Kostum",
      description: "Pakaian, aksesoris, tas, dan warna kostum tidak boleh berubah tanpa alasan cerita.",
      severity: "MAJOR",
    },
    {
      id: "CR_PROP_01",
      ruleType: "PROP",
      name: "Keberadaan & Status Properti",
      description: "Benda yang dipegang atau dibawa (misal kompas, lonceng) tidak boleh lenyap atau berganti posisi tiba-tiba.",
      severity: "MAJOR",
    },
    {
      id: "CR_LOC_01",
      ruleType: "LOCATION",
      name: "Konsistensi Lokasi & Geografi",
      description: "Latar belakang, landmark lingkungan, dan orientasi spasial dunia cerita harus konsisten.",
      severity: "MAJOR",
    },
    {
      id: "CR_TIME_01",
      ruleType: "TIME_OF_DAY",
      name: "Waktu Hari (Time of Day)",
      description: "Sudut matahari, nuansa pagi/siang/senja/malam harus selaras dalam adegan yang sama.",
      severity: "MAJOR",
    },
    {
      id: "CR_LIGHT_01",
      ruleType: "LIGHTING",
      name: "Arah & Karakter Pencahayaan",
      description: "Arah datangnya cahaya dan bayangan harus konsisten antar angle kamera berurutan.",
      severity: "MINOR",
    },
    {
      id: "CR_POS_01",
      ruleType: "POSITION",
      name: "Posisi Karakter (Screen Direction)",
      description: "Arah pandang dan posisi kiri/kanan karakter harus menjaga garis aksi (180-degree rule).",
      severity: "MAJOR",
    },
    {
      id: "CR_STORY_01",
      ruleType: "STORY_STATE",
      name: "Status Cerita & Kondisi Fisik",
      description: "Kondisi luka, kotoran, atau perubahan emosional akibat adegan sebelumnya harus terjaga.",
      severity: "CRITICAL",
    },
  ];

  for (const rule of defaultContinuityRules) {
    const existing = db.select().from(schema.continuityRules).where(eq(schema.continuityRules.id, rule.id)).get();
    if (!existing) {
      db.insert(schema.continuityRules).values({
        ...rule,
        projectId: null,
        enabled: true,
        createdAt: now,
      }).run();
    }
  }

  const defaultChecklistItems: Array<{
    id: string;
    category: schema.QcChecklistCategory;
    code: string;
    label: string;
    description: string;
    defaultSeverity: schema.QcSeverity;
  }> = [
    // Visual
    { id: "QC_VIS_CHAR", category: "VISUAL", code: "VIS_CHAR", label: "Character Identity", description: "Pemeriksaan identitas dan kemiripan wajah/proporsi karakter", defaultSeverity: "MAJOR" },
    { id: "QC_VIS_COST", category: "VISUAL", code: "VIS_COST", label: "Costume", description: "Pemeriksaan warna, tekstur, dan kelengkapan pakaian karakter", defaultSeverity: "MAJOR" },
    { id: "QC_VIS_ENV", category: "VISUAL", code: "VIS_ENV", label: "Environment", description: "Pemeriksaan keaslian lingkungan dan latar belakang adegan", defaultSeverity: "MAJOR" },
    { id: "QC_VIS_PROP", category: "VISUAL", code: "VIS_PROP", label: "Props", description: "Pemeriksaan kehadiran dan konsistensi properti penting", defaultSeverity: "MAJOR" },
    { id: "QC_VIS_LIGHT", category: "VISUAL", code: "VIS_LIGHT", label: "Lighting", description: "Pemeriksaan mood cahaya, kontras, dan arah pencahayaan", defaultSeverity: "MINOR" },
    { id: "QC_VIS_COMP", category: "VISUAL", code: "VIS_COMP", label: "Composition", description: "Pemeriksaan framing kamera, rule of thirds, dan ruang gerak", defaultSeverity: "MINOR" },
    { id: "QC_VIS_CAM", category: "VISUAL", code: "VIS_CAM", label: "Camera", description: "Pemeriksaan kestabilan pergerakan kamera dan angle pengambilan gambar", defaultSeverity: "MINOR" },
    { id: "QC_VIS_MOT", category: "VISUAL", code: "VIS_MOT", label: "Motion", description: "Pemeriksaan kelancaran gerakan, artefak gerakan AI, dan fisika animasi", defaultSeverity: "MAJOR" },
    // Technical
    { id: "QC_TECH_RES", category: "TECHNICAL", code: "TECH_RES", label: "Resolution", description: "Resolusi video sesuai standar target (1080p / 4K)", defaultSeverity: "CRITICAL" },
    { id: "QC_TECH_AR", category: "TECHNICAL", code: "TECH_AR", label: "Aspect Ratio", description: "Rasio aspek sesuai spesifikasi produksi (16:9 / 9:16)", defaultSeverity: "CRITICAL" },
    { id: "QC_TECH_DUR", category: "TECHNICAL", code: "TECH_DUR", label: "Duration", description: "Durasi render selaras dengan target durasi adegan/shot", defaultSeverity: "MAJOR" },
    { id: "QC_TECH_FILE", category: "TECHNICAL", code: "TECH_FILE", label: "File Validity", description: "Integritas berkas video (codec, playback mulus tanpa korupsi)", defaultSeverity: "CRITICAL" },
    { id: "QC_TECH_AUD", category: "TECHNICAL", code: "TECH_AUD", label: "Audio", description: "Sinkronisasi suara, kebersihan dialog, dan level volume", defaultSeverity: "MINOR" },
    // Story
    { id: "QC_STRY_SCR", category: "STORY", code: "STRY_SCR", label: "Script Match", description: "Kesesuaian adegan video dengan naskah dan action notes", defaultSeverity: "MAJOR" },
    { id: "QC_STRY_ACT", category: "STORY", code: "STRY_ACT", label: "Action Match", description: "Ketepatan gestur dan reaksi aksi karakter sesuai beat cerita", defaultSeverity: "MAJOR" },
    { id: "QC_STRY_DLG", category: "STORY", code: "STRY_DLG", label: "Dialogue", description: "Kesesuaian timing pergerakan bibir/akting dengan dialog naskah", defaultSeverity: "MINOR" },
    { id: "QC_STRY_UNW", category: "STORY", code: "STRY_UNW", label: "Unwanted Objects", description: "Bebas dari objek aneh, artefak AI, anggota tubuh abnormal, atau glitch visual", defaultSeverity: "MAJOR" },
  ];

  for (const item of defaultChecklistItems) {
    const existing = db.select().from(schema.qcChecklistItems).where(eq(schema.qcChecklistItems.id, item.id)).get();
    if (!existing) {
      db.insert(schema.qcChecklistItems).values({
        ...item,
        projectId: null,
        isEnabled: true,
        createdAt: now,
      }).run();
    }
  }
}

function seedDefaultSettings() {
  const existing = db.select().from(schema.systemSettings).where(eq(schema.systemSettings.id, "default")).get();
  if (!existing) {
    db.insert(schema.systemSettings).values({
      id: "default",
      language: "Indonesian",
      theme: "system",
      defaultProjectId: null,
      defaultAspectRatio: "16:9",
      backupRootPath: "",
      backupRetentionCount: 5,
      ignoredDirectoriesJson: JSON.stringify([".git", "node_modules", ".local-production-control", ".archive"]),
      autoScanOnLoad: false,
      updatedAt: new Date(),
    }).run();
  }
}

export function ensureDatabaseReady() {
  if (migrated) return;
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  seedKnownProjectData();
  seedAiFoundation();
  seedPromptTemplates();
  seedQcAndContinuityDefaults();
  seedDefaultSettings();
  migrated = true;
}
