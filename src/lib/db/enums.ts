export const projectTypes = ["ANIMATION_SERIES", "UGC_SERIES", "YOUTUBE", "SHORT_FILM", "ADVERTISEMENT", "DOCUMENTARY", "OTHER"] as const;
export const projectStatuses = ["NOT_STARTED", "IN_PROGRESS", "APPROVED", "NEEDS_REVISION", "BLOCKED", "FINAL"] as const;
export const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const assetTypes = ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "REFERENCE", "3D", "TEXT", "OTHER"] as const;
export const shotAssetRoles = ["START_FRAME", "END_FRAME", "REFERENCE", "CHARACTER_REFERENCE", "ENVIRONMENT_REFERENCE", "PROP_REFERENCE", "STYLE_REFERENCE", "THUMBNAIL"] as const;
export const assetRelationshipTypes = ["USED_AS_REFERENCE", "DERIVED_FROM", "VARIANT_OF", "CHARACTER_REFERENCE_FOR", "ENVIRONMENT_REFERENCE_FOR", "PROP_REFERENCE_FOR"] as const;
export const aiThinkingLevels = ["LOW", "MEDIUM", "HIGH"] as const;
export const aiTaskCodes = ["SCRIPT_GENERATION", "SCRIPT_REWRITE", "DIALOGUE_POLISH", "SCENE_BREAKDOWN", "SHOT_BREAKDOWN", "PROMPT_GENERATION", "CONTINUITY_CHECK", "PRODUCTION_REVIEW"] as const;
export const aiRequestStatuses = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "ACCEPTED", "REJECTED"] as const;

export const storyDocumentTypes = ["CONCEPT", "LOGLINE", "SYNOPSIS", "OUTLINE", "STORY_BIBLE"] as const;
export const scriptBlockTypes = ["ACTION", "DIALOGUE", "CHARACTER", "PARENTHETICAL", "SFX", "MUSIC", "TRANSITION", "NOTE"] as const;
export const scriptAiActions = [
  "CONTINUE",
  "REWRITE",
  "SHORTEN",
  "EXPAND",
  "DIALOGUE_POLISH",
  "IMPROVE_PACING",
  "ADD_ACTION",
  "CHILD_FRIENDLY_REWRITE",
  "CONTINUITY_CHECK"
] as const;

export const promptTypes = ["IMAGE", "VIDEO", "AUDIO", "TEXT", "OTHER"] as const;
export const promptSources = ["MANUAL", "GEMINI", "TEMPLATE", "IMPORTED"] as const;
export const promptStatuses = ["DRAFT", "READY", "IN_REVIEW", "APPROVED", "REJECTED"] as const;
export const flowQueueStatuses = ["QUEUED", "READY", "GENERATING", "COMPLETED", "NEEDS_REVIEW", "FAILED", "CANCELLED", "BLOCKED", "STAGED", "PROCESSING"] as const;
export const flowQueueReferenceRoles = ["CHARACTER_REFERENCE", "ENVIRONMENT_REFERENCE", "PROP_REFERENCE", "STYLE_REFERENCE", "OTHER"] as const;
export const generationAttemptStatuses = ["STARTED", "COMPLETED", "FAILED", "CANCELLED"] as const;
export const videoOutputStatuses = ["NOT_STARTED", "IN_PROGRESS", "APPROVED", "NEEDS_REVISION", "BLOCKED", "FINAL"] as const;

export const qcReviewTypes = ["VISUAL", "CHARACTER", "ENVIRONMENT", "CONTINUITY", "CAMERA", "MOTION", "DIALOGUE", "AUDIO", "PROMPT", "TECHNICAL", "OTHER"] as const;
export const qcReviewStatuses = ["OPEN", "IN_REVIEW", "RESOLVED", "WAIVED"] as const;
export const qcSeverities = ["MINOR", "MAJOR", "CRITICAL"] as const;

export const continuityRuleTypes = ["CHARACTER_APPEARANCE", "COSTUME", "PROP", "LOCATION", "TIME_OF_DAY", "LIGHTING", "POSITION", "STORY_STATE"] as const;
export const continuityCheckStatuses = ["OPEN", "REVIEWED", "RESOLVED", "WAIVED"] as const;

export const productionMilestoneStatuses = ["NOT_STARTED", "IN_PROGRESS", "APPROVED", "FINAL"] as const;
export const qcChecklistCategories = ["VISUAL", "TECHNICAL", "STORY"] as const;

export const activityActionTypes = [
  "PROJECT_CREATE",
  "CONTENT_CREATE",
  "SHOT_CREATE",
  "ASSET_REGISTER",
  "PROMPT_CREATE",
  "VIDEO_REGISTER",
  "QC_ACTION",
  "APPROVAL",
  "BACKUP_CREATE",
  "BACKUP_RESTORE",
  "PROJECT_EXPORT",
  "PROJECT_IMPORT",
  "SETTINGS_UPDATE",
  "ARCHIVE",
  "UNARCHIVE",
  "INDEX_REBUILD",
  "SCAN"
] as const;

export const favoriteEntityTypes = ["PROJECT", "CONTENT", "SHOT", "ASSET"] as const;
export type FavoriteEntityType = typeof favoriteEntityTypes[number];
export const backupTypes = ["METADATA_BACKUP", "FULL_PROJECT_BACKUP"] as const;
export type BackupType = typeof backupTypes[number];
export const backupStatuses = ["COMPLETED", "FAILED", "IN_PROGRESS"] as const;
export type BackupStatus = typeof backupStatuses[number];
export type ActivityActionType = typeof activityActionTypes[number];

