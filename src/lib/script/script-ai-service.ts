import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendGeminiRequest, normalizeGeminiError } from "@/lib/gemini/client";
import { GEMINI_PRIMARY_MODEL, type GeminiThinkingLevel } from "@/lib/gemini/config";
import { estimateUsageCost } from "@/lib/gemini/usage-service";
import { listCharacters, listEnvironments, getStoryBible, getStyleBible } from "./bible-service";
import { getVersionDetail } from "./script-service";
import type { AiAssistParams, AiAssistResult, ScriptAiAction, ScriptBlockInput, ScriptBlockType } from "./types";

export const ACTION_THINKING_LEVELS: Record<ScriptAiAction, GeminiThinkingLevel> = {
  CONTINUE: "MEDIUM",
  REWRITE: "HIGH",
  SHORTEN: "LOW",
  EXPAND: "MEDIUM",
  DIALOGUE_POLISH: "MEDIUM",
  IMPROVE_PACING: "MEDIUM",
  ADD_ACTION: "MEDIUM",
  CHILD_FRIENDLY_REWRITE: "HIGH",
  CONTINUITY_CHECK: "HIGH",
};

const ACTION_DESCRIPTIONS: Record<ScriptAiAction, string> = {
  CONTINUE: "Melanjutkan skrip adegan atau dialog secara koheren",
  REWRITE: "Menulis ulang draf teks agar lebih tajam, sinematik, dan menarik",
  SHORTEN: "Meringkas teks agar lebih padat tanpa menghilangkan poin cerita utama",
  EXPAND: "Mengembangkan deskripsi aksi atau ketegangan visual lebih detail",
  DIALOGUE_POLISH: "Menyempurnakan karakter suara dan emosi dialog anak secara alami",
  IMPROVE_PACING: "Memperbaiki tempo dan ritme transisi antar aksi dan dialog",
  ADD_ACTION: "Menambahkan beat aksi visual pendukung di sekitar dialog",
  CHILD_FRIENDLY_REWRITE: "Menyesuaikan teks agar sepenuhnya aman, hangat, dan ramah anak/keluarga",
  CONTINUITY_CHECK: "Memeriksa kepatuhan kanon karakter, latar tempat, dan aturan cerita",
};

export async function executeScriptAiAssist(params: AiAssistParams): Promise<AiAssistResult> {
  const thinkingLevel = ACTION_THINKING_LEVELS[params.action] || "MEDIUM";
  const now = new Date();
  const requestId = crypto.randomUUID();

  // Find or create AI Task record for tracking
  let aiTask = db
    .select()
    .from(schema.aiTasks)
    .where(eq(schema.aiTasks.code, "SCRIPT_REWRITE"))
    .get();

  if (!aiTask) {
    aiTask = db.select().from(schema.aiTasks).all()[0];
  }

  // 1. Gather context
  const characters = listCharacters(params.projectId);
  const environments = listEnvironments(params.projectId);
  const storyBible = getStoryBible(params.projectId);
  const styleBible = getStyleBible(params.projectId);
  const versionDetail = getVersionDetail(params.scriptVersionId);

  // Context strings
  const charContext = characters
    .map(
      (c) =>
        `- ${c.name} (${c.role}, ${c.age}): ${c.personality}. Pakaian: ${c.costume}. Aturan: ${c.rules}`
    )
    .join("\n");

  const envContext = environments
    .map((e) => `- ${e.name}: ${e.description}. Visual: ${e.visualCharacteristics}. Suasana: ${e.tone}`)
    .join("\n");

  let sceneHeading = "";
  let surroundingText = "";
  if (versionDetail && params.scriptSceneId) {
    const scene = versionDetail.scenes.find((s) => s.id === params.scriptSceneId);
    if (scene) {
      sceneHeading = `${scene.heading} (${scene.location} - ${scene.timeOfDay})`;
      surroundingText = scene.blocks
        .slice(-5)
        .map((b) => `${b.blockType} ${b.character ? "[" + b.character + "]: " : ": "}${b.content}`)
        .join("\n");
    }
  }

  // Build isolated prompt
  const systemInstruction = `Anda adalah Asisten Penulis Skrip Profesional untuk produksi animasi dan video ramah anak (Lembah Awan).
Tugas Anda adalah memberikan usulan/revisi skrip terbaik sesuai instruksi.
PANDUAN KETAT:
1. JANGAN PERNAH menyertakan kekerasan ekstrem, bahasa kasar, atau elemen horor menakutkan.
2. Pertahankan kepribadian kanon karakter (Raka: pemberani & penasaran; Lila: analitis & teliti; Bimo: pelindung setia kawan & suka camilan; Mimo: dengkur/gerak lucu & lonceng).
3. Gunakan Bahasa Indonesia yang natural, hangat, dan hidup untuk audiens anak/keluarga.
4. Format respon Anda WAJIB berupa JSON valid dengan skema:
{
  "suggestion": "teks hasil revisi atau usulan skrip",
  "reasoning": "penjelasan singkat alasan perubahan dalam 1-3 kalimat",
  "suggestedBlocks": [
    {
      "blockType": "ACTION" | "DIALOGUE" | "CHARACTER" | "PARENTHETICAL" | "SFX" | "MUSIC" | "TRANSITION" | "NOTE",
      "character": "Nama Karakter (jika DIALOGUE atau null)",
      "content": "isi teks blok"
    }
  ]
}`;

  const prompt = `[PROYEK & ATURAN PRODUKSI]
Premis: ${storyBible?.premise || "Petualangan ramah anak di Lembah Awan"}
Aturan Cerita: ${storyBible?.worldRules || "Kanonik dan hangat"}
Batasan: ${storyBible?.constraints || "Aman untuk anak-anak, tanpa kekerasan atau horor"}
Gaya Visual: ${styleBible?.visualStyle || "Animasi semi-realistis hangat"}

[DAFTAR KARAKTER KANON]
${charContext || "Belum ada karakter terdaftar."}

[DAFTAR LINGKUNGAN KANON]
${envContext || "Belum ada lingkungan terdaftar."}

[KONTEKS ADEGAN SAAT INI]
Adegan: ${sceneHeading || "Adegan Umum"}
${surroundingText ? "Blok sebelumnya:\n" + surroundingText : ""}

[AKSI YANG DIMINTA]
Tindakan: ${params.action} (${ACTION_DESCRIPTIONS[params.action]})
${params.characterName ? `Fokus Karakter: ${params.characterName}` : ""}
${params.environmentName ? `Fokus Lingkungan: ${params.environmentName}` : ""}
${params.instructions ? `Catatan Khusus Pengguna: ${params.instructions}` : ""}

[TEKS ASLI SAAT INI]
"""
${params.targetContent}
"""

Berikan usulan revisi skrip dan alasannya dalam format JSON sesuai spesifikasi.`;

  // Insert initial running request in ai_requests
  db.insert(schema.aiRequests)
    .values({
      id: requestId,
      projectId: params.projectId,
      contentItemId: params.contentItemId,
      taskId: aiTask?.id ?? "",
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      status: "RUNNING",
      scriptVersionId: params.scriptVersionId,
      scriptSceneId: params.scriptSceneId ?? null,
      scriptBlockId: params.scriptBlockId ?? null,
      actionType: params.action,
      metadataJson: JSON.stringify({
        action: params.action,
        characterName: params.characterName,
        environmentName: params.environmentName,
      }),
      startedAt: now,
      createdAt: now,
    })
    .run();

  try {
    const response = await sendGeminiRequest({
      prompt,
      systemInstruction,
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      responseMimeType: "application/json",
    });

    const completedAt = new Date();
    const cost = estimateUsageCost(GEMINI_PRIMARY_MODEL, response.inputTokens, response.outputTokens);

    let parsed: {
      suggestion?: string;
      reasoning?: string;
      suggestedBlocks?: Array<{ blockType: string; character?: string; content: string }>;
    } = {};

    try {
      parsed = JSON.parse(response.text);
    } catch {
      parsed = {
        suggestion: response.text,
        reasoning: "Respon teks langsung dari model.",
      };
    }

    const suggestion = parsed.suggestion || response.text;
    const reasoning = parsed.reasoning || "Dihasilkan secara otomatis oleh Gemini.";

    const suggestedBlocks: ScriptBlockInput[] | undefined = Array.isArray(parsed.suggestedBlocks)
      ? parsed.suggestedBlocks.map((b) => ({
          blockType: (b.blockType || "ACTION") as ScriptBlockType,
          character: b.character || undefined,
          content: b.content || "",
        }))
      : undefined;

    // Update request log as completed
    db.update(schema.aiRequests)
      .set({
        status: "SUCCEEDED",
        resultJson: response.text,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        estimatedCost: cost,
        completedAt,
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();

    return {
      requestId,
      action: params.action,
      originalText: params.targetContent,
      suggestion,
      reasoning,
      suggestedBlocks,
    };
  } catch (err: unknown) {
    const norm = normalizeGeminiError(err);
    const completedAt = new Date();

    db.update(schema.aiRequests)
      .set({
        status: "FAILED",
        errorMessage: norm.message,
        completedAt,
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();

    throw norm;
  }
}
