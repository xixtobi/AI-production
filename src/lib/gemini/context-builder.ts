import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { resolveProjectPath, ensureRealPathInside, resolveProjectRoot } from "@/lib/filesystem/path-service";

export type ShotContextData = {
  project: schema.Project;
  content: typeof schema.contentItems.$inferSelect;
  scene?: typeof schema.scenes.$inferSelect;
  shot: typeof schema.shots.$inferSelect;
  previousShot?: typeof schema.shots.$inferSelect;
  nextShot?: typeof schema.shots.$inferSelect;
  linkedAssets: Array<{
    link: typeof schema.shotAssets.$inferSelect;
    asset: typeof schema.assets.$inferSelect;
    version?: typeof schema.assetVersions.$inferSelect;
  }>;
  characterReferences: Array<{
    name: string;
    assetCode: string;
    description: string;
    role: string;
  }>;
  environmentReferences: Array<{
    name: string;
    assetCode: string;
    description: string;
    role: string;
  }>;
  styleBible?: string;
  promptHistory: Array<{
    model: string;
    thinkingLevel: string;
    createdAt: Date;
    status: string;
    result?: string;
  }>;
};

export function buildProjectContext(projectId: string): schema.Project {
  const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");
  return project;
}

export function buildContentContext(projectId: string, contentId: string) {
  const content = db
    .select()
    .from(schema.contentItems)
    .where(and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, projectId)))
    .get();
  if (!content) throw new DomainError("Konten tidak ditemukan pada proyek ini.");
  return content;
}

export function buildSceneContext(projectId: string, sceneId: string) {
  const scene = db
    .select()
    .from(schema.scenes)
    .where(and(eq(schema.scenes.id, sceneId), eq(schema.scenes.projectId, projectId)))
    .get();
  if (!scene) throw new DomainError("Scene tidak ditemukan pada proyek ini.");
  return scene;
}

export function buildShotContext(projectId: string, shotId: string): ShotContextData {
  const project = buildProjectContext(projectId);

  const shot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.id, shotId), eq(schema.shots.projectId, projectId)))
    .get();
  if (!shot) throw new DomainError("Shot tidak ditemukan pada proyek ini.");

  const content = db
    .select()
    .from(schema.contentItems)
    .where(and(eq(schema.contentItems.id, shot.contentItemId), eq(schema.contentItems.projectId, projectId)))
    .get();
  if (!content) throw new DomainError("Konten induk shot tidak ditemukan.");

  let scene: typeof schema.scenes.$inferSelect | undefined;
  if (shot.sceneId) {
    scene = db
      .select()
      .from(schema.scenes)
      .where(and(eq(schema.scenes.id, shot.sceneId), eq(schema.scenes.projectId, projectId)))
      .get();
  }

  const previousShot = db
    .select()
    .from(schema.shots)
    .where(
      and(
        eq(schema.shots.projectId, projectId),
        eq(schema.shots.contentItemId, shot.contentItemId),
        lt(schema.shots.shotNumber, shot.shotNumber)
      )
    )
    .orderBy(desc(schema.shots.shotNumber))
    .limit(1)
    .get();

  const nextShot = db
    .select()
    .from(schema.shots)
    .where(
      and(
        eq(schema.shots.projectId, projectId),
        eq(schema.shots.contentItemId, shot.contentItemId),
        gt(schema.shots.shotNumber, shot.shotNumber)
      )
    )
    .orderBy(schema.shots.shotNumber)
    .limit(1)
    .get();

  const rawShotAssets = db
    .select()
    .from(schema.shotAssets)
    .where(and(eq(schema.shotAssets.shotId, shotId), eq(schema.shotAssets.projectId, projectId)))
    .all();

  const linkedAssets: ShotContextData["linkedAssets"] = [];
  for (const link of rawShotAssets) {
    const asset = db
      .select()
      .from(schema.assets)
      .where(and(eq(schema.assets.id, link.assetId), eq(schema.assets.projectId, projectId)))
      .get();
    if (!asset) continue;

    const version = db
      .select()
      .from(schema.assetVersions)
      .where(
        and(
          eq(schema.assetVersions.assetId, asset.id),
          eq(schema.assetVersions.projectId, projectId),
          eq(schema.assetVersions.isCurrent, true)
        )
      )
      .get();

    linkedAssets.push({ link, asset, version });
  }

  const characterReferences: ShotContextData["characterReferences"] = [];
  const environmentReferences: ShotContextData["environmentReferences"] = [];
  let styleBible: string | undefined;

  for (const item of linkedAssets) {
    if (item.link.role === "CHARACTER_REFERENCE") {
      characterReferences.push({
        name: item.asset.name,
        assetCode: item.asset.assetCode,
        description: item.asset.description || item.link.notes || "",
        role: item.link.role,
      });
    } else if (item.link.role === "ENVIRONMENT_REFERENCE") {
      environmentReferences.push({
        name: item.asset.name,
        assetCode: item.asset.assetCode,
        description: item.asset.description || item.link.notes || "",
        role: item.link.role,
      });
    } else if (item.link.role === "STYLE_REFERENCE") {
      styleBible = `Aset Gaya: ${item.asset.name} (${item.asset.assetCode}). ${item.asset.description}`;
    }
  }

  if (!styleBible) {
    const dbStyleBible = db
      .select()
      .from(schema.styleBibles)
      .where(eq(schema.styleBibles.projectId, projectId))
      .get();

    if (dbStyleBible) {
      styleBible = `Style Bible: ${dbStyleBible.visualStyle}. Tone: ${dbStyleBible.tone}. Camera: ${dbStyleBible.cameraLanguage}. Lighting: ${dbStyleBible.lighting}. Palette: ${dbStyleBible.paletteNotes}. Rules: ${dbStyleBible.continuityRules}`;
    } else {
      const projectStyleAsset = db
        .select()
        .from(schema.assets)
        .where(
          and(
            eq(schema.assets.projectId, projectId),
            eq(schema.assets.assetType, "REFERENCE")
          )
        )
        .all()
        .find((a) => a.assetCode.toUpperCase().includes("STYLE") || a.name.toUpperCase().includes("STYLE") || a.name.toUpperCase().includes("BIBLE"));

      if (projectStyleAsset) {
        styleBible = `Style Guide Proyek: ${projectStyleAsset.name} (${projectStyleAsset.assetCode}) - ${projectStyleAsset.description}`;
      } else if (project.description && project.description.length > 10) {
        styleBible = project.description;
      }
    }
  }

  const recentRequests = db
    .select()
    .from(schema.aiRequests)
    .where(and(eq(schema.aiRequests.shotId, shotId), eq(schema.aiRequests.projectId, projectId)))
    .orderBy(desc(schema.aiRequests.createdAt))
    .limit(5)
    .all();

  const promptHistory: ShotContextData["promptHistory"] = recentRequests.map((req) => ({
    model: req.model,
    thinkingLevel: req.thinkingLevel,
    createdAt: req.createdAt,
    status: req.status,
    result: req.resultJson || undefined,
  }));

  return {
    project,
    content,
    scene,
    shot,
    previousShot,
    nextShot,
    linkedAssets,
    characterReferences,
    environmentReferences,
    styleBible,
    promptHistory,
  };
}

export function buildShotContextPrompt(data: ShotContextData, taskName: string): string {
  const parts: string[] = [];

  parts.push(`# KONTEKS PRODUKSI UNTUK TUGAS: ${taskName}`);
  parts.push("");
  parts.push(`## 1. PROYEK`);
  parts.push(`- Kode Proyek: ${data.project.code}`);
  parts.push(`- Nama Proyek: ${data.project.name}`);
  parts.push(`- Tipe Proyek: ${data.project.projectType}`);
  parts.push(`- Aspek Rasio: ${data.project.defaultAspectRatio}`);
  parts.push(`- Bahasa: ${data.project.defaultLanguage}`);
  if (data.project.description) {
    parts.push(`- Deskripsi Proyek: ${data.project.description}`);
  }

  parts.push("");
  parts.push(`## 2. STYLE BIBLE & PANDUAN VISUAL`);
  parts.push(data.styleBible ? data.styleBible : "Tidak ada dokumen Style Bible spesifik yang terpasang.");

  parts.push("");
  parts.push(`## 3. KONTEN (EPISODE / ITEM)`);
  parts.push(`- Kode Konten: ${data.content.code}`);
  parts.push(`- Judul: ${data.content.title}`);
  parts.push(`- Jenis: ${data.content.contentType}`);
  if (data.content.description) {
    parts.push(`- Deskripsi: ${data.content.description}`);
  }

  parts.push("");
  parts.push(`## 4. SCENE (ADEGAN)`);
  if (data.scene) {
    parts.push(`- Kode Scene: ${data.scene.code}`);
    parts.push(`- Judul: ${data.scene.title}`);
    parts.push(`- Lokasi: ${data.scene.location || "Lokasi belum ditentukan"}`);
    if (data.scene.description) parts.push(`- Deskripsi: ${data.scene.description}`);
  } else {
    parts.push("Shot ini belum ditautkan ke Scene tertentu.");
  }

  parts.push("");
  parts.push(`## 5. SHOT SAAT INI (TARGET)`);
  parts.push(`- Kode Shot: ${data.shot.shotCode} (Nomor: ${data.shot.shotNumber})`);
  parts.push(`- Judul: ${data.shot.title}`);
  parts.push(`- Status: ${data.shot.status}`);
  parts.push(`- Prioritas: ${data.shot.priority}`);
  parts.push(`- Tipe Kamera: ${data.shot.cameraType || "Belum diisi"}`);
  parts.push(`- Durasi Target: ${data.shot.durationTarget != null ? `${data.shot.durationTarget} detik` : "Belum diisi"}`);
  parts.push(`- Aksi / Visual: ${data.shot.action || "Belum diisi"}`);
  parts.push(`- Dialog: ${data.shot.dialogue || "Belum diisi"}`);
  parts.push(`- Catatan Produksi: ${data.shot.notes || "Belum diisi"}`);

  parts.push("");
  parts.push(`## 6. SHOT SEBELUMNYA (KONTINUITAS SEBELUM)`);
  if (data.previousShot) {
    parts.push(`- Kode: ${data.previousShot.shotCode} (${data.previousShot.title})`);
    parts.push(`- Aksi: ${data.previousShot.action || "-"}`);
    parts.push(`- Kamera: ${data.previousShot.cameraType || "-"}`);
    parts.push(`- Dialog: ${data.previousShot.dialogue || "-"}`);
  } else {
    parts.push("Tidak ada shot sebelumnya (merupakan shot pembuka).");
  }

  parts.push("");
  parts.push(`## 7. SHOT BERIKUTNYA (KONTINUITAS SESUDAH)`);
  if (data.nextShot) {
    parts.push(`- Kode: ${data.nextShot.shotCode} (${data.nextShot.title})`);
    parts.push(`- Aksi: ${data.nextShot.action || "-"}`);
    parts.push(`- Kamera: ${data.nextShot.cameraType || "-"}`);
    parts.push(`- Dialog: ${data.nextShot.dialogue || "-"}`);
  } else {
    parts.push("Tidak ada shot berikutnya (merupakan shot penutup).");
  }

  parts.push("");
  parts.push(`## 8. REFERENSI KARAKTER & ELEMEN LINGKUNGAN`);
  if (data.characterReferences.length > 0) {
    parts.push(`### Karakter:`);
    for (const c of data.characterReferences) {
      parts.push(`- [${c.assetCode}] ${c.name}: ${c.description}`);
    }
  } else {
    parts.push("- Tidak ada referensi karakter khusus yang ditautkan ke shot ini.");
  }

  if (data.environmentReferences.length > 0) {
    parts.push(`### Lingkungan / Background:`);
    for (const env of data.environmentReferences) {
      parts.push(`- [${env.assetCode}] ${env.name}: ${env.description}`);
    }
  } else {
    parts.push("- Tidak ada referensi lingkungan khusus yang ditautkan ke shot ini.");
  }

  if (data.linkedAssets.length > 0) {
    parts.push("");
    parts.push(`## 9. SEMUA ASET YANG DITAUTKAN`);
    for (const { link, asset, version } of data.linkedAssets) {
      const vText = version ? `v${version.versionNumber} (${version.filename})` : "tanpa versi file";
      parts.push(`- [${asset.assetCode}] ${asset.name} (Peran: ${link.role}, Tipe: ${asset.assetType}, ${vText})`);
    }
  }

  if (data.promptHistory.length > 0) {
    parts.push("");
    parts.push(`## 10. RIWAYAT GENERASI PROMPT SEBELUMNYA`);
    for (const hist of data.promptHistory) {
      parts.push(`- Tanggal: ${hist.createdAt.toISOString().slice(0, 19)} | Model: ${hist.model} | Level: ${hist.thinkingLevel} | Status: ${hist.status}`);
      if (hist.result) {
        parts.push(`  Pratinjau Hasil: ${hist.result.slice(0, 150)}...`);
      }
    }
  }

  return parts.join("\n");
}

export async function prepareContextPack(
  projectId: string,
  shotId: string,
  taskCode = "PROMPT_GENERATION"
): Promise<{ outputDir: string; files: string[] }> {
  const context = buildShotContext(projectId, shotId);
  const root = resolveProjectRoot(context.project.rootPath);
  const contextPackDir = resolveProjectPath(root, "AI_CONTEXT_PACK");

  await mkdir(contextPackDir, { recursive: true });
  await ensureRealPathInside(root, contextPackDir, true);

  const referencesDir = path.join(contextPackDir, "references");
  await mkdir(referencesDir, { recursive: true });

  const manifest = {
    packVersion: "1.0",
    createdAt: new Date().toISOString(),
    projectId: context.project.id,
    projectCode: context.project.code,
    projectName: context.project.name,
    shotId: context.shot.id,
    shotCode: context.shot.shotCode,
    taskCode,
    files: [
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
      "references/README.md",
    ],
  };

  const projectMd = `# PROYEK: ${context.project.name} (${context.project.code})
- Tipe: ${context.project.projectType}
- Rasio: ${context.project.defaultAspectRatio}
- Bahasa: ${context.project.defaultLanguage}
- Deskripsi: ${context.project.description || "-"}
`;

  const styleBibleMd = `# STYLE BIBLE
${context.styleBible || "Tidak ada panduan gaya visual khusus yang terdaftar."}
`;

  const charactersMd = `# KARAKTER TERKAIT
${
  context.characterReferences.length > 0
    ? context.characterReferences.map((c) => `- **${c.assetCode}** (${c.name}): ${c.description}`).join("\n")
    : "Tidak ada referensi karakter khusus untuk shot ini."
}
`;

  const environmentsMd = `# LINGKUNGAN / LATAR TERKAIT
${
  context.environmentReferences.length > 0
    ? context.environmentReferences.map((e) => `- **${e.assetCode}** (${e.name}): ${e.description}`).join("\n")
    : "Tidak ada referensi lingkungan khusus untuk shot ini."
}
`;

  const contentMd = `# KONTEN / EPISODE: ${context.content.code} - ${context.content.title}
- Tipe: ${context.content.contentType}
- Target Durasi: ${context.content.durationTarget != null ? `${context.content.durationTarget}s` : "-"}
- Deskripsi: ${context.content.description || "-"}
`;

  const sceneMd = `# SCENE / ADEGAN
${
  context.scene
    ? `- Kode: ${context.scene.code}\n- Judul: ${context.scene.title}\n- Lokasi: ${context.scene.location || "-"}\n- Deskripsi: ${context.scene.description || "-"}`
    : "Shot ini belum ditautkan ke scene spesifik."
}
`;

  const shotMd = `# CURRENT SHOT: ${context.shot.shotCode} - ${context.shot.title}
- Nomor: ${context.shot.shotNumber}
- Status: ${context.shot.status}
- Prioritas: ${context.shot.priority}
- Tipe Kamera: ${context.shot.cameraType || "-"}
- Durasi: ${context.shot.durationTarget != null ? `${context.shot.durationTarget} detik` : "-"}
- Aksi / Visual: ${context.shot.action || "-"}
- Dialog: ${context.shot.dialogue || "-"}
- Catatan: ${context.shot.notes || "-"}
`;

  const previousShotMd = `# PREVIOUS SHOT
${
  context.previousShot
    ? `- Kode: ${context.previousShot.shotCode} (${context.previousShot.title})\n- Kamera: ${context.previousShot.cameraType || "-"}\n- Aksi: ${context.previousShot.action || "-"}\n- Dialog: ${context.previousShot.dialogue || "-"}`
    : "Tidak ada shot sebelumnya (shot pertama)."
}
`;

  const nextShotMd = `# NEXT SHOT
${
  context.nextShot
    ? `- Kode: ${context.nextShot.shotCode} (${context.nextShot.title})\n- Kamera: ${context.nextShot.cameraType || "-"}\n- Aksi: ${context.nextShot.action || "-"}\n- Dialog: ${context.nextShot.dialogue || "-"}`
    : "Tidak ada shot berikutnya (shot terakhir)."
}
`;

  const promptHistoryMd = `# RIWAYAT PROMPT
${
  context.promptHistory.length > 0
    ? context.promptHistory
        .map(
          (h) =>
            `### ${h.createdAt.toISOString().slice(0, 19)} (${h.model}, level: ${h.thinkingLevel}, status: ${h.status})\n\`\`\`json\n${h.result || "{}"}\n\`\`\``
        )
        .join("\n\n")
    : "Belum ada riwayat prompt untuk shot ini."
}
`;

  const taskMd = `# TUGAS PRODUKSI: ${taskCode}
Konteks paket ini disiapkan untuk pengerjaan tugas ${taskCode} pada shot ${context.shot.shotCode}.
Silakan gunakan file-file dalam paket ini sebagai referensi kontekstual di antarmuka ChatGPT atau tool AI eksternal Anda.
`;

  const referencesReadmeMd = `# DAFTAR FILE REFERENSI
${
  context.linkedAssets.length > 0
    ? context.linkedAssets
        .map(
          (la) =>
            `- [${la.link.role}] ${la.asset.assetCode} - ${la.asset.name} (File: ${la.version?.relativePath || "Belum ada file"})`
        )
        .join("\n")
    : "Tidak ada file referensi fisik yang ditautkan."
}
`;

  await writeFile(path.join(contextPackDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(path.join(contextPackDir, "project.md"), projectMd, "utf8");
  await writeFile(path.join(contextPackDir, "style-bible.md"), styleBibleMd, "utf8");
  await writeFile(path.join(contextPackDir, "characters.md"), charactersMd, "utf8");
  await writeFile(path.join(contextPackDir, "environments.md"), environmentsMd, "utf8");
  await writeFile(path.join(contextPackDir, "content.md"), contentMd, "utf8");
  await writeFile(path.join(contextPackDir, "scene.md"), sceneMd, "utf8");
  await writeFile(path.join(contextPackDir, "shot.md"), shotMd, "utf8");
  await writeFile(path.join(contextPackDir, "previous-shot.md"), previousShotMd, "utf8");
  await writeFile(path.join(contextPackDir, "next-shot.md"), nextShotMd, "utf8");
  await writeFile(path.join(contextPackDir, "prompt-history.md"), promptHistoryMd, "utf8");
  await writeFile(path.join(contextPackDir, "task.md"), taskMd, "utf8");
  await writeFile(path.join(referencesDir, "README.md"), referencesReadmeMd, "utf8");

  return {
    outputDir: contextPackDir,
    files: manifest.files,
  };
}
