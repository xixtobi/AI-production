import "server-only";
import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from "@google/genai";
import { GEMINI_PRIMARY_MODEL, GeminiThinkingLevel, getGeminiApiKey, isGeminiConfigured } from "./config";
export { isGeminiConfigured, getGeminiApiKey };


export type GeminiErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "RATE_LIMIT"
  | "QUOTA_EXHAUSTED"
  | "TIMEOUT"
  | "NETWORK_FAILURE"
  | "INVALID_RESPONSE"
  | "STRUCTURED_OUTPUT_FAILURE"
  | "MODEL_UNAVAILABLE"
  | "UNKNOWN_ERROR";

export class GeminiError extends Error {
  readonly code: GeminiErrorCode;
  constructor(code: GeminiErrorCode, message: string) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
  }
}

let clientOverride: unknown = null;

export function setGeminiClientOverride(override: unknown) {
  clientOverride = override;
}

export function resetGeminiClientOverride() {
  clientOverride = null;
}

export function getGeminiClient(): GoogleGenAI {
  if (clientOverride) return clientOverride as GoogleGenAI;
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiError(
      "MISSING_API_KEY",
      "Kunci API Gemini (GEMINI_API_KEY) belum dikonfigurasi pada environment server."
    );
  }
  return new GoogleGenAI({ apiKey });
}


export function normalizeGeminiError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err;

  const errorObj = err as Record<string, unknown> | undefined;
  const message = String(errorObj?.message ?? err ?? "");
  const status = Number(errorObj?.status ?? errorObj?.code ?? 0);

  if (message.includes("GEMINI_API_KEY") || message.includes("missing API key")) {
    return new GeminiError("MISSING_API_KEY", "Kunci API Gemini (GEMINI_API_KEY) belum dikonfigurasi pada server.");
  }
  if (
    message.includes("API_KEY_INVALID") ||
    message.includes("API key not valid") ||
    message.includes("invalid api key") ||
    status === 401 ||
    status === 403
  ) {
    return new GeminiError("INVALID_API_KEY", "Kunci API Gemini tidak valid atau tidak memiliki izin akses.");
  }
  if (
    message.includes("rate limit") ||
    message.includes("Rate limit") ||
    message.includes("rateLimitExceeded")
  ) {
    return new GeminiError("RATE_LIMIT", "Batas frekuensi permintaan (rate limit) Gemini terlampaui. Silakan tunggu beberapa saat.");
  }
  if (
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("quota") ||
    message.includes("Quota exceeded") ||
    status === 429
  ) {
    if (message.toLowerCase().includes("rate")) {
      return new GeminiError("RATE_LIMIT", "Batas frekuensi permintaan (rate limit) Gemini terlampaui. Silakan tunggu beberapa saat.");
    }
    return new GeminiError("QUOTA_EXHAUSTED", "Kuota API Gemini telah habis (quota exceeded). Periksa kuota akun Google AI Anda.");
  }
  if (
    message.includes("ETIMEDOUT") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("DEADLINE_EXCEEDED")
  ) {
    return new GeminiError("TIMEOUT", "Permintaan ke layanan Gemini melebihi batas waktu (timeout). Silakan coba lagi.");
  }
  if (
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED") ||
    message.includes("fetch failed") ||
    message.includes("network")
  ) {
    return new GeminiError("NETWORK_FAILURE", "Gagal terhubung ke server Gemini. Periksa koneksi internet server Anda.");
  }
  if (
    message.includes("model not found") ||
    message.includes("NOT_FOUND") ||
    message.includes("is not found for API version") ||
    status === 404
  ) {
    return new GeminiError("MODEL_UNAVAILABLE", "Model Gemini yang diminta tidak tersedia atau tidak didukung.");
  }
  if (message.includes("JSON") || message.includes("format terstruktur") || message.includes("skema")) {
    return new GeminiError("STRUCTURED_OUTPUT_FAILURE", "Respons Gemini tidak sesuai dengan format terstruktur (JSON schema) yang diharapkan.");
  }

  return new GeminiError("UNKNOWN_ERROR", `Terjadi kesalahan saat berkomunikasi dengan Gemini: ${message || "Kesalahan internal."}`);
}

export type GeminiRequestOptions = {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  thinkingLevel?: GeminiThinkingLevel;
  responseMimeType?: string;
  responseSchema?: unknown;
};

export type GeminiResponseResult = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export async function sendGeminiRequest(options: GeminiRequestOptions): Promise<GeminiResponseResult> {
  const modelName = options.model || GEMINI_PRIMARY_MODEL;
  const client = getGeminiClient();

  const thinkingLevelMap: Record<GeminiThinkingLevel, ThinkingLevel> = {
    LOW: ThinkingLevel.LOW,
    MEDIUM: ThinkingLevel.MEDIUM,
    HIGH: ThinkingLevel.HIGH,
  };

  const config: GenerateContentConfig = {
    thinkingConfig: {
      thinkingLevel: options.thinkingLevel ? thinkingLevelMap[options.thinkingLevel] : ThinkingLevel.MEDIUM,
    },
  };

  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }

  if (options.responseMimeType) {
    config.responseMimeType = options.responseMimeType;
  }

  if (options.responseSchema) {
    config.responseSchema = options.responseSchema as GenerateContentConfig["responseSchema"];
  }


  try {
    const response = await client.models.generateContent({
      model: modelName,
      contents: options.prompt,
      config,
    });

    const text = response.text?.trim() ?? "";
    if (!text && !response.candidates?.length) {
      throw new GeminiError("INVALID_RESPONSE", "Format respons dari Gemini tidak valid atau kosong.");
    }

    const inputTokens = response.usageMetadata?.promptTokenCount ?? null;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? null;

    return {
      text,
      inputTokens,
      outputTokens,
    };
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}

export async function testGeminiConnection(): Promise<{
  ok: boolean;
  status: "CONFIGURED" | "NOT_CONFIGURED" | "ERROR";
  message: string;
  model: string;
}> {
  if (!isGeminiConfigured()) {
    return {
      ok: false,
      status: "NOT_CONFIGURED",
      message: "Kunci API Gemini belum dikonfigurasi pada server (GEMINI_API_KEY tidak ditemukan).",
      model: GEMINI_PRIMARY_MODEL,
    };
  }

  try {
    const res = await sendGeminiRequest({
      prompt: "Ping test. Balas hanya dengan kata: OK",
      thinkingLevel: "LOW",
    });

    if (res.text) {
      return {
        ok: true,
        status: "CONFIGURED",
        message: "Koneksi ke Google Gemini API berhasil diverifikasi dan siap digunakan.",
        model: GEMINI_PRIMARY_MODEL,
      };
    }

    return {
      ok: false,
      status: "ERROR",
      message: "Respons pengujian Gemini kosong.",
      model: GEMINI_PRIMARY_MODEL,
    };
  } catch (err) {
    const normalized = normalizeGeminiError(err);
    return {
      ok: false,
      status: "ERROR",
      message: normalized.message,
      model: GEMINI_PRIMARY_MODEL,
    };
  }
}
