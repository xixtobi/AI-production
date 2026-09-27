import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import type { PromptType } from "./types";

export function listPromptTemplates(filters?: {
  category?: "ANIMATION" | "UGC" | string;
  promptType?: PromptType;
}): schema.PromptTemplate[] {
  const query = db.select().from(schema.promptTemplates);

  if (filters?.category && filters?.promptType) {
    return query
      .where(
        and(
          eq(schema.promptTemplates.category, filters.category),
          eq(schema.promptTemplates.promptType, filters.promptType)
        )
      )
      .all();
  } else if (filters?.category) {
    return query.where(eq(schema.promptTemplates.category, filters.category)).all();
  } else if (filters?.promptType) {
    return query.where(eq(schema.promptTemplates.promptType, filters.promptType)).all();
  }

  return query.all();
}

export function getPromptTemplate(idOrCode: string): schema.PromptTemplate {
  const byCode = db
    .select()
    .from(schema.promptTemplates)
    .where(eq(schema.promptTemplates.code, idOrCode))
    .get();

  if (byCode) return byCode;

  const byId = db
    .select()
    .from(schema.promptTemplates)
    .where(eq(schema.promptTemplates.id, idOrCode))
    .get();

  if (byId) return byId;

  throw new DomainError(`Prompt template '${idOrCode}' tidak ditemukan.`);
}

export function createCustomPromptTemplate(params: {
  code: string;
  category: "ANIMATION" | "UGC" | string;
  name: string;
  description?: string;
  promptType: PromptType;
  templateText: string;
  negativePrompt?: string;
  defaultParametersJson?: string;
}): schema.PromptTemplate {
  const existing = db
    .select()
    .from(schema.promptTemplates)
    .where(eq(schema.promptTemplates.code, params.code))
    .get();

  if (existing) {
    throw new DomainError(`Template dengan kode '${params.code}' sudah ada.`);
  }

  const now = new Date();
  const template: schema.PromptTemplate = {
    id: crypto.randomUUID(),
    code: params.code.trim().toUpperCase(),
    category: params.category,
    name: params.name,
    description: params.description || "",
    promptType: params.promptType,
    templateText: params.templateText,
    negativePrompt: params.negativePrompt || "",
    defaultParametersJson: params.defaultParametersJson || null,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(schema.promptTemplates).values(template).run();
  return template;
}

export function applyTemplateToShot(params: {
  templateIdOrCode: string;
  shotId: string;
  projectId: string;
}): {
  promptText: string;
  negativePrompt: string;
  parameters: Record<string, unknown>;
  template: schema.PromptTemplate;
} {
  const template = getPromptTemplate(params.templateIdOrCode);

  const shot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.id, params.shotId), eq(schema.shots.projectId, params.projectId)))
    .get();

  if (!shot) {
    throw new DomainError("Shot tidak ditemukan untuk aplikasi template.");
  }

  const scene = shot.sceneId
    ? db.select().from(schema.scenes).where(eq(schema.scenes.id, shot.sceneId)).get()
    : null;

  // Find linked assets
  const linkedAssets = db
    .select()
    .from(schema.shotAssets)
    .where(and(eq(schema.shotAssets.shotId, shot.id), eq(schema.shotAssets.projectId, params.projectId)))
    .all();

  // Find start frame reference asset
  let startFrameCode = "KF-B08"; // canonical default fallback for SH016
  for (const item of linkedAssets) {
    if (item.role === "START_FRAME") {
      const asset = db.select().from(schema.assets).where(eq(schema.assets.id, item.assetId)).get();
      if (asset) {
        startFrameCode = asset.assetCode;
        break;
      }
    }
  }

  // Find characters
  const projectCharacters = db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.projectId, params.projectId))
    .all();

  // Check which characters match this shot
  const matchedChars = projectCharacters.filter((c) => {
    const textToSearch = `${shot.title} ${shot.description} ${shot.action} ${shot.dialogue}`.toLowerCase();
    return textToSearch.includes(c.name.toLowerCase());
  });

  const characterNames = matchedChars.length > 0
    ? matchedChars.map((c) => c.name).join(", ")
    : "Raka and Lila";

  const characterCostume = matchedChars.length > 0
    ? matchedChars.map((c) => `${c.name}: ${c.costume}`).join("; ")
    : "traveler vest and casual adventure clothes";

  const characterProps = matchedChars.length > 0
    ? matchedChars.map((c) => c.signatureProps).filter(Boolean).join(", ")
    : "ancient compass and journal";

  // Find environment
  let envName = scene?.location || "Rumah Pak Arga";
  let envLighting = "warm morning golden sunlight streaming through wooden windows";
  let envTone = "mysterious, warm, nostalgic";

  const projectEnvironments = db
    .select()
    .from(schema.environments)
    .where(eq(schema.environments.projectId, params.projectId))
    .all();

  const matchedEnv = projectEnvironments.find((e) => {
    const search = `${scene?.location || ""} ${shot.description || ""} ${shot.action || ""}`.toLowerCase();
    return search.includes(e.name.toLowerCase());
  });

  if (matchedEnv) {
    envName = matchedEnv.name;
    if (matchedEnv.timeOfDayNotes) envLighting = matchedEnv.timeOfDayNotes;
    if (matchedEnv.tone) envTone = matchedEnv.tone;
  }

  // Get style bible if exists
  const styleBible = db
    .select()
    .from(schema.styleBibles)
    .where(eq(schema.styleBibles.projectId, params.projectId))
    .get();

  const cameraMovement = shot.cameraType || styleBible?.cameraLanguage || "smooth slow push-in";
  const actionText = shot.action || "Pak Arga opens the vintage wooden box and presents the ancient cloud-engraved compass";
  const dialogueText = shot.dialogue || "";
  let timeOfDay = "morning";
  if (scene) {
    const scriptScene = db
      .select()
      .from(schema.scriptScenes)
      .where(eq(schema.scriptScenes.linkedSceneId, scene.id))
      .get();
    if (scriptScene?.timeOfDay) {
      timeOfDay = scriptScene.timeOfDay;
    }
  }

  // Replace placeholders
  const compiledText = template.templateText
    .replace(/\{\{start_frame_reference\}\}/gi, startFrameCode)
    .replace(/\{\{character\}\}/gi, characterNames)
    .replace(/\{\{costume\}\}/gi, characterCostume)
    .replace(/\{\{environment\}\}/gi, envName)
    .replace(/\{\{action_and_movement\}\}/gi, actionText)
    .replace(/\{\{action_or_pose\}\}/gi, actionText)
    .replace(/\{\{action_or_setting\}\}/gi, actionText)
    .replace(/\{\{camera_movement\}\}/gi, cameraMovement)
    .replace(/\{\{camera_angle\}\}/gi, cameraMovement)
    .replace(/\{\{lighting_and_atmosphere\}\}/gi, envLighting)
    .replace(/\{\{lighting\}\}/gi, envLighting)
    .replace(/\{\{props_and_details\}\}/gi, characterProps)
    .replace(/\{\{prop_or_product\}\}/gi, characterProps)
    .replace(/\{\{product\}\}/gi, characterProps)
    .replace(/\{\{dialogue\}\}/gi, dialogueText)
    .replace(/\{\{time_of_day\}\}/gi, timeOfDay)
    .replace(/\{\{mood_and_tone\}\}/gi, envTone);

  let defaultParams: Record<string, unknown> = {};
  try {
    if (template.defaultParametersJson) {
      defaultParams = JSON.parse(template.defaultParametersJson);
    }
  } catch {}

  return {
    promptText: compiledText,
    negativePrompt: template.negativePrompt || "",
    parameters: defaultParams,
    template,
  };
}
