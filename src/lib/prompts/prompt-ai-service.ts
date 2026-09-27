import "server-only";

import { z } from "zod";
import { Type } from "@google/genai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { sendGeminiRequest } from "@/lib/gemini/client";
import { GEMINI_PRIMARY_MODEL, type GeminiThinkingLevel } from "@/lib/gemini/config";
import { buildShotContext, buildShotContextPrompt } from "@/lib/gemini/context-builder";
import { resolveTask, resolveThinkingLevel } from "@/lib/gemini/task-service";
import { estimateUsageCost } from "@/lib/gemini/usage-service";
import type { PromptGenerationOutput } from "@/lib/gemini/schemas";

export const PromptImprovementZodSchema = z.object({
  improvedPrompt: z.string().describe("Prompt visual yang telah disempurnakan dalam bahasa Inggris deskriptif"),
  improvedNegativePrompt: z.string().describe("Negative prompt yang disesuaikan untuk target engine"),
  summaryOfChanges: z.string().describe("Ringkasan perbaikan teknis yang dilakukan"),
  targetEngineAdvice: z.string().describe("Saran parameter spesifik untuk target engine"),
});
export type PromptImprovementOutput = z.infer<typeof PromptImprovementZodSchema>;

export const PromptTranslationZodSchema = z.object({
  englishPrompt: z.string().describe("Prompt bahasa Inggris produksi berkualitas tinggi"),
  negativePrompt: z.string().describe("Negative prompt pelengkap"),
  notes: z.string().describe("Catatan penerjemahan dan penyesuaian visual"),
});
export type PromptTranslationOutput = z.infer<typeof PromptTranslationZodSchema>;

export const NegativePromptZodSchema = z.object({
  negativePrompt: z.string().describe("Negative prompt terstruktur"),
  engineArtifactsAvoided: z.array(z.string()).describe("Daftar cacat visual atau artefak yang dicegah"),
  notes: z.string().describe("Penjelasan aturan larangan visual"),
});
export type NegativePromptOutput = z.infer<typeof NegativePromptZodSchema>;

export async function generatePromptFromContext(params: {
  projectId: string;
  shotId: string;
  thinkingLevel?: GeminiThinkingLevel;
  targetEngine?: string;
  promptType?: string;
  userInstructions?: string;
}): Promise<{
  requestId: string;
  result: PromptGenerationOutput;
  compiledFullPrompt: string;
}> {
  const task = resolveTask("PROMPT_GENERATION");
  const thinkingLevel = resolveThinkingLevel(task, params.thinkingLevel);
  const shotContext = buildShotContext(params.projectId, params.shotId);
  const basePrompt = buildShotContextPrompt(shotContext, "Pembuatan Prompt Produksi");

  const startFrameAsset = shotContext.linkedAssets.find(
    (a) => a.link.role === "START_FRAME"
  );

  const extraContext: string[] = [
    basePrompt,
    "",
    "## 11. INSTRUKSI TAMBAHAN PENGGUNA",
    `- Target Engine: ${params.targetEngine || "VEO"}`,
    `- Tipe Prompt: ${params.promptType || "VIDEO"}`,
  ];

  if (startFrameAsset) {
    extraContext.push(
      `- Keyframe Acuan Awal (Start Frame): Gunakan aset '${startFrameAsset.asset.assetCode}' (${startFrameAsset.asset.name}) sebagai titik awal pergerakan (I2V / motion continuation). Jelaskan transisi visual dimulai dari komposisi start frame ini.`
    );
  }

  if (params.userInstructions) {
    extraContext.push(`- Permintaan Khusus: ${params.userInstructions}`);
  }

  const prompt = extraContext.join("\n");
  const requestId = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.aiRequests)
    .values({
      id: requestId,
      projectId: params.projectId,
      contentItemId: shotContext.shot.contentItemId,
      sceneId: shotContext.shot.sceneId,
      shotId: params.shotId,
      taskId: task.id,
      actionType: "GENERATE",
      metadataJson: JSON.stringify({
        targetEngine: params.targetEngine || "VEO",
        promptType: params.promptType || "VIDEO",
        startFrame: startFrameAsset?.asset.assetCode || null,
      }),
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      status: "RUNNING",
      startedAt: now,
      createdAt: now,
    })
    .run();

  const systemInstruction = `Anda adalah Prompt Engineer produksi video dan animasi profesional bertaraf dunia.
Tugas Anda adalah membuat prompt gambar/video berkualitas tinggi untuk shot ini berdasarkan Style Bible, karakter, lingkungan, aksi skrip, dan referensi start frame yang disediakan.
Gunakan Bahasa Inggris deskriptif, kaya detail sinematik, dan bebas glitch untuk nilai 'positivePrompt', 'negativePrompt', 'artStyle', 'cameraAndComposition', 'lighting', dan 'motionDescription'.
Untuk 'notes', gunakan Bahasa Indonesia ringkas.`;

  try {
    const response = await sendGeminiRequest({
      prompt,
      systemInstruction,
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          positivePrompt: { type: Type.STRING },
          negativePrompt: { type: Type.STRING },
          artStyle: { type: Type.STRING },
          cameraAndComposition: { type: Type.STRING },
          lighting: { type: Type.STRING },
          motionDescription: { type: Type.STRING },
          notes: { type: Type.STRING },
        },
        required: [
          "positivePrompt",
          "negativePrompt",
          "artStyle",
          "cameraAndComposition",
          "lighting",
          "motionDescription",
          "notes",
        ],
      },
    });

    const completedAt = new Date();
    const cost = estimateUsageCost(GEMINI_PRIMARY_MODEL, response.inputTokens, response.outputTokens);

    let parsedResult: PromptGenerationOutput;
    try {
      const parsed = JSON.parse(response.text);
      parsedResult = {
        positivePrompt: String(parsed.positivePrompt || ""),
        negativePrompt: String(parsed.negativePrompt || ""),
        artStyle: String(parsed.artStyle || ""),
        cameraAndComposition: String(parsed.cameraAndComposition || ""),
        lighting: String(parsed.lighting || ""),
        motionDescription: String(parsed.motionDescription || ""),
        notes: String(parsed.notes || ""),
      };
    } catch {
      throw new DomainError("Respons Gemini untuk pembuatan prompt bukan format JSON yang valid.");
    }

    // Compile full prompt text
    const promptParts = [
      parsedResult.positivePrompt,
      parsedResult.artStyle ? `Style: ${parsedResult.artStyle}` : "",
      parsedResult.cameraAndComposition ? `Camera: ${parsedResult.cameraAndComposition}` : "",
      parsedResult.lighting ? `Lighting: ${parsedResult.lighting}` : "",
      parsedResult.motionDescription ? `Motion: ${parsedResult.motionDescription}` : "",
    ].filter(Boolean);

    const compiledFullPrompt = promptParts.join(". ").replace(/\.\./g, ".");

    db.update(schema.aiRequests)
      .set({
        status: "SUCCEEDED",
        resultJson: JSON.stringify(parsedResult),
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        estimatedCost: cost,
        completedAt,
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();

    return {
      requestId,
      result: parsedResult,
      compiledFullPrompt,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.update(schema.aiRequests)
      .set({
        status: "FAILED",
        errorMessage: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();
    throw err;
  }
}

export async function improvePrompt(params: {
  projectId: string;
  shotId: string;
  currentPrompt: string;
  currentNegative?: string;
  targetEngine?: string;
  thinkingLevel?: GeminiThinkingLevel;
  instructions?: string;
}): Promise<{
  requestId: string;
  result: PromptImprovementOutput;
}> {
  const task = resolveTask("PROMPT_GENERATION");
  const thinkingLevel = resolveThinkingLevel(task, params.thinkingLevel);
  const shotContext = buildShotContext(params.projectId, params.shotId);

  const promptText = `
# TUGAS: IMPROVE PROMPT PRODUKSI
## KONTEKS SHOT:
- Shot Code: ${shotContext.shot.shotCode}
- Judul: ${shotContext.shot.title}
- Aksi: ${shotContext.shot.action || "-"}
- Dialog: ${shotContext.shot.dialogue || "-"}
- Style Bible: ${shotContext.styleBible || "-"}

## PROMPT SAAT INI:
"${params.currentPrompt}"

## NEGATIVE PROMPT SAAT INI:
"${params.currentNegative || ""}"

## TARGET ENGINE:
${params.targetEngine || "VEO"}

## INSTRUKSI TAMBAHAN:
${params.instructions || "Tingkatkan kedalaman visual, perjelas pergerakan kamera, dan cegah artefak khas AI video."}
`;

  const requestId = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.aiRequests)
    .values({
      id: requestId,
      projectId: params.projectId,
      contentItemId: shotContext.shot.contentItemId,
      sceneId: shotContext.shot.sceneId,
      shotId: params.shotId,
      taskId: task.id,
      actionType: "IMPROVE",
      metadataJson: JSON.stringify({
        targetEngine: params.targetEngine || "VEO",
        originalPrompt: params.currentPrompt,
      }),
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      status: "RUNNING",
      startedAt: now,
      createdAt: now,
    })
    .run();

  const systemInstruction = `Anda adalah Senior AI Video Prompt Engineer.
Tugas Anda menyempurnakan prompt yang ada agar lebih optimal untuk model generative video (khususnya ${params.targetEngine || "VEO"}).
Jaga konsistensi visual dan Style Bible.
Keluarkan output JSON terstruktur sesuai skema.`;

  try {
    const response = await sendGeminiRequest({
      prompt: promptText,
      systemInstruction,
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          improvedPrompt: { type: Type.STRING },
          improvedNegativePrompt: { type: Type.STRING },
          summaryOfChanges: { type: Type.STRING },
          targetEngineAdvice: { type: Type.STRING },
        },
        required: ["improvedPrompt", "improvedNegativePrompt", "summaryOfChanges", "targetEngineAdvice"],
      },
    });

    const cost = estimateUsageCost(GEMINI_PRIMARY_MODEL, response.inputTokens, response.outputTokens);
    const parsed = JSON.parse(response.text) as PromptImprovementOutput;

    db.update(schema.aiRequests)
      .set({
        status: "SUCCEEDED",
        resultJson: JSON.stringify(parsed),
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        estimatedCost: cost,
        completedAt: new Date(),
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();

    return {
      requestId,
      result: parsed,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.update(schema.aiRequests)
      .set({
        status: "FAILED",
        errorMessage: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();
    throw err;
  }
}

export async function translateToEnglishPrompt(params: {
  projectId: string;
  shotId: string;
  indonesianText: string;
  targetEngine?: string;
  thinkingLevel?: GeminiThinkingLevel;
}): Promise<{
  requestId: string;
  result: PromptTranslationOutput;
}> {
  const task = resolveTask("PROMPT_GENERATION");
  const thinkingLevel = resolveThinkingLevel(task, params.thinkingLevel);
  const shotContext = buildShotContext(params.projectId, params.shotId);

  const promptText = `
# TUGAS: TERJEMAHKAN KE BAHASA INGGRIS DESKRIPTIF UNTUK PROMPT AI
Teks Bahasa Indonesia:
"${params.indonesianText}"

Target Engine: ${params.targetEngine || "VEO"}
Style Bible: ${shotContext.styleBible || "Cinematic 3D Animation"}

Terjemahkan ke prompt visual bahasa Inggris berstandar studio profesional, gunakan terminologi sinematografi yang tepat.
`;

  const requestId = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.aiRequests)
    .values({
      id: requestId,
      projectId: params.projectId,
      contentItemId: shotContext.shot.contentItemId,
      sceneId: shotContext.shot.sceneId,
      shotId: params.shotId,
      taskId: task.id,
      actionType: "TRANSLATE",
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      status: "RUNNING",
      startedAt: now,
      createdAt: now,
    })
    .run();

  try {
    const response = await sendGeminiRequest({
      prompt: promptText,
      systemInstruction: "Anda adalah penerjemah naskah dan prompt sinematografi profesional. Keluarkan JSON terstruktur.",
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          englishPrompt: { type: Type.STRING },
          negativePrompt: { type: Type.STRING },
          notes: { type: Type.STRING },
        },
        required: ["englishPrompt", "negativePrompt", "notes"],
      },
    });

    const cost = estimateUsageCost(GEMINI_PRIMARY_MODEL, response.inputTokens, response.outputTokens);
    const parsed = JSON.parse(response.text) as PromptTranslationOutput;

    db.update(schema.aiRequests)
      .set({
        status: "SUCCEEDED",
        resultJson: JSON.stringify(parsed),
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        estimatedCost: cost,
        completedAt: new Date(),
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();

    return {
      requestId,
      result: parsed,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.update(schema.aiRequests)
      .set({
        status: "FAILED",
        errorMessage: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();
    throw err;
  }
}

export async function generateNegativePrompt(params: {
  projectId: string;
  shotId: string;
  targetEngine?: string;
  thinkingLevel?: GeminiThinkingLevel;
}): Promise<{
  requestId: string;
  result: NegativePromptOutput;
}> {
  const task = resolveTask("PROMPT_GENERATION");
  const thinkingLevel = resolveThinkingLevel(task, params.thinkingLevel);
  const shotContext = buildShotContext(params.projectId, params.shotId);

  const promptText = `
# TUGAS: BUAT NEGATIVE PROMPT SPESIFIK
Shot: ${shotContext.shot.shotCode} (${shotContext.shot.title})
Style Bible: ${shotContext.styleBible || "Cinematic 3D Animation"}
Target Engine: ${params.targetEngine || "VEO"}

Buatkan negative prompt yang secara agresif mencegah deformasi fisik karakter, artefak rendering mesin ${params.targetEngine || "VEO"}, flickering, dan pelanggaran aturan Style Bible.
`;

  const requestId = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.aiRequests)
    .values({
      id: requestId,
      projectId: params.projectId,
      contentItemId: shotContext.shot.contentItemId,
      sceneId: shotContext.shot.sceneId,
      shotId: params.shotId,
      taskId: task.id,
      actionType: "NEGATIVE_PROMPT",
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      status: "RUNNING",
      startedAt: now,
      createdAt: now,
    })
    .run();

  try {
    const response = await sendGeminiRequest({
      prompt: promptText,
      systemInstruction: "Anda adalah AI quality assurance specialist. Hasilkan negative prompt komprehensif dalam JSON terstruktur.",
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          negativePrompt: { type: Type.STRING },
          engineArtifactsAvoided: { type: Type.ARRAY, items: { type: Type.STRING } },
          notes: { type: Type.STRING },
        },
        required: ["negativePrompt", "engineArtifactsAvoided", "notes"],
      },
    });

    const cost = estimateUsageCost(GEMINI_PRIMARY_MODEL, response.inputTokens, response.outputTokens);
    const parsed = JSON.parse(response.text) as NegativePromptOutput;

    db.update(schema.aiRequests)
      .set({
        status: "SUCCEEDED",
        resultJson: JSON.stringify(parsed),
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        estimatedCost: cost,
        completedAt: new Date(),
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();

    return {
      requestId,
      result: parsed,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.update(schema.aiRequests)
      .set({
        status: "FAILED",
        errorMessage: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();
    throw err;
  }
}
