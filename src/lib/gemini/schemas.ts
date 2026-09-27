import { z } from "zod";
import { Type, type Schema } from "@google/genai";

export const ShotBreakdownZodSchema = z.object({
  summary: z.string().describe("Ringkasan breakdown shot"),
  visualDescription: z.string().describe("Deskripsi visual mendalam untuk shot"),
  cameraWork: z.string().describe("Instruksi kamera, sudut, framing, dan pergerakan"),
  lightingAndAtmosphere: z.string().describe("Pencahayaan, palet warna, dan atmosfer"),
  audioAndDialogue: z.string().describe("Audio, efek suara, dan dialog karakter"),
  characters: z.array(z.string()).describe("Daftar karakter yang muncul"),
  propsAndEnvironment: z.array(z.string()).describe("Elemen lingkungan dan prop penting"),
  estimatedDurationSeconds: z.number().nullable().optional().describe("Estimasi durasi dalam detik"),
  productionNotes: z.array(z.string()).describe("Catatan teknis produksi"),
});

export const PromptGenerationZodSchema = z.object({
  positivePrompt: z.string().describe("Prompt visual utama dalam bahasa Inggris terstruktur"),
  negativePrompt: z.string().describe("Negative prompt untuk mencegah cacat visual"),
  artStyle: z.string().describe("Gaya seni visual dan rendering"),
  cameraAndComposition: z.string().describe("Framing, angle, dan komposisi kamera"),
  lighting: z.string().describe("Pencahayaan dan mood warna"),
  motionDescription: z.string().describe("Deskripsi gerakan atau video prompt jika animasi"),
  notes: z.string().describe("Catatan tambahan untuk tim produksi"),
});

export const ContinuityCheckZodSchema = z.object({
  status: z.enum(["PASS", "WARNING", "FAIL"]).describe("Status kepatuhan kontinuitas"),
  summary: z.string().describe("Ringkasan evaluasi kontinuitas"),
  characterContinuity: z.object({
    consistent: z.boolean(),
    issues: z.array(z.string()),
  }),
  environmentContinuity: z.object({
    consistent: z.boolean(),
    issues: z.array(z.string()),
  }),
  lightingContinuity: z.object({
    consistent: z.boolean(),
    issues: z.array(z.string()),
  }),
  actionContinuity: z.object({
    consistent: z.boolean(),
    issues: z.array(z.string()),
  }),
  recommendations: z.array(z.string()).describe("Rekomendasi perbaikan kontinuitas"),
});

export const ProductionReviewZodSchema = z.object({
  readinessStatus: z.enum(["READY", "NEEDS_REVISION", "BLOCKED"]).describe("Status kesiapan produksi"),
  overallScore: z.number().describe("Skor kesiapan 0-100"),
  summary: z.string().describe("Ringkasan tinjauan produksi"),
  strengths: z.array(z.string()).describe("Elemen yang sudah matang dan siap"),
  missingElements: z.array(z.string()).describe("Elemen yang belum lengkap atau hilang"),
  technicalFeasibility: z.string().describe("Analisis kelayakan teknis"),
  actionItems: z.array(z.string()).describe("Daftar tindakan konkret sebelum produksi"),
});

export const ScriptGenerationZodSchema = z.object({
  title: z.string().describe("Judul naskah"),
  logline: z.string().describe("Logline cerita"),
  synopsis: z.string().describe("Sinopsis ringkas"),
  scriptText: z.string().describe("Draf naskah lengkap"),
  characterList: z.array(z.string()).describe("Daftar karakter"),
  productionNotes: z.array(z.string()).describe("Catatan produksi"),
});

export const ScriptRewriteZodSchema = z.object({
  summaryOfChanges: z.string().describe("Ringkasan perubahan"),
  revisedScriptText: z.string().describe("Naskah hasil revisi"),
  notes: z.string().describe("Catatan teknis revisi"),
});

export const DialoguePolishZodSchema = z.object({
  originalDialogue: z.string().describe("Dialog asli"),
  polishedDialogue: z.string().describe("Dialog setelah disempurnakan"),
  deliveryNotes: z.string().describe("Petunjuk intonasi dan akting suara"),
  alternatives: z.array(z.string()).describe("Alternatif kalimat dialog"),
});

export const SceneBreakdownZodSchema = z.object({
  sceneCode: z.string().describe("Kode scene"),
  location: z.string().describe("Lokasi adegan"),
  timeOfDay: z.string().describe("Waktu"),
  summary: z.string().describe("Ringkasan scene"),
  shotBreakdownList: z.array(z.string()).describe("Daftar rencana shot"),
  assetsNeeded: z.array(z.string()).describe("Aset yang dibutuhkan"),
  notes: z.string().describe("Catatan teknis"),
});

export type ShotBreakdownOutput = z.infer<typeof ShotBreakdownZodSchema>;
export type PromptGenerationOutput = z.infer<typeof PromptGenerationZodSchema>;
export type ContinuityCheckOutput = z.infer<typeof ContinuityCheckZodSchema>;
export type ProductionReviewOutput = z.infer<typeof ProductionReviewZodSchema>;

export const GeminiJsonSchemas: Record<string, Schema> = {
  SHOT_BREAKDOWN: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      visualDescription: { type: Type.STRING },
      cameraWork: { type: Type.STRING },
      lightingAndAtmosphere: { type: Type.STRING },
      audioAndDialogue: { type: Type.STRING },
      characters: { type: Type.ARRAY, items: { type: Type.STRING } },
      propsAndEnvironment: { type: Type.ARRAY, items: { type: Type.STRING } },
      estimatedDurationSeconds: { type: Type.NUMBER },
      productionNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["summary", "visualDescription", "cameraWork", "lightingAndAtmosphere", "audioAndDialogue", "characters", "propsAndEnvironment", "productionNotes"],
  },
  PROMPT_GENERATION: {
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
    required: ["positivePrompt", "negativePrompt", "artStyle", "cameraAndComposition", "lighting", "motionDescription", "notes"],
  },
  CONTINUITY_CHECK: {
    type: Type.OBJECT,
    properties: {
      status: { type: Type.STRING, enum: ["PASS", "WARNING", "FAIL"] },
      summary: { type: Type.STRING },
      characterContinuity: {
        type: Type.OBJECT,
        properties: {
          consistent: { type: Type.BOOLEAN },
          issues: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["consistent", "issues"],
      },
      environmentContinuity: {
        type: Type.OBJECT,
        properties: {
          consistent: { type: Type.BOOLEAN },
          issues: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["consistent", "issues"],
      },
      lightingContinuity: {
        type: Type.OBJECT,
        properties: {
          consistent: { type: Type.BOOLEAN },
          issues: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["consistent", "issues"],
      },
      actionContinuity: {
        type: Type.OBJECT,
        properties: {
          consistent: { type: Type.BOOLEAN },
          issues: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["consistent", "issues"],
      },
      recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["status", "summary", "characterContinuity", "environmentContinuity", "lightingContinuity", "actionContinuity", "recommendations"],
  },
  PRODUCTION_REVIEW: {
    type: Type.OBJECT,
    properties: {
      readinessStatus: { type: Type.STRING, enum: ["READY", "NEEDS_REVISION", "BLOCKED"] },
      overallScore: { type: Type.NUMBER },
      summary: { type: Type.STRING },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      missingElements: { type: Type.ARRAY, items: { type: Type.STRING } },
      technicalFeasibility: { type: Type.STRING },
      actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["readinessStatus", "overallScore", "summary", "strengths", "missingElements", "technicalFeasibility", "actionItems"],
  },
  SCRIPT_GENERATION: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      logline: { type: Type.STRING },
      synopsis: { type: Type.STRING },
      scriptText: { type: Type.STRING },
      characterList: { type: Type.ARRAY, items: { type: Type.STRING } },
      productionNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["title", "logline", "synopsis", "scriptText", "characterList", "productionNotes"],
  },
  SCRIPT_REWRITE: {
    type: Type.OBJECT,
    properties: {
      summaryOfChanges: { type: Type.STRING },
      revisedScriptText: { type: Type.STRING },
      notes: { type: Type.STRING },
    },
    required: ["summaryOfChanges", "revisedScriptText", "notes"],
  },
  DIALOGUE_POLISH: {
    type: Type.OBJECT,
    properties: {
      originalDialogue: { type: Type.STRING },
      polishedDialogue: { type: Type.STRING },
      deliveryNotes: { type: Type.STRING },
      alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["originalDialogue", "polishedDialogue", "deliveryNotes", "alternatives"],
  },
  SCENE_BREAKDOWN: {
    type: Type.OBJECT,
    properties: {
      sceneCode: { type: Type.STRING },
      location: { type: Type.STRING },
      timeOfDay: { type: Type.STRING },
      summary: { type: Type.STRING },
      shotBreakdownList: { type: Type.ARRAY, items: { type: Type.STRING } },
      assetsNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
      notes: { type: Type.STRING },
    },
    required: ["sceneCode", "location", "timeOfDay", "summary", "shotBreakdownList", "assetsNeeded", "notes"],
  },
};

export const TaskZodSchemas: Record<string, z.ZodTypeAny> = {
  SHOT_BREAKDOWN: ShotBreakdownZodSchema,
  PROMPT_GENERATION: PromptGenerationZodSchema,
  CONTINUITY_CHECK: ContinuityCheckZodSchema,
  PRODUCTION_REVIEW: ProductionReviewZodSchema,
  SCRIPT_GENERATION: ScriptGenerationZodSchema,
  SCRIPT_REWRITE: ScriptRewriteZodSchema,
  DIALOGUE_POLISH: DialoguePolishZodSchema,
  SCENE_BREAKDOWN: SceneBreakdownZodSchema,
};

export function validateStructuredOutput(taskCode: string, jsonString: string): { success: true; data: unknown } | { success: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return {
      success: false,
      error: "Respons Gemini bukan JSON yang valid. Format respons tidak dapat diproses.",
    };
  }

  const schema = TaskZodSchemas[taskCode];
  if (!schema) {
    return { success: true, data: parsed };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.issues.map((e) => `${e.path.join(".") || "root"}: ${e.message}`).join(", ");
    return {
      success: false,
      error: `Respons Gemini tidak sesuai dengan skema yang diharapkan (${errorDetails}).`,
    };
  }

  return { success: true, data: result.data };
}
