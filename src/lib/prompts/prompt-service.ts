import "server-only";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import type {
  PromptType,
  PromptSource,
  PromptParameters,
  PromptDocumentWithVersions,
  PromptCompareResult,
  PromptDiffLine,
  ParameterDiff,
} from "./types";

export function getOrCreatePromptDocumentForShot(params: {
  projectId: string;
  shotId: string;
  promptType?: PromptType;
  name?: string;
}): schema.PromptDocument {
  const existing = db
    .select()
    .from(schema.promptDocuments)
    .where(
      and(
        eq(schema.promptDocuments.projectId, params.projectId),
        eq(schema.promptDocuments.shotId, params.shotId)
      )
    )
    .get();

  if (existing) {
    return existing;
  }

  const shot = db
    .select()
    .from(schema.shots)
    .where(
      and(
        eq(schema.shots.projectId, params.projectId),
        eq(schema.shots.id, params.shotId)
      )
    )
    .get();

  if (!shot) {
    throw new DomainError("Shot tidak ditemukan untuk pembuatan Prompt Document.");
  }

  const now = new Date();
  const docId = crypto.randomUUID();
  const name = params.name || `${shot.shotCode} - Prompt ${params.promptType || "VIDEO"}`;

  const doc: schema.PromptDocument = {
    id: docId,
    projectId: params.projectId,
    contentItemId: shot.contentItemId,
    sceneId: shot.sceneId,
    shotId: shot.id,
    promptType: params.promptType || "VIDEO",
    name,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };

  db.insert(schema.promptDocuments).values(doc).run();
  return doc;
}

export function getPromptDocumentWithVersions(documentId: string): PromptDocumentWithVersions {
  const document = db
    .select()
    .from(schema.promptDocuments)
    .where(eq(schema.promptDocuments.id, documentId))
    .get();

  if (!document) {
    throw new DomainError("Prompt document tidak ditemukan.");
  }

  const versions = db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.promptDocumentId, documentId))
    .orderBy(schema.promptVersions.versionNumber)
    .all();

  const currentVersion = versions.find((v) => v.isCurrent) || versions[versions.length - 1] || null;

  return {
    document,
    currentVersion,
    versions,
  };
}

export function getPromptForShot(projectId: string, shotId: string, promptType?: PromptType): PromptDocumentWithVersions {
  const document = getOrCreatePromptDocumentForShot({ projectId, shotId, promptType });
  return getPromptDocumentWithVersions(document.id);
}

function resolvePromptDirectory(params: {
  project: schema.Project;
  contentCode?: string | null;
  shotCode: string;
}): string {
  const root = params.project.rootPath || path.join(process.cwd(), ".local-production-control", "projects", params.project.code);
  const contentFolder = params.contentCode ? params.contentCode : "";
  const targetDir = path.join(root, contentFolder, params.shotCode, "PROMPT");

  try {
    mkdirSync(targetDir, { recursive: true });
    return targetDir;
  } catch {
    const fallbackDir = path.join(
      process.cwd(),
      ".local-production-control",
      "storage",
      params.project.code,
      contentFolder,
      params.shotCode,
      "PROMPT"
    );
    mkdirSync(fallbackDir, { recursive: true });
    return fallbackDir;
  }
}

export function savePromptVersionMarkdownFile(params: {
  project: schema.Project;
  contentCode?: string | null;
  shotCode: string;
  versionLabel: string;
  promptText: string;
  negativePrompt?: string;
  parameters?: Record<string, unknown>;
  source: PromptSource;
  notes?: string;
  createdAt: Date;
  isLocked?: boolean;
}): string {
  const targetDir = resolvePromptDirectory({
    project: params.project,
    contentCode: params.contentCode,
    shotCode: params.shotCode,
  });

  const filename = `${params.versionLabel}.md`;
  const filePath = path.join(targetDir, filename);

  const parameters = params.parameters || {};
  const engine = (parameters.engine as string) || "VEO";
  const aspectRatio = (parameters.aspectRatio as string) || params.project.defaultAspectRatio || "16:9";
  const duration = parameters.duration != null ? `${parameters.duration}s` : "4s";
  const resolution = (parameters.resolution as string) || "1080p";
  const audio = parameters.audio === true ? "Enabled" : "Disabled";

  const frontmatter = [
    "---",
    `version: "${params.versionLabel}"`,
    `source: "${params.source}"`,
    `engine: "${engine}"`,
    `status: "${params.isLocked ? "LOCKED" : "READY"}"`,
    `created_at: "${params.createdAt.toISOString()}"`,
    `project: "${params.project.code}"`,
    `shot: "${params.shotCode}"`,
    "parameters:",
    `  engine: "${engine}"`,
    `  aspectRatio: "${aspectRatio}"`,
    `  duration: "${duration}"`,
    `  resolution: "${resolution}"`,
    `  audio: ${parameters.audio === true}`,
    "---",
  ].join("\n");

  const body = [
    frontmatter,
    "",
    `# Prompt (${params.versionLabel})`,
    "",
    params.promptText,
    "",
    "## Negative Prompt",
    "",
    params.negativePrompt || "_None specified_",
    "",
    "## Engine & Generation Settings",
    "",
    `- **Engine**: ${engine}`,
    `- **Aspect Ratio**: ${aspectRatio}`,
    `- **Duration**: ${duration}`,
    `- **Resolution**: ${resolution}`,
    `- **Audio**: ${audio}`,
    "",
    "## Metadata",
    "",
    `- **Project**: ${params.project.name} (${params.project.code})`,
    `- **Shot**: ${params.shotCode}`,
    `- **Source**: ${params.source}`,
    `- **Locked**: ${params.isLocked ? "Yes" : "No"}`,
    params.notes ? `- **Notes**: ${params.notes}` : "",
    "",
  ].filter(Boolean).join("\n");

  writeFileSync(filePath, body, "utf8");
  return filePath;
}

export function createPromptVersion(params: {
  documentId: string;
  promptText: string;
  negativePrompt?: string;
  parameters?: PromptParameters | Record<string, unknown>;
  source?: PromptSource;
  notes?: string;
  isLocked?: boolean;
  forceNewVersion?: boolean;
}): schema.PromptVersion {
  const document = db
    .select()
    .from(schema.promptDocuments)
    .where(eq(schema.promptDocuments.id, params.documentId))
    .get();

  if (!document) {
    throw new DomainError("Prompt document tidak ditemukan.");
  }

  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, document.projectId))
    .get();

  if (!project) {
    throw new DomainError("Proyek tidak ditemukan.");
  }

  const shot = document.shotId
    ? db.select().from(schema.shots).where(eq(schema.shots.id, document.shotId)).get()
    : null;

  const content = document.contentItemId
    ? db.select().from(schema.contentItems).where(eq(schema.contentItems.id, document.contentItemId)).get()
    : null;

  const existingVersions = db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.promptDocumentId, params.documentId))
    .orderBy(schema.promptVersions.versionNumber)
    .all();

  const currentVersion = existingVersions.find((v) => v.isCurrent) || existingVersions[existingVersions.length - 1];

  let nextVersionNumber = 1;
  let shouldCreateNew = true;

  if (existingVersions.length > 0) {
    const highestNumber = Math.max(...existingVersions.map((v) => v.versionNumber), 0);
    if (currentVersion && !currentVersion.isLocked && !params.forceNewVersion) {
      // If current is NOT locked and not forced, we can update in place or bump.
      // Rule: "Once a version is LOCKED, it cannot be modified. Any edit to a locked version creates a new version"
      // If not locked and not forced, create new version only if promptText changed and user requests it,
      // but here we bump when forced or locked.
      shouldCreateNew = false;
      nextVersionNumber = currentVersion.versionNumber;
    } else {
      nextVersionNumber = highestNumber + 1;
      shouldCreateNew = true;
    }
  }

  const versionLabel = `V${String(nextVersionNumber).padStart(2, "0")}`;
  const now = new Date();
  const source = params.source || "MANUAL";
  const parametersJson = params.parameters ? JSON.stringify(params.parameters) : null;
  const shotCode = shot ? shot.shotCode : "GENERAL";

  const localFilePath = savePromptVersionMarkdownFile({
    project,
    contentCode: content?.code,
    shotCode,
    versionLabel,
    promptText: params.promptText,
    negativePrompt: params.negativePrompt,
    parameters: params.parameters as Record<string, unknown>,
    source,
    notes: params.notes,
    createdAt: now,
    isLocked: params.isLocked || false,
  });

  return db.transaction((tx) => {
    // Unset isCurrent from all previous versions
    tx.update(schema.promptVersions)
      .set({ isCurrent: false })
      .where(eq(schema.promptVersions.promptDocumentId, params.documentId))
      .run();

    let resultVersion: schema.PromptVersion;

    if (!shouldCreateNew && currentVersion) {
      tx.update(schema.promptVersions)
        .set({
          promptText: params.promptText,
          negativePrompt: params.negativePrompt || null,
          parametersJson,
          source,
          isCurrent: true,
          isLocked: params.isLocked || false,
          localFilePath,
          notes: params.notes || currentVersion.notes,
        })
        .where(eq(schema.promptVersions.id, currentVersion.id))
        .run();

      resultVersion = tx
        .select()
        .from(schema.promptVersions)
        .where(eq(schema.promptVersions.id, currentVersion.id))
        .get()!;
    } else {
      const versionId = crypto.randomUUID();
      const newVersion: schema.PromptVersion = {
        id: versionId,
        promptDocumentId: params.documentId,
        versionNumber: nextVersionNumber,
        versionLabel,
        promptText: params.promptText,
        negativePrompt: params.negativePrompt || null,
        parametersJson,
        source,
        isCurrent: true,
        isLocked: params.isLocked || false,
        localFilePath,
        notes: params.notes || "",
        createdAt: now,
      };

      tx.insert(schema.promptVersions).values(newVersion).run();
      resultVersion = newVersion;
    }

    tx.update(schema.promptDocuments)
      .set({
        status: "READY",
        updatedAt: now,
      })
      .where(eq(schema.promptDocuments.id, params.documentId))
      .run();

    return resultVersion;
  });
}

export function lockPromptVersion(versionId: string): schema.PromptVersion {
  const version = db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.id, versionId))
    .get();

  if (!version) {
    throw new DomainError("Versi prompt tidak ditemukan.");
  }

  if (version.isLocked) {
    return version;
  }

  db.update(schema.promptVersions)
    .set({ isLocked: true })
    .where(eq(schema.promptVersions.id, versionId))
    .run();

  return db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.id, versionId))
    .get()!;
}

export function setCurrentPromptVersion(documentId: string, versionId: string): schema.PromptVersion {
  return db.transaction((tx) => {
    tx.update(schema.promptVersions)
      .set({ isCurrent: false })
      .where(eq(schema.promptVersions.promptDocumentId, documentId))
      .run();

    tx.update(schema.promptVersions)
      .set({ isCurrent: true })
      .where(
        and(
          eq(schema.promptVersions.id, versionId),
          eq(schema.promptVersions.promptDocumentId, documentId)
        )
      )
      .run();

    const current = tx
      .select()
      .from(schema.promptVersions)
      .where(eq(schema.promptVersions.id, versionId))
      .get();

    if (!current) {
      throw new DomainError("Versi prompt tidak ditemukan pada dokumen ini.");
    }

    return current;
  });
}

function computeLineDiff(textA: string, textB: string): PromptDiffLine[] {
  const linesA = textA.split("\n");
  const linesB = textB.split("\n");
  const diff: PromptDiffLine[] = [];

  const maxLines = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLines; i++) {
    const a = linesA[i];
    const b = linesB[i];

    if (a === b) {
      if (a !== undefined) diff.push({ type: "same", line: a });
    } else {
      if (a !== undefined && !linesB.includes(a)) {
        diff.push({ type: "remove", line: a });
      }
      if (b !== undefined && !linesA.includes(b)) {
        diff.push({ type: "add", line: b });
      } else if (a !== undefined && linesB.includes(a)) {
        diff.push({ type: "same", line: a });
      }
    }
  }

  return diff;
}

export function comparePromptVersions(versionIdA: string, versionIdB: string): PromptCompareResult {
  const versionA = db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.id, versionIdA))
    .get();

  const versionB = db
    .select()
    .from(schema.promptVersions)
    .where(eq(schema.promptVersions.id, versionIdB))
    .get();

  if (!versionA || !versionB) {
    throw new DomainError("Salah satu atau kedua versi prompt tidak ditemukan.");
  }

  const promptTextDiff = computeLineDiff(versionA.promptText || "", versionB.promptText || "");
  const negativePromptDiff = computeLineDiff(versionA.negativePrompt || "", versionB.negativePrompt || "");

  let paramsA: Record<string, unknown> = {};
  let paramsB: Record<string, unknown> = {};
  try {
    if (versionA.parametersJson) paramsA = JSON.parse(versionA.parametersJson);
  } catch {}
  try {
    if (versionB.parametersJson) paramsB = JSON.parse(versionB.parametersJson);
  } catch {}

  const allKeys = Array.from(new Set([...Object.keys(paramsA), ...Object.keys(paramsB)]));
  const parameterDiffs: ParameterDiff[] = allKeys.map((key) => {
    const valA = paramsA[key];
    const valB = paramsB[key];
    const changed = JSON.stringify(valA) !== JSON.stringify(valB);
    return {
      key,
      valueA: valA ?? null,
      valueB: valB ?? null,
      changed,
    };
  });

  return {
    versionA,
    versionB,
    promptTextDiff,
    negativePromptDiff,
    parameterDiffs,
    sourceDifference: {
      sourceA: versionA.source,
      sourceB: versionB.source,
      changed: versionA.source !== versionB.source,
    },
  };
}

export function compileStructuredPrompt(
  promptType: PromptType,
  fields: Record<string, string>
): { promptText: string; negativePrompt: string } {
  const parts: string[] = [];

  if (promptType === "IMAGE") {
    if (fields.subject) parts.push(fields.subject.trim());
    if (fields.actionPose) parts.push(fields.actionPose.trim());
    if (fields.cameraFraming) parts.push(fields.cameraFraming.trim());
    if (fields.environmentBackground) parts.push(`in ${fields.environmentBackground.trim()}`);
    if (fields.lightingAtmosphere) parts.push(fields.lightingAtmosphere.trim());
    if (fields.styleRendering) parts.push(fields.styleRendering.trim());
    if (fields.qualityTags) parts.push(fields.qualityTags.trim());
  } else if (promptType === "AUDIO") {
    if (fields.dialogueLine) parts.push(`Spoken dialogue: "${fields.dialogueLine.trim()}"`);
    if (fields.voiceDescription) parts.push(`Voice: ${fields.voiceDescription.trim()}`);
    if (fields.emotionTone) parts.push(`Tone: ${fields.emotionTone.trim()}`);
    if (fields.pacingSpeed) parts.push(`Pacing: ${fields.pacingSpeed.trim()}`);
    if (fields.ambientSound) parts.push(`Ambience: ${fields.ambientSound.trim()}`);
    if (fields.foleySfx) parts.push(`SFX: ${fields.foleySfx.trim()}`);
    if (fields.musicStyle) parts.push(`Music: ${fields.musicStyle.trim()}`);
  } else {
    // Default VIDEO
    if (fields.startFrameRef) parts.push(`Starting from keyframe ${fields.startFrameRef.trim()}:`);
    if (fields.actionMovement) parts.push(fields.actionMovement.trim());
    if (fields.cameraMotion) parts.push(fields.cameraMotion.trim());
    if (fields.speedPacing) parts.push(`Pacing: ${fields.speedPacing.trim()}`);
    if (fields.environmentDynamics) parts.push(fields.environmentDynamics.trim());
    if (fields.moodTone) parts.push(`Mood: ${fields.moodTone.trim()}`);
    if (fields.dialogueAudioCues) parts.push(`Dialogue / Audio cue: ${fields.dialogueAudioCues.trim()}`);
    if (fields.endFrameRef) parts.push(`Ending at frame ${fields.endFrameRef.trim()}`);
  }

  const promptText = parts.filter(Boolean).join(". ").replace(/\.\./g, ".").trim();
  const negativePrompt = (fields.negativeConstraints || "").trim();

  return { promptText, negativePrompt };
}
