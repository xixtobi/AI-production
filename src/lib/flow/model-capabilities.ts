import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { CompatibilityCheckResult, FlowModelCapability } from "./types";

export const DEFAULT_FLOW_MODELS: Record<string, FlowModelCapability> = {
  "Veo 3.1 Fast": {
    code: "veo-3.1-fast",
    name: "Veo 3.1 Fast",
    supports_text_to_video: true,
    supports_first_frame: true,
    supports_first_last_frame: true,
    supports_ingredients: true,
    supports_video_to_video: false,
    supports_extend: true,
    supported_durations: [4, 5, 6, 8],
    supported_aspect_ratios: ["16:9", "9:16", "1:1"],
    supported_resolutions: ["720p", "1080p"],
    supports_audio: false,
    description: "Model rendering video cepat dengan latensi rendah untuk iterasi harian Google Flow.",
  },
  "Veo 3.1 Quality": {
    code: "veo-3.1-quality",
    name: "Veo 3.1 Quality",
    supports_text_to_video: true,
    supports_first_frame: true,
    supports_first_last_frame: true,
    supports_ingredients: true,
    supports_video_to_video: false,
    supports_extend: true,
    supported_durations: [4, 5, 6, 8],
    supported_aspect_ratios: ["16:9", "9:16", "1:1"],
    supported_resolutions: ["720p", "1080p", "4k"],
    supports_audio: false,
    description: "Model rendering video kualitas tinggi dengan konsistensi fisik dan detail sinematik penuh.",
  },
  "Veo 3.1 Lite": {
    code: "veo-3.1-lite",
    name: "Veo 3.1 Lite",
    supports_text_to_video: true,
    supports_first_frame: true,
    supports_first_last_frame: false,
    supports_ingredients: false,
    supports_video_to_video: false,
    supports_extend: false,
    supported_durations: [4, 5],
    supported_aspect_ratios: ["16:9", "9:16"],
    supported_resolutions: ["720p", "1080p"],
    supports_audio: false,
    description: "Model hemat resource untuk pratinjau gerakan awal tanpa dukungan multi-referensi.",
  },
  "Gemini Omni Flash 1.1": {
    code: "gemini-omni-flash-1.1",
    name: "Gemini Omni Flash 1.1",
    supports_text_to_video: true,
    supports_first_frame: true,
    supports_first_last_frame: true,
    supports_ingredients: true,
    supports_video_to_video: true,
    supports_extend: true,
    supported_durations: [3, 4, 5, 6, 8, 10],
    supported_aspect_ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    supported_resolutions: ["720p", "1080p"],
    supports_audio: true,
    description: "Model multimodal omni dengan dukungan sintesis visual terpadu dan audio narasi bawaan.",
  },
};

// In-memory configurable registry to support runtime registration without hardcoding
const modelRegistry: Map<string, FlowModelCapability> = new Map(
  Object.entries(DEFAULT_FLOW_MODELS).map(([key, val]) => [key.toLowerCase(), val])
);

export function listAvailableFlowModels(): FlowModelCapability[] {
  return Array.from(modelRegistry.values());
}

export function registerCustomModelCapability(capability: FlowModelCapability): void {
  modelRegistry.set(capability.name.toLowerCase(), capability);
  modelRegistry.set(capability.code.toLowerCase(), capability);
}

export function getModelCapability(modelNameOrCode: string): FlowModelCapability | undefined {
  if (!modelNameOrCode) return undefined;
  const normalized = modelNameOrCode.trim().toLowerCase();
  return modelRegistry.get(normalized);
}

export interface ValidateFlowCompatibilityParams {
  projectId: string;
  shotId: string;
  promptVersionId: string;
  model: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution?: string;
  audioEnabled?: boolean;
  startFrameAssetVersionId?: string | null;
  endFrameAssetVersionId?: string | null;
  referenceAssetVersionIds?: string[];
}

export function validateFlowCompatibility(
  params: ValidateFlowCompatibilityParams
): CompatibilityCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate Project & Shot exists
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, params.projectId))
    .get();

  if (!project) {
    errors.push("Proyek tidak ditemukan.");
    return { valid: false, status: "BLOCKED", errors, warnings };
  }

  const shot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.projectId, params.projectId), eq(schema.shots.id, params.shotId)))
    .get();

  if (!shot) {
    errors.push(`Shot dengan ID ${params.shotId} tidak ditemukan dalam proyek.`);
  }

  // 2. Validate Prompt Version exists and has text
  const promptVersion = db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.id, params.promptVersionId))
    .get();

  if (!promptVersion) {
    errors.push("Prompt version tidak ditemukan.");
  } else if (!promptVersion.promptText || !promptVersion.promptText.trim()) {
    errors.push("Teks prompt kosong. Prompt harus diisi sebelum ditambahkan ke Flow Queue.");
  }

  // 3. Validate Model
  const capability = getModelCapability(params.model);
  if (!capability) {
    errors.push(`Model '${params.model}' tidak dikenal dalam registry kapabilitas Flow.`);
  } else {
    // 4. Validate Duration
    if (!capability.supported_durations.includes(params.durationSeconds)) {
      errors.push(
        `Durasi ${params.durationSeconds} detik tidak didukung oleh model ${capability.name}. Durasi yang didukung: ${capability.supported_durations.join(", ")} detik.`
      );
    }

    // 5. Validate Aspect Ratio
    if (!capability.supported_aspect_ratios.includes(params.aspectRatio)) {
      errors.push(
        `Aspek rasio ${params.aspectRatio} tidak didukung oleh model ${capability.name}. Rasio yang didukung: ${capability.supported_aspect_ratios.join(", ")}.`
      );
    }

    // 6. Validate Start Frame
    if (params.startFrameAssetVersionId) {
      if (!capability.supports_first_frame) {
        errors.push(`Model ${capability.name} tidak mendukung input start frame (First Frame).`);
      } else {
        const startFrame = db
          .select()
          .from(schema.assetVersions)
          .where(
            and(
              eq(schema.assetVersions.projectId, params.projectId),
              eq(schema.assetVersions.id, params.startFrameAssetVersionId)
            )
          )
          .get();

        if (!startFrame) {
          errors.push("Aset start frame yang dipilih tidak ditemukan dalam database proyek.");
        } else {
          // Check file existence on disk
          const fullPath = path.resolve(project.rootPath, startFrame.relativePath);
          if (!existsSync(fullPath)) {
            errors.push(`File start frame tidak ditemukan di disk: ${startFrame.relativePath}`);
          }
        }
      }
    }

    // 7. Validate End Frame
    if (params.endFrameAssetVersionId) {
      if (!capability.supports_first_last_frame) {
        errors.push(`Model ${capability.name} tidak mendukung input end frame (First & Last Frame).`);
      } else {
        const endFrame = db
          .select()
          .from(schema.assetVersions)
          .where(
            and(
              eq(schema.assetVersions.projectId, params.projectId),
              eq(schema.assetVersions.id, params.endFrameAssetVersionId)
            )
          )
          .get();

        if (!endFrame) {
          errors.push("Aset end frame yang dipilih tidak ditemukan dalam database proyek.");
        } else {
          const fullPath = path.resolve(project.rootPath, endFrame.relativePath);
          if (!existsSync(fullPath)) {
            errors.push(`File end frame tidak ditemukan di disk: ${endFrame.relativePath}`);
          }
        }
      }
    }

    // 8. Validate References (Ingredients)
    if (params.referenceAssetVersionIds && params.referenceAssetVersionIds.length > 0) {
      if (!capability.supports_ingredients) {
        warnings.push(
          `Model ${capability.name} mungkin tidak mendukung referensi visual (ingredients) secara resmi. Referensi akan tetap disertakan dalam manifest paket Flow.`
        );
      }

      for (const refVersionId of params.referenceAssetVersionIds) {
        const refVersion = db
          .select()
          .from(schema.assetVersions)
          .where(
            and(
              eq(schema.assetVersions.projectId, params.projectId),
              eq(schema.assetVersions.id, refVersionId)
            )
          )
          .get();

        if (!refVersion) {
          errors.push(`Aset referensi dengan ID ${refVersionId} tidak ditemukan dalam database proyek.`);
        } else {
          const fullPath = path.resolve(project.rootPath, refVersion.relativePath);
          if (!existsSync(fullPath)) {
            errors.push(`File aset referensi tidak ditemukan di disk: ${refVersion.relativePath}`);
          }
        }
      }
    }

    // 9. Validate Audio feature
    if (params.audioEnabled && !capability.supports_audio) {
      warnings.push(`Model ${capability.name} tidak memiliki generator audio bawaan.`);
    }

    // 10. Validate Resolution if provided
    if (params.resolution && !capability.supported_resolutions.includes(params.resolution)) {
      warnings.push(
        `Resolusi ${params.resolution} mungkin di-upscale atau tidak didukung secara natif oleh ${capability.name}.`
      );
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    status: valid ? "READY" : "BLOCKED",
    errors,
    warnings,
  };
}
