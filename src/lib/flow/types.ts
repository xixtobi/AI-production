import type * as schema from "@/lib/db/schema";

export type FlowQueueStatus = typeof schema.flowQueueStatuses[number];
export type FlowQueueReferenceRole = typeof schema.flowQueueReferenceRoles[number];
export type GenerationAttemptStatus = typeof schema.generationAttemptStatuses[number];
export type VideoOutputStatus = typeof schema.videoOutputStatuses[number];

export interface FlowModelCapability {
  code: string;
  name: string;
  supports_text_to_video: boolean;
  supports_first_frame: boolean;
  supports_first_last_frame: boolean;
  supports_ingredients: boolean;
  supports_video_to_video: boolean;
  supports_extend: boolean;
  supported_durations: number[];
  supported_aspect_ratios: string[];
  supported_resolutions: string[];
  supports_audio: boolean;
  description?: string;
}

export interface CompatibilityCheckResult {
  valid: boolean;
  status: "READY" | "BLOCKED";
  errors: string[];
  warnings: string[];
}

export interface FlowReferenceAssetInput {
  assetVersionId: string;
  role: FlowQueueReferenceRole;
  sortOrder?: number;
}

export interface CreateFlowQueueItemInput {
  projectId: string;
  contentItemId: string;
  sceneId?: string | null;
  shotId: string;
  promptVersionId: string;
  engine?: string;
  model?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
  audioEnabled?: boolean;
  startFrameAssetVersionId?: string | null;
  endFrameAssetVersionId?: string | null;
  references?: FlowReferenceAssetInput[];
  notes?: string;
  estimatedCredits?: number | null;
}

export interface RecipeSnapshot {
  projectId: string;
  projectName: string;
  contentCode: string;
  sceneCode: string | null;
  shotCode: string;
  shotTitle: string;
  prompt: {
    versionId: string;
    versionLabel: string;
    promptText: string;
    negativePrompt?: string | null;
    parameters?: Record<string, unknown> | null;
  };
  generationSettings: {
    engine: string;
    model: string;
    durationSeconds: number;
    aspectRatio: string;
    resolution: string;
    audioEnabled: boolean;
  };
  startFrame: {
    assetId: string;
    assetVersionId: string;
    code?: string;
    name?: string;
    relativePath: string;
    fileName: string;
  } | null;
  endFrame: {
    assetId: string;
    assetVersionId: string;
    code?: string;
    name?: string;
    relativePath: string;
    fileName: string;
  } | null;
  references: Array<{
    assetId: string;
    assetVersionId: string;
    role: string;
    code?: string;
    name?: string;
    relativePath: string;
    fileName: string;
  }>;
  createdAt: string;
  snapshotVersion: string;
}

export interface FlowJobManifest {
  jobId: string;
  project: {
    id: string;
    code: string;
    name: string;
  };
  content: {
    id: string;
    code: string;
    title: string;
  };
  scene: {
    id?: string;
    code?: string;
    title?: string;
  } | null;
  shot: {
    id: string;
    code: string;
    title: string;
  };
  promptVersion: {
    id: string;
    versionLabel: string;
    promptText: string;
    negativePrompt?: string | null;
  };
  model: string;
  engine: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  audio: boolean;
  startFrame: {
    assetVersionId: string;
    relativePath: string;
    fileName: string;
  } | null;
  endFrame: {
    assetVersionId: string;
    relativePath: string;
    fileName: string;
  } | null;
  references: Array<{
    assetVersionId: string;
    role: string;
    relativePath: string;
    fileName: string;
  }>;
  preparedAt: string;
  preparationDirectory: string;
}

export interface FlowQueueItemDetail {
  item: schema.FlowQueueItem;
  shot: schema.Shot;
  content: schema.ContentItem;
  scene?: schema.Scene | null;
  promptVersion: schema.PromptVersion;
  startFrameVersion?: schema.AssetVersion | null;
  endFrameVersion?: schema.AssetVersion | null;
  references: Array<{
    link: schema.FlowQueueReference;
    asset: schema.Asset;
    version: schema.AssetVersion;
  }>;
  attempts: schema.GenerationAttempt[];
  videoOutputs: schema.VideoOutput[];
}

export interface FlowQueueFilters {
  contentItemId?: string;
  sceneId?: string;
  shotId?: string;
  status?: string;
  model?: string;
  readyState?: "READY" | "NOT_READY";
  search?: string;
}

export interface RegisterVideoOutputInput {
  projectId: string;
  shotId: string;
  contentItemId?: string;
  sceneId?: string | null;
  flowQueueItemId?: string | null;
  generationAttemptId?: string | null;
  filePath: string; // Absolute path or relative to project root
  model?: string;
  status?: VideoOutputStatus;
  notes?: string;
  creditsUsed?: number | null;
  customDuration?: number | null;
  customResolution?: string | null;
}
