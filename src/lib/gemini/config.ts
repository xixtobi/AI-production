export const GEMINI_PRIMARY_MODEL = "gemini-3.8-flash";

export const GEMINI_SUPPORTED_MODELS = [
  GEMINI_PRIMARY_MODEL,
] as const;

export const GEMINI_THINKING_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type GeminiThinkingLevel = (typeof GEMINI_THINKING_LEVELS)[number];

export const GEMINI_DEFAULT_THINKING_LEVEL: GeminiThinkingLevel = "MEDIUM";

export const TASK_DEFAULT_THINKING_LEVELS: Record<string, GeminiThinkingLevel> = {
  METADATA: "LOW",
  DIALOGUE: "MEDIUM",
  SCRIPT: "HIGH",
  SCRIPT_GENERATION: "HIGH",
  SCRIPT_REWRITE: "HIGH",
  DIALOGUE_POLISH: "MEDIUM",
  SCENE_BREAKDOWN: "HIGH",
  SHOT_BREAKDOWN: "HIGH",
  PROMPT_GENERATION: "MEDIUM",
  CONTINUITY_CHECK: "HIGH",
  PRODUCTION_REVIEW: "HIGH",
};

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}
