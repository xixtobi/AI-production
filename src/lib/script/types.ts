import type { InferSelectModel } from "drizzle-orm";
import type * as schema from "@/lib/db/schema";
import type { storyDocumentTypes, scriptBlockTypes, scriptAiActions } from "@/lib/db/enums";

export type StoryDocumentType = (typeof storyDocumentTypes)[number];
export type ScriptBlockType = (typeof scriptBlockTypes)[number];
export type ScriptAiAction = (typeof scriptAiActions)[number];

export type StoryDocument = InferSelectModel<typeof schema.storyDocuments>;
export type StoryDocumentVersion = InferSelectModel<typeof schema.storyDocumentVersions>;

export type ScriptDocument = InferSelectModel<typeof schema.scriptDocuments>;
export type ScriptVersion = InferSelectModel<typeof schema.scriptVersions>;
export type ScriptScene = InferSelectModel<typeof schema.scriptScenes>;
export type ScriptBlock = InferSelectModel<typeof schema.scriptBlocks>;

export type Character = InferSelectModel<typeof schema.characters>;
export type Environment = InferSelectModel<typeof schema.environments>;
export type StoryBible = InferSelectModel<typeof schema.storyBibles>;
export type StyleBible = InferSelectModel<typeof schema.styleBibles>;

export interface ScriptSceneWithBlocks extends ScriptScene {
  blocks: ScriptBlock[];
}

export interface ScriptVersionDetail extends ScriptVersion {
  scenes: ScriptSceneWithBlocks[];
}

export interface ScriptDocumentDetail extends ScriptDocument {
  versions: ScriptVersion[];
  currentVersion: ScriptVersionDetail | null;
}

export interface ScriptBlockInput {
  blockType: ScriptBlockType;
  character?: string;
  content: string;
  notes?: string;
  sortOrder?: number;
}

export interface ScriptSceneInput {
  sceneNumber: number;
  sceneCode: string;
  heading: string;
  location?: string;
  timeOfDay?: string;
  description?: string;
  sortOrder?: number;
  linkedSceneId?: string;
  blocks?: ScriptBlockInput[];
}

export interface AiAssistParams {
  projectId: string;
  contentItemId: string;
  scriptVersionId: string;
  scriptSceneId?: string;
  scriptBlockId?: string;
  action: ScriptAiAction;
  targetContent: string;
  instructions?: string;
  characterName?: string;
  environmentName?: string;
}

export interface AiAssistResult {
  requestId: string;
  action: ScriptAiAction;
  originalText: string;
  suggestion: string;
  reasoning: string;
  suggestedBlocks?: ScriptBlockInput[];
}

export interface GeneratedSceneProposal {
  sceneNumber: number;
  sceneCode: string;
  heading: string;
  location: string;
  timeOfDay: string;
  description: string;
  charactersInvolved: string[];
  sampleDialogueOrAction?: string;
}

export interface GeneratedShotProposal {
  shotNumber: number;
  shotCode: string;
  title: string;
  cameraType: string;
  action: string;
  dialogue: string;
  durationTarget?: number;
  notes?: string;
}

export interface ScriptDiffItem {
  type: "SCENE_ADDED" | "SCENE_REMOVED" | "SCENE_MODIFIED" | "BLOCK_ADDED" | "BLOCK_REMOVED" | "BLOCK_MODIFIED";
  sceneCode?: string;
  heading?: string;
  blockType?: ScriptBlockType;
  character?: string;
  oldContent?: string;
  newContent?: string;
  details: string;
}

export interface AffectedShot {
  shotId: string;
  shotCode: string;
  shotNumber: number;
  title: string;
  sceneId?: string | null;
  sceneCode?: string;
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  suggestedAction: string;
}

export interface ChangeImpactReport {
  baseVersion: { id: string; label: string; isLocked: boolean };
  targetVersion: { id: string; label: string; isLocked: boolean };
  diffs: ScriptDiffItem[];
  hasModifications: boolean;
  affectedShots: AffectedShot[];
  warningMessage?: string;
}
