import { GEMINI_PRIMARY_MODEL } from "./config";
import { db } from "@/lib/db";
import { aiRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const MODEL_RATES_PER_MILLION: Record<string, { input: number; output: number }> = {
  [GEMINI_PRIMARY_MODEL]: { input: 0.075, output: 0.30 },
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
};

export function estimateUsageCost(
  model: string,
  inputTokens?: number | null,
  outputTokens?: number | null
): number | null {
  const inTokens = inputTokens ?? 0;
  const outTokens = outputTokens ?? 0;
  if (inTokens === 0 && outTokens === 0) return null;

  const rate = MODEL_RATES_PER_MILLION[model] || { input: 0.075, output: 0.30 };
  const inputCost = (inTokens / 1_000_000) * rate.input;
  const outputCost = (outTokens / 1_000_000) * rate.output;
  const total = inputCost + outputCost;

  return Math.round(total * 1_000_000) / 1_000_000;
}

export function formatTokenCostDisplay(
  inputTokens?: number | null,
  outputTokens?: number | null,
  estimatedCost?: number | null
): string {
  const inCount = inputTokens ?? 0;
  const outCount = outputTokens ?? 0;
  const total = inCount + outCount;
  if (total === 0) return "-";

  const costStr = estimatedCost != null ? ` (~$${estimatedCost.toFixed(6)})` : "";
  return `${total.toLocaleString()} tok (${inCount.toLocaleString()} in / ${outCount.toLocaleString()} out)${costStr}`;
}

export function recordAiUsage(
  requestId: string,
  inputTokens?: number | null,
  outputTokens?: number | null,
  model = GEMINI_PRIMARY_MODEL
) {
  const cost = estimateUsageCost(model, inputTokens, outputTokens);
  db.update(aiRequests)
    .set({
      inputTokens: inputTokens ?? null,
      outputTokens: outputTokens ?? null,
      estimatedCost: cost,
    })
    .where(eq(aiRequests.id, requestId))
    .run();

  return { inputTokens, outputTokens, estimatedCost: cost };
}
