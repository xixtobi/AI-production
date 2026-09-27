import * as schema from "@/lib/db/schema";
import { promptTypes, promptSources, promptStatuses, flowQueueStatuses } from "@/lib/db/enums";

export type PromptType = (typeof promptTypes)[number];
export type PromptSource = (typeof promptSources)[number];
export type PromptStatus = (typeof promptStatuses)[number];
export type FlowQueueStatus = (typeof flowQueueStatuses)[number];

export interface ImagePromptFields {
  subject: string;
  actionPose: string;
  cameraFraming: string;
  environmentBackground: string;
  lightingAtmosphere: string;
  styleRendering: string;
  qualityTags: string;
  negativeConstraints: string;
}

export interface VideoPromptFields {
  startFrameRef: string;
  actionMovement: string;
  cameraMotion: string;
  speedPacing: string;
  environmentDynamics: string;
  moodTone: string;
  dialogueAudioCues: string;
  endFrameRef: string;
  negativeConstraints: string;
}

export interface AudioPromptFields {
  dialogueLine: string;
  voiceDescription: string;
  emotionTone: string;
  pacingSpeed: string;
  ambientSound: string;
  foleySfx: string;
  musicStyle: string;
}

export type StructuredPromptFields = ImagePromptFields | VideoPromptFields | AudioPromptFields | Record<string, string>;

export interface PromptParameters {
  engine: "VEO" | "MIDJOURNEY" | "KLING" | "RUNWAY" | "CUSTOM" | string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "21:9" | string;
  duration?: number;
  resolution: "720p" | "1080p" | "4k" | string;
  audio?: boolean;
  seed?: number | null;
  structuredFields?: Record<string, string>;
  [key: string]: unknown;
}

export interface PromptDocumentWithVersions {
  document: schema.PromptDocument;
  currentVersion: schema.PromptVersion | null;
  versions: schema.PromptVersion[];
}

export interface PromptDiffLine {
  type: "same" | "add" | "remove";
  line: string;
}

export interface ParameterDiff {
  key: string;
  valueA: unknown;
  valueB: unknown;
  changed: boolean;
}

export interface PromptCompareResult {
  versionA: schema.PromptVersion;
  versionB: schema.PromptVersion;
  promptTextDiff: PromptDiffLine[];
  negativePromptDiff: PromptDiffLine[];
  parameterDiffs: ParameterDiff[];
  sourceDifference: {
    sourceA: PromptSource;
    sourceB: PromptSource;
    changed: boolean;
  };
}

export interface ReferenceAssetInfo {
  assetCode: string;
  name?: string;
  path: string;
  role: string;
}

export interface FlowQueuePayload {
  promptText: string;
  negativePrompt: string;
  engine: string;
  parameters: {
    aspectRatio: string;
    duration?: number;
    resolution: string;
    audio?: boolean;
    seed?: number | null;
    [key: string]: unknown;
  };
  referenceAssets: {
    startFrame?: ReferenceAssetInfo;
    endFrame?: ReferenceAssetInfo;
    characterReferences: ReferenceAssetInfo[];
    environmentReferences: ReferenceAssetInfo[];
  };
  metadata: {
    projectId: string;
    projectCode: string;
    contentId?: string | null;
    contentCode?: string | null;
    sceneId?: string | null;
    sceneCode?: string | null;
    shotId: string;
    shotCode: string;
    promptDocumentId: string;
    promptVersionId: string;
    versionLabel: string;
    source: string;
  };
  stagedAt: string;
}
