import "server-only";

import { and, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { sendGeminiRequest, isGeminiConfigured } from "@/lib/gemini/client";
import { GEMINI_PRIMARY_MODEL } from "@/lib/gemini/config";
import type { ContinuityAiFinding } from "./types";
import { listContinuityRules } from "./continuity-service";

export interface AnalyzeContinuityParams {
  projectId: string;
  shotId: string;
  referenceShotId?: string;
  selectedRuleIds?: string[];
}

export async function analyzeContinuityWithGemini(
  params: AnalyzeContinuityParams
): Promise<{
  findings: ContinuityAiFinding[];
  summary: string;
  previousShot: { id: string; shotCode: string } | null;
  nextShot: { id: string; shotCode: string } | null;
}> {
  const currentShot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.id, params.shotId), eq(schema.shots.projectId, params.projectId)))
    .get();
  if (!currentShot) throw new DomainError("Shot tidak ditemukan.");

  // Get content shots ordered by shotNumber
  const allShots = db
    .select()
    .from(schema.shots)
    .where(
      and(
        eq(schema.shots.projectId, params.projectId),
        eq(schema.shots.contentItemId, currentShot.contentItemId)
      )
    )
    .orderBy(asc(schema.shots.shotNumber))
    .all();

  const currentIndex = allShots.findIndex((s) => s.id === currentShot.id);
  const prevShot = currentIndex > 0 ? allShots[currentIndex - 1] : null;
  const nextShot = currentIndex < allShots.length - 1 ? allShots[currentIndex + 1] : null;

  // Characters & environments
  const characters = db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.projectId, params.projectId))
    .all();

  const environments = db
    .select()
    .from(schema.environments)
    .where(eq(schema.environments.projectId, params.projectId))
    .all();

  // Active continuity rules
  const rules = listContinuityRules(params.projectId, true);

  // Referenced assets for current shot
  const shotAssets = db
    .select({
      asset: schema.assets,
      version: schema.assetVersions,
      link: schema.shotAssets,
    })
    .from(schema.shotAssets)
    .innerJoin(schema.assets, eq(schema.assets.id, schema.shotAssets.assetId))
    .leftJoin(
      schema.assetVersions,
      and(
        eq(schema.assetVersions.assetId, schema.assets.id),
        eq(schema.assetVersions.isCurrent, true)
      )
    )
    .where(
      and(
        eq(schema.shotAssets.projectId, params.projectId),
        eq(schema.shotAssets.shotId, currentShot.id)
      )
    )
    .all();

  // Build prompt
  const systemInstruction = `You are a professional film and animation Continuity Supervisor and Quality Control Director.
Your task is to analyze shot continuity against previous and subsequent shots, character bibles, environment bibles, and story continuity rules.
Always return structured JSON containing an array of findings and an overall summary.
Each finding must clearly identify:
- ruleType: One of "CHARACTER_APPEARANCE", "COSTUME", "PROP", "LOCATION", "TIME_OF_DAY", "LIGHTING", "POSITION", "STORY_STATE"
- severity: One of "MINOR", "MAJOR", "CRITICAL"
- finding: Detailed explanation of the continuity issue or inconsistency
- referenceShotCode: The related shot code (e.g. "${prevShot?.shotCode || "PREV"}" or "${currentShot.shotCode}")
- proposedAction: Concrete corrective recommendation for the artists / prompt engineer`;

  const prompt = `Lakukan evaluasi kontinuitas mendalam untuk shot berikut:

[CURRENT SHOT: ${currentShot.shotCode}]
- Judul: ${currentShot.title}
- Action: ${currentShot.action || "Tidak ada"}
- Dialog: ${currentShot.dialogue || "Tidak ada"}
- Kamera: ${currentShot.cameraType || "Standard"}
- Catatan: ${currentShot.notes || "Tidak ada"}

[PREVIOUS SHOT: ${prevShot ? prevShot.shotCode : "None (Opening Shot)"}]
${
  prevShot
    ? `- Judul: ${prevShot.title}
- Action: ${prevShot.action || "-"}
- Dialog: ${prevShot.dialogue || "-"}`
    : "Tidak ada shot sebelumnya."
}

[NEXT SHOT: ${nextShot ? nextShot.shotCode : "None (Closing Shot)"}]
${
  nextShot
    ? `- Judul: ${nextShot.title}
- Action: ${nextShot.action || "-"}
- Dialog: ${nextShot.dialogue || "-"}`
    : "Tidak ada shot berikutnya."
}

[ATURAN KONTINUITAS AKTIF]
${rules.map((r) => `- [${r.ruleType}] ${r.name}: ${r.description} (Severity: ${r.severity})`).join("\n")}

[KARAKTER TERDAFTAR]
${characters.map((c) => `- ${c.name} (${c.role}): ${c.appearance || c.personality || ""}`).join("\n")}

[LINGKUNGAN & LOKASI]
${environments.map((e) => `- ${e.name}: ${e.description || e.visualCharacteristics || ""}`).join("\n")}

[ASET REFERENSI SHOT INI]
${shotAssets.map((sa) => `- ${sa.asset.assetCode} (${sa.link.role}): ${sa.asset.name}`).join("\n") || "Belum ada aset terhubung."}

Instruksi Tambahan:
Jika terdapat potensi inkonsistensi posisi, properti, pakaian, atau arah pencahayaan antara ${currentShot.shotCode} dan shot sebelum/sesudahnya, cantumkan sebagai finding terstruktur.
Format respons HARUS berupa JSON murni dengan format:
{
  "summary": "...",
  "findings": [
    {
      "ruleType": "...",
      "severity": "...",
      "finding": "...",
      "referenceShotCode": "...",
      "proposedAction": "..."
    }
  ]
}`;

  let findings: ContinuityAiFinding[] = [];
  let summary = "";

  if (isGeminiConfigured()) {
    try {
      const response = await sendGeminiRequest({
        model: GEMINI_PRIMARY_MODEL,
        prompt,
        systemInstruction,
        responseMimeType: "application/json",
        thinkingLevel: "MEDIUM",
      });

      const parsed = JSON.parse(response.text);
      if (Array.isArray(parsed.findings)) {
        findings = parsed.findings.map((f: Record<string, unknown>) => ({
          ruleType: (f.ruleType as schema.ContinuityRuleType) || "CHARACTER_APPEARANCE",
          severity: (f.severity as schema.QcSeverity) || "MAJOR",
          finding: String(f.finding || ""),
          referenceShotCode: String(f.referenceShotCode || prevShot?.shotCode || currentShot.shotCode),
          proposedAction: String(f.proposedAction || ""),
        }));
      }
      summary = parsed.summary || "Evaluasi kontinuitas selesai.";
    } catch {
      // In offline / test mode or API failure, provide deterministic fallback based on rules
      summary = `Evaluasi kontinuitas offline untuk ${currentShot.shotCode}.`;
      findings = [
        {
          ruleType: "PROP",
          severity: "MAJOR",
          finding: `Pemeriksaan properti antara ${prevShot?.shotCode || "SHOT"} dan ${currentShot.shotCode}: pastikan prop konsisten.`,
          referenceShotCode: prevShot?.shotCode || currentShot.shotCode,
          proposedAction: "Verifikasi start frame image dan deskripsi naskah.",
        },
      ];
    }
  } else {
    // Deterministic fallback when Gemini API key is not configured
    summary = `Evaluasi kontinuitas lokal (offline) untuk ${currentShot.shotCode}.`;
    findings = [
      {
        ruleType: "CHARACTER_APPEARANCE",
        severity: "MAJOR",
        finding: `Konsistensi tampilan karakter antara ${prevShot?.shotCode || "SHOT"} dan ${currentShot.shotCode}.`,
        referenceShotCode: prevShot?.shotCode || currentShot.shotCode,
        proposedAction: "Pastikan model dan start frame keyframe terhubung.",
      },
    ];
  }

  return {
    findings,
    summary,
    previousShot: prevShot ? { id: prevShot.id, shotCode: prevShot.shotCode } : null,
    nextShot: nextShot ? { id: nextShot.id, shotCode: nextShot.shotCode } : null,
  };
}

export const analyzeShotContinuity = analyzeContinuityWithGemini;

