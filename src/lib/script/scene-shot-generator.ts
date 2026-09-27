import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendGeminiRequest, normalizeGeminiError } from "@/lib/gemini/client";
import { GEMINI_PRIMARY_MODEL } from "@/lib/gemini/config";
import { listCharacters, listEnvironments, getStoryBible } from "./bible-service";
import { exportToScreenplayText, getVersionDetail, addScene, assertVersionNotLocked } from "./script-service";
import type { GeneratedSceneProposal, GeneratedShotProposal } from "./types";

export async function generateScenesFromScript(params: {
  projectId: string;
  contentItemId: string;
  scriptVersionId: string;
  instructions?: string;
}): Promise<GeneratedSceneProposal[]> {
  const versionDetail = getVersionDetail(params.scriptVersionId);
  if (!versionDetail) {
    throw new Error("Versi skrip tidak ditemukan.");
  }

  const screenplayText = exportToScreenplayText(versionDetail);
  const characters = listCharacters(params.projectId).map((c) => c.name);
  const environments = listEnvironments(params.projectId).map((e) => e.name);
  const storyBible = getStoryBible(params.projectId);

  const systemInstruction = `Anda adalah Sutradara & Assistant Director Berpengalaman dalam produksi animasi cerita.
Tugas Anda adalah menganalisis naskah/skrip dan memecahnya ke dalam struktur adegan (Scene Structure Breakdown).
Pastikan setiap adegan memiliki kesatuan ruang (lokasi) dan waktu (time of day).
Keluaran WAJIB berupa JSON dengan skema:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "sceneCode": "SC001",
      "heading": "EXT. LOKASI - WAKTU",
      "location": "Nama Lokasi",
      "timeOfDay": "PAGI / SIANG / SORE / MALAM",
      "description": "Ringkasan peristiwa dan beat naratif penting",
      "charactersInvolved": ["Karakter 1", "Karakter 2"]
    }
  ]
}`;

  const prompt = `[PROYEK & ATURAN]
Premis: ${storyBible?.premise || "Petualangan anak Lembah Awan"}
Daftar Karakter: ${characters.join(", ") || "Raka, Lila, Bimo, Mimo"}
Daftar Lokasi Tersedia: ${environments.join(", ") || "Desa, Rumah Pak Arga, Hutan Bisikan, Gunung Awan, Sungai"}

${params.instructions ? `[PETUNJUK TAMBAHAN PENGGUNA]\n${params.instructions}\n` : ""}

[SKRIP NASKAH]
"""
${screenplayText || "Belum ada teks skrip. Buat proposal struktur 3-5 adegan pembuka."}
"""

Hasilkan daftar struktur adegan yang runtut dan sinematik.`;

  try {
    const response = await sendGeminiRequest({
      prompt,
      systemInstruction,
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel: "HIGH",
      responseMimeType: "application/json",
    });

    const parsed = JSON.parse(response.text);
    if (Array.isArray(parsed.scenes)) {
      return parsed.scenes.map((s: Record<string, unknown>, idx: number) => ({
        sceneNumber: Number(s.sceneNumber) || idx + 1,
        sceneCode: String(s.sceneCode || `SC${String(idx + 1).padStart(3, "0")}`),
        heading: String(s.heading || "SCENE HEADING"),
        location: String(s.location || ""),
        timeOfDay: String(s.timeOfDay || ""),
        description: String(s.description || ""),
        charactersInvolved: Array.isArray(s.charactersInvolved) ? (s.charactersInvolved as string[]) : [],
      }));
    }
    return [];
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}

export function applyGeneratedScenes(params: {
  scriptVersionId: string;
  scenes: GeneratedSceneProposal[];
}): void {
  assertVersionNotLocked(params.scriptVersionId);

  for (const p of params.scenes) {
    addScene(params.scriptVersionId, {
      sceneNumber: p.sceneNumber,
      sceneCode: p.sceneCode,
      heading: p.heading,
      location: p.location,
      timeOfDay: p.timeOfDay,
      description: p.description,
      blocks: [
        {
          blockType: "ACTION",
          content: p.description || "Aksi pembuka adegan.",
        },
      ],
    });
  }
}

export async function generateShotsFromScene(params: {
  projectId: string;
  contentItemId: string;
  scriptSceneId: string;
  startingShotNumber?: number;
  instructions?: string;
}): Promise<GeneratedShotProposal[]> {
  const scene = db.select().from(schema.scriptScenes).where(eq(schema.scriptScenes.id, params.scriptSceneId)).get();
  if (!scene) {
    throw new Error("Adegan skrip tidak ditemukan.");
  }

  const blocks = db
    .select()
    .from(schema.scriptBlocks)
    .where(eq(schema.scriptBlocks.scriptSceneId, params.scriptSceneId))
    .orderBy(schema.scriptBlocks.sortOrder)
    .all();

  const scriptContent = blocks
    .map((b) => `${b.blockType} ${b.character ? `[${b.character}]: ` : ": "}${b.content}`)
    .join("\n");

  const systemInstruction = `Anda adalah Sutradara Animasi & Storyboard Artist Profesional.
Tugas Anda adalah memecah naskah satu adegan menjadi shot-by-shot visual breakdown yang sinematik dan siap produksi.
Perhatikan variasi camera shot (WIDE, MEDIUM, CLOSE UP, OVER THE SHOULDER, POV).
Keluaran WAJIB berupa JSON dengan skema:
{
  "shots": [
    {
      "shotNumber": 1,
      "shotCode": "SH001",
      "title": "Judul deskriptif singkat shot",
      "cameraType": "WIDE SHOT / MEDIUM SHOT / CLOSE UP / TRACKING",
      "action": "Deskripsi visual aksi fisik karakter dan kamera",
      "dialogue": "Dialog yang diucapkan pada shot ini (atau kosong jika hening/aksi)",
      "durationTarget": 3,
      "notes": "Catatan lighting, emosi, atau kontinuitas"
    }
  ]
}`;

  const startingNumber = params.startingShotNumber || 1;
  const prompt = `[ADEGAN]
Nomor & Kode: ${scene.sceneNumber} (${scene.sceneCode})
Heading: ${scene.heading}
Lokasi & Waktu: ${scene.location} - ${scene.timeOfDay}
Deskripsi: ${scene.description}

[ISI NASKAH ADEGAN]
"""
${scriptContent || "Deskripsi aksi pembuka adegan."}
"""

${params.instructions ? `[CATATAN TAMBAHAN]: ${params.instructions}\n` : ""}

Mulai penomoran shot dari nomor ${startingNumber}. Hasilkan breakdown shot secara detail.`;

  try {
    const response = await sendGeminiRequest({
      prompt,
      systemInstruction,
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel: "HIGH",
      responseMimeType: "application/json",
    });

    const parsed = JSON.parse(response.text);
    if (Array.isArray(parsed.shots)) {
      return parsed.shots.map((s: Record<string, unknown>, idx: number) => {
        const num = Number(s.shotNumber) || startingNumber + idx;
        return {
          shotNumber: num,
          shotCode: String(s.shotCode || `SH${String(num).padStart(3, "0")}`),
          title: String(s.title || `Shot ${num}`),
          cameraType: String(s.cameraType || "MEDIUM SHOT"),
          action: String(s.action || ""),
          dialogue: String(s.dialogue || ""),
          durationTarget: Number(s.durationTarget) || 3,
          notes: String(s.notes || ""),
        };
      });
    }
    return [];
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}

export function applyGeneratedShots(params: {
  projectId: string;
  contentItemId: string;
  sceneId?: string;
  shots: GeneratedShotProposal[];
}): void {
  const now = new Date();

  db.transaction((tx) => {
    for (const proposal of params.shots) {
      // Check if shotCode already exists
      const existing = tx
        .select()
        .from(schema.shots)
        .where(
          and(
            eq(schema.shots.contentItemId, params.contentItemId),
            eq(schema.shots.shotCode, proposal.shotCode)
          )
        )
        .get();

      if (existing) {
        // Update details without wiping manual status
        tx.update(schema.shots)
          .set({
            title: proposal.title,
            cameraType: proposal.cameraType,
            action: proposal.action,
            dialogue: proposal.dialogue,
            durationTarget: proposal.durationTarget ?? existing.durationTarget,
            notes: proposal.notes || existing.notes,
            updatedAt: now,
          })
          .where(eq(schema.shots.id, existing.id))
          .run();
      } else {
        // Insert new shot
        tx.insert(schema.shots)
          .values({
            id: crypto.randomUUID(),
            projectId: params.projectId,
            contentItemId: params.contentItemId,
            sceneId: params.sceneId ?? null,
            shotCode: proposal.shotCode,
            shotNumber: proposal.shotNumber,
            title: proposal.title,
            cameraType: proposal.cameraType,
            action: proposal.action,
            dialogue: proposal.dialogue,
            durationTarget: proposal.durationTarget ?? 3,
            notes: proposal.notes || "",
            status: "NOT_STARTED",
            priority: "NORMAL",
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }
  });
}
