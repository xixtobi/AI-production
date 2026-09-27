import { foreignKey, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { activityActionTypes, aiRequestStatuses, aiTaskCodes, aiThinkingLevels, assetRelationshipTypes, assetTypes, backupStatuses, backupTypes, continuityCheckStatuses, continuityRuleTypes, favoriteEntityTypes, flowQueueReferenceRoles, flowQueueStatuses, generationAttemptStatuses, priorities, productionMilestoneStatuses, projectStatuses, projectTypes, promptSources, promptStatuses, promptTypes, qcChecklistCategories, qcReviewStatuses, qcReviewTypes, qcSeverities, scriptBlockTypes, shotAssetRoles, storyDocumentTypes, videoOutputStatuses } from "./enums";
export { activityActionTypes, aiRequestStatuses, aiTaskCodes, aiThinkingLevels, assetRelationshipTypes, assetTypes, backupStatuses, backupTypes, continuityCheckStatuses, continuityRuleTypes, favoriteEntityTypes, flowQueueReferenceRoles, flowQueueStatuses, generationAttemptStatuses, priorities, productionMilestoneStatuses, projectStatuses, projectTypes, promptSources, promptStatuses, promptTypes, qcChecklistCategories, qcReviewStatuses, qcReviewTypes, qcSeverities, scriptAiActions, scriptBlockTypes, shotAssetRoles, storyDocumentTypes, videoOutputStatuses } from "./enums";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  projectType: text("project_type", { enum: projectTypes }).notNull(),
  status: text("status", { enum: projectStatuses }).notNull().default("NOT_STARTED"),
  rootPath: text("root_path").notNull(),
  defaultAspectRatio: text("default_aspect_ratio").notNull().default("16:9"),
  defaultLanguage: text("default_language").notNull().default("Indonesian"),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const seasons = sqliteTable("seasons", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  seasonNumber: integer("season_number").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: projectStatuses }).notNull().default("NOT_STARTED"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("seasons_project_code_unique").on(table.projectId, table.code),
  uniqueIndex("seasons_project_number_unique").on(table.projectId, table.seasonNumber),
  uniqueIndex("seasons_id_project_unique").on(table.id, table.projectId),
  index("seasons_project_idx").on(table.projectId),
]);

export const contentItems = sqliteTable("content_items", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  seasonId: text("season_id"),
  code: text("code").notNull(),
  contentNumber: integer("content_number").notNull(),
  title: text("title").notNull(),
  contentType: text("content_type").notNull(),
  description: text("description").notNull().default(""),
  durationTarget: real("duration_target"),
  status: text("status", { enum: projectStatuses }).notNull().default("NOT_STARTED"),
  audioStatus: text("audio_status", { enum: productionMilestoneStatuses }).notNull().default("NOT_STARTED"),
  editStatus: text("edit_status", { enum: productionMilestoneStatuses }).notNull().default("NOT_STARTED"),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  priority: text("priority", { enum: priorities }).notNull().default("NORMAL"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  foreignKey({ columns: [table.seasonId, table.projectId], foreignColumns: [seasons.id, seasons.projectId], name: "content_items_season_project_fk" }).onDelete("restrict"),
  uniqueIndex("content_items_project_code_unique").on(table.projectId, table.code),
  uniqueIndex("content_items_project_number_unique").on(table.projectId, table.contentNumber),
  uniqueIndex("content_items_id_project_unique").on(table.id, table.projectId),
  index("content_items_project_idx").on(table.projectId),
  index("content_items_season_idx").on(table.seasonId),
]);

export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  contentItemId: text("content_item_id").notNull(),
  code: text("code").notNull(),
  sceneNumber: integer("scene_number").notNull(),
  title: text("title").notNull(),
  location: text("location").notNull().default(""),
  description: text("description").notNull().default(""),
  durationTarget: real("duration_target"),
  status: text("status", { enum: projectStatuses }).notNull().default("NOT_STARTED"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  foreignKey({ columns: [table.contentItemId, table.projectId], foreignColumns: [contentItems.id, contentItems.projectId], name: "scenes_content_project_fk" }).onDelete("restrict"),
  uniqueIndex("scenes_id_content_unique").on(table.id, table.contentItemId),
  uniqueIndex("scenes_content_code_unique").on(table.contentItemId, table.code),
  index("scenes_project_idx").on(table.projectId),
  index("scenes_content_idx").on(table.contentItemId),
]);

export const shots = sqliteTable("shots", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  contentItemId: text("content_item_id").notNull(),
  sceneId: text("scene_id"),
  shotCode: text("shot_code").notNull(),
  shotNumber: integer("shot_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  durationTarget: real("duration_target"),
  cameraType: text("camera_type").notNull().default(""),
  action: text("action").notNull().default(""),
  dialogue: text("dialogue").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status", { enum: projectStatuses }).notNull().default("NOT_STARTED"),
  priority: text("priority", { enum: priorities }).notNull().default("NORMAL"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  foreignKey({ columns: [table.contentItemId, table.projectId], foreignColumns: [contentItems.id, contentItems.projectId], name: "shots_content_project_fk" }).onDelete("restrict"),
  foreignKey({ columns: [table.sceneId, table.contentItemId], foreignColumns: [scenes.id, scenes.contentItemId], name: "shots_scene_content_fk" }).onDelete("restrict"),
  uniqueIndex("shots_content_code_unique").on(table.contentItemId, table.shotCode),
  uniqueIndex("shots_content_number_unique").on(table.contentItemId, table.shotNumber),
  index("shots_project_idx").on(table.projectId),
  index("shots_content_idx").on(table.contentItemId),
  index("shots_scene_idx").on(table.sceneId),
  index("shots_code_idx").on(table.shotCode),
  uniqueIndex("shots_id_project_unique").on(table.id, table.projectId),
]);

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  assetCode: text("asset_code").notNull(),
  assetType: text("asset_type", { enum: assetTypes }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: projectStatuses }).notNull().default("NOT_STARTED"),
  isShared: integer("is_shared", { mode: "boolean" }).notNull().default(false),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("assets_project_code_unique").on(table.projectId, table.assetCode),
  uniqueIndex("assets_id_project_unique").on(table.id, table.projectId),
  index("assets_project_idx").on(table.projectId),
  index("assets_type_idx").on(table.assetType),
]);

export const assetVersions = sqliteTable("asset_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  assetId: text("asset_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  versionLabel: text("version_label").notNull(),
  filename: text("filename").notNull(),
  relativePath: text("relative_path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  durationSeconds: real("duration_seconds"),
  sha256: text("sha256").notNull(),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  notes: text("notes").notNull().default(""),
}, (table) => [
  foreignKey({ columns: [table.assetId, table.projectId], foreignColumns: [assets.id, assets.projectId], name: "asset_versions_asset_project_fk" }).onDelete("restrict"),
  uniqueIndex("asset_versions_asset_number_unique").on(table.assetId, table.versionNumber),
  uniqueIndex("asset_versions_project_current_path_unique").on(table.projectId, table.relativePath).where(sql`${table.isCurrent} = 1`),
  index("asset_versions_project_idx").on(table.projectId),
  index("asset_versions_asset_idx").on(table.assetId),
  index("asset_versions_sha_idx").on(table.sha256),
]);

export const shotAssets = sqliteTable("shot_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  shotId: text("shot_id").notNull(),
  assetId: text("asset_id").notNull(),
  role: text("role", { enum: shotAssetRoles }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes").notNull().default(""),
}, (table) => [
  foreignKey({ columns: [table.shotId, table.projectId], foreignColumns: [shots.id, shots.projectId], name: "shot_assets_shot_project_fk" }).onDelete("restrict"),
  foreignKey({ columns: [table.assetId, table.projectId], foreignColumns: [assets.id, assets.projectId], name: "shot_assets_asset_project_fk" }).onDelete("restrict"),
  uniqueIndex("shot_assets_shot_asset_role_unique").on(table.shotId, table.assetId, table.role),
  index("shot_assets_project_idx").on(table.projectId),
  index("shot_assets_shot_idx").on(table.shotId),
  index("shot_assets_asset_idx").on(table.assetId),
]);

export const assetRelationships = sqliteTable("asset_relationships", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  sourceAssetId: text("source_asset_id").notNull(),
  targetAssetId: text("target_asset_id").notNull(),
  relationshipType: text("relationship_type", { enum: assetRelationshipTypes }).notNull(),
  notes: text("notes").notNull().default(""),
}, (table) => [
  foreignKey({ columns: [table.sourceAssetId, table.projectId], foreignColumns: [assets.id, assets.projectId], name: "asset_relationships_source_project_fk" }).onDelete("restrict"),
  foreignKey({ columns: [table.targetAssetId, table.projectId], foreignColumns: [assets.id, assets.projectId], name: "asset_relationships_target_project_fk" }).onDelete("restrict"),
  uniqueIndex("asset_relationships_unique").on(table.sourceAssetId, table.targetAssetId, table.relationshipType),
  index("asset_relationships_project_idx").on(table.projectId),
  index("asset_relationships_source_idx").on(table.sourceAssetId),
  index("asset_relationships_target_idx").on(table.targetAssetId),
]);

export const scannerIgnores = sqliteTable("scanner_ignores", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  relativePath: text("relative_path").notNull(),
  category: text("category", { enum: ["MISSING", "CHANGED", "DUPLICATE"] }).notNull(),
  ignoredSha256: text("ignored_sha256"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("scanner_ignores_project_path_category_unique").on(table.projectId, table.relativePath, table.category),
  index("scanner_ignores_project_idx").on(table.projectId),
]);

export const aiTasks = sqliteTable("ai_tasks", {
  id: text("id").primaryKey(),
  code: text("code", { enum: aiTaskCodes }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  defaultThinkingLevel: text("default_thinking_level", { enum: aiThinkingLevels }).notNull().default("MEDIUM"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const aiRequests = sqliteTable("ai_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  contentItemId: text("content_item_id").references(() => contentItems.id, { onDelete: "restrict" }),
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "restrict" }),
  shotId: text("shot_id").references(() => shots.id, { onDelete: "restrict" }),
  scriptVersionId: text("script_version_id"),
  scriptSceneId: text("script_scene_id"),
  scriptBlockId: text("script_block_id"),
  actionType: text("action_type"),
  metadataJson: text("metadata_json"),
  taskId: text("task_id").notNull().references(() => aiTasks.id, { onDelete: "restrict" }),
  model: text("model").notNull(),
  thinkingLevel: text("thinking_level", { enum: aiThinkingLevels }).notNull(),
  status: text("status", { enum: aiRequestStatuses }).notNull().default("PENDING"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  estimatedCost: real("estimated_cost"),
  errorMessage: text("error_message"),
  resultJson: text("result_json"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("ai_requests_project_idx").on(table.projectId),
  index("ai_requests_shot_idx").on(table.shotId),
  index("ai_requests_task_idx").on(table.taskId),
  index("ai_requests_created_at_idx").on(table.createdAt),
]);

export const storyDocuments = sqliteTable("story_documents", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  contentItemId: text("content_item_id").references(() => contentItems.id, { onDelete: "restrict" }),
  docType: text("doc_type", { enum: storyDocumentTypes }).notNull(),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("story_docs_project_idx").on(table.projectId),
  index("story_docs_content_idx").on(table.contentItemId),
]);

export const storyDocumentVersions = sqliteTable("story_document_versions", {
  id: text("id").primaryKey(),
  storyDocumentId: text("story_document_id").notNull().references(() => storyDocuments.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("story_doc_versions_doc_idx").on(table.storyDocumentId),
  uniqueIndex("story_doc_version_unique").on(table.storyDocumentId, table.versionNumber),
]);

export const scriptDocuments = sqliteTable("script_documents", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  contentItemId: text("content_item_id").notNull().references(() => contentItems.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("script_docs_project_idx").on(table.projectId),
  index("script_docs_content_idx").on(table.contentItemId),
]);

export const scriptVersions = sqliteTable("script_versions", {
  id: text("id").primaryKey(),
  scriptDocumentId: text("script_document_id").notNull().references(() => scriptDocuments.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull(),
  versionLabel: text("version_label").notNull(),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
  snapshotJson: text("snapshot_json"),
  notes: text("notes").notNull().default(""),
  lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("script_versions_doc_idx").on(table.scriptDocumentId),
  uniqueIndex("script_version_doc_num_unique").on(table.scriptDocumentId, table.versionNumber),
]);

export const scriptScenes = sqliteTable("script_scenes", {
  id: text("id").primaryKey(),
  scriptVersionId: text("script_version_id").notNull().references(() => scriptVersions.id, { onDelete: "restrict" }),
  sceneNumber: integer("scene_number").notNull(),
  sceneCode: text("scene_code").notNull(),
  heading: text("heading").notNull(),
  location: text("location").notNull().default(""),
  timeOfDay: text("time_of_day").notNull().default(""),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  linkedSceneId: text("linked_scene_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("script_scenes_version_idx").on(table.scriptVersionId),
  uniqueIndex("script_scenes_version_code_unique").on(table.scriptVersionId, table.sceneCode),
]);

export const scriptBlocks = sqliteTable("script_blocks", {
  id: text("id").primaryKey(),
  scriptSceneId: text("script_scene_id").notNull().references(() => scriptScenes.id, { onDelete: "restrict" }),
  blockType: text("block_type", { enum: scriptBlockTypes }).notNull(),
  character: text("character"),
  content: text("content").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("script_blocks_scene_idx").on(table.scriptSceneId),
]);

export const storyBibles = sqliteTable("story_bibles", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull().default(1),
  versionLabel: text("version_label").notNull().default("V01"),
  premise: text("premise").notNull().default(""),
  worldRules: text("world_rules").notNull().default(""),
  mystery: text("mystery").notNull().default(""),
  themes: text("themes").notNull().default(""),
  storyEngine: text("story_engine").notNull().default(""),
  tone: text("tone").notNull().default(""),
  constraints: text("constraints").notNull().default(""),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("story_bibles_project_idx").on(table.projectId),
]);

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  age: text("age").notNull().default(""),
  role: text("role").notNull().default(""),
  personality: text("personality").notNull().default(""),
  appearance: text("appearance").notNull().default(""),
  costume: text("costume").notNull().default(""),
  signatureProps: text("signature_props").notNull().default("") ,
  storyFunction: text("story_function").notNull().default(""),
  rules: text("rules").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("characters_project_idx").on(table.projectId),
  uniqueIndex("characters_project_name_unique").on(table.projectId, table.name),
]);

export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  visualCharacteristics: text("visual_characteristics").notNull().default(""),
  tone: text("tone").notNull().default(""),
  timeOfDayNotes: text("time_of_day_notes").notNull().default(""),
  rules: text("rules").notNull().default(""),
  referenceAssets: text("reference_assets").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("environments_project_idx").on(table.projectId),
  uniqueIndex("environments_project_name_unique").on(table.projectId, table.name),
]);

export const styleBibles = sqliteTable("style_bibles", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  visualStyle: text("visual_style").notNull().default(""),
  audience: text("audience").notNull().default(""),
  tone: text("tone").notNull().default(""),
  cameraLanguage: text("camera_language").notNull().default(""),
  lighting: text("lighting").notNull().default(""),
  paletteNotes: text("palette_notes").notNull().default(""),
  forbiddenVisuals: text("forbidden_visuals").notNull().default(""),
  continuityRules: text("continuity_rules").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("style_bibles_project_idx").on(table.projectId),
]);

export const promptDocuments = sqliteTable("prompt_documents", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  contentItemId: text("content_item_id").references(() => contentItems.id, { onDelete: "restrict" }),
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "restrict" }),
  shotId: text("shot_id").references(() => shots.id, { onDelete: "restrict" }),
  promptType: text("prompt_type", { enum: promptTypes }).notNull().default("VIDEO"),
  name: text("name").notNull(),
  status: text("status", { enum: promptStatuses }).notNull().default("DRAFT"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("prompt_docs_project_idx").on(table.projectId),
  index("prompt_docs_shot_idx").on(table.shotId),
  index("prompt_docs_content_idx").on(table.contentItemId),
]);

export const promptVersions = sqliteTable("prompt_versions", {
  id: text("id").primaryKey(),
  promptDocumentId: text("prompt_document_id").notNull().references(() => promptDocuments.id, { onDelete: "restrict" }),
  versionNumber: integer("version_number").notNull(),
  versionLabel: text("version_label").notNull(),
  promptText: text("prompt_text").notNull(),
  negativePrompt: text("negative_prompt"),
  parametersJson: text("parameters_json"),
  source: text("source", { enum: promptSources }).notNull().default("MANUAL"),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  localFilePath: text("local_file_path"),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("prompt_versions_doc_idx").on(table.promptDocumentId),
  uniqueIndex("prompt_versions_doc_num_unique").on(table.promptDocumentId, table.versionNumber),
]);

export const promptTemplates = sqliteTable("prompt_templates", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  category: text("category").notNull(), // 'ANIMATION' | 'UGC'
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  promptType: text("prompt_type", { enum: promptTypes }).notNull().default("VIDEO"),
  templateText: text("template_text").notNull(),
  negativePrompt: text("negative_prompt").default(""),
  defaultParametersJson: text("default_parameters_json"),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const flowQueueItems = sqliteTable("flow_queue_items", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  contentItemId: text("content_item_id").references(() => contentItems.id, { onDelete: "restrict" }),
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "restrict" }),
  shotId: text("shot_id").notNull().references(() => shots.id, { onDelete: "restrict" }),
  promptVersionId: text("prompt_version_id").notNull().references(() => promptVersions.id, { onDelete: "restrict" }),
  status: text("status", { enum: flowQueueStatuses }).notNull().default("QUEUED"),
  engine: text("engine").notNull().default("VEO"),
  model: text("model").notNull().default("Veo 3.1 Fast"),
  durationSeconds: real("duration_seconds").notNull().default(5),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  resolution: text("resolution").notNull().default("1080p"),
  audioEnabled: integer("audio_enabled", { mode: "boolean" }).notNull().default(false),
  startFrameAssetVersionId: text("start_frame_asset_version_id").references(() => assetVersions.id, { onDelete: "restrict" }),
  endFrameAssetVersionId: text("end_frame_asset_version_id").references(() => assetVersions.id, { onDelete: "restrict" }),
  recipeSnapshotJson: text("recipe_snapshot_json").notNull().default("{}"),
  notes: text("notes").notNull().default(""),
  estimatedCredits: real("estimated_credits"),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("flow_queue_project_idx").on(table.projectId),
  index("flow_queue_shot_idx").on(table.shotId),
  index("flow_queue_prompt_ver_idx").on(table.promptVersionId),
  index("flow_queue_status_idx").on(table.status),
]);

export const flowQueueReferences = sqliteTable("flow_queue_references", {
  id: text("id").primaryKey(),
  flowQueueItemId: text("flow_queue_item_id").notNull().references(() => flowQueueItems.id, { onDelete: "cascade" }),
  assetVersionId: text("asset_version_id").notNull().references(() => assetVersions.id, { onDelete: "restrict" }),
  role: text("role", { enum: flowQueueReferenceRoles }).notNull().default("OTHER"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("flow_queue_ref_item_idx").on(table.flowQueueItemId),
  index("flow_queue_ref_asset_idx").on(table.assetVersionId),
]);

export const generationAttempts = sqliteTable("generation_attempts", {
  id: text("id").primaryKey(),
  flowQueueItemId: text("flow_queue_item_id").notNull().references(() => flowQueueItems.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  model: text("model").notNull(),
  promptVersionId: text("prompt_version_id").notNull().references(() => promptVersions.id, { onDelete: "restrict" }),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: generationAttemptStatuses }).notNull().default("STARTED"),
  outputVideoId: text("output_video_id"),
  failureReason: text("failure_reason"),
  notes: text("notes"),
}, (table) => [
  index("gen_attempts_item_idx").on(table.flowQueueItemId),
  index("gen_attempts_prompt_idx").on(table.promptVersionId),
]);

export const videoOutputs = sqliteTable("video_outputs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  contentItemId: text("content_item_id").notNull().references(() => contentItems.id, { onDelete: "restrict" }),
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "restrict" }),
  shotId: text("shot_id").notNull().references(() => shots.id, { onDelete: "restrict" }),
  flowQueueItemId: text("flow_queue_item_id").references(() => flowQueueItems.id, { onDelete: "set null" }),
  generationAttemptId: text("generation_attempt_id").references(() => generationAttempts.id, { onDelete: "set null" }),
  versionNumber: integer("version_number").notNull(),
  versionLabel: text("version_label").notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  durationSeconds: real("duration_seconds"),
  resolution: text("resolution"),
  mimeType: text("mime_type").notNull().default("video/mp4"),
  sha256: text("sha256").notNull(),
  model: text("model"),
  status: text("status", { enum: videoOutputStatuses }).notNull().default("APPROVED"),
  notes: text("notes").notNull().default(""),
  creditsUsed: real("credits_used"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("video_outputs_project_idx").on(table.projectId),
  index("video_outputs_shot_idx").on(table.shotId),
  index("video_outputs_queue_idx").on(table.flowQueueItemId),
  uniqueIndex("video_outputs_shot_version_unique").on(table.shotId, table.versionNumber),
]);

export const qcReviews = sqliteTable("qc_reviews", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contentItemId: text("content_item_id").references(() => contentItems.id, { onDelete: "set null" }),
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "set null" }),
  shotId: text("shot_id").references(() => shots.id, { onDelete: "set null" }),
  assetVersionId: text("asset_version_id").references(() => assetVersions.id, { onDelete: "set null" }),
  videoOutputId: text("video_output_id").references(() => videoOutputs.id, { onDelete: "set null" }),
  reviewType: text("review_type", { enum: qcReviewTypes }).notNull().default("VISUAL"),
  status: text("status", { enum: qcReviewStatuses }).notNull().default("OPEN"),
  severity: text("severity", { enum: qcSeverities }).notNull().default("MINOR"),
  issue: text("issue").notNull(),
  action: text("action").notNull().default(""),
  reviewer: text("reviewer").notNull().default("User"),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
}, (table) => [
  index("qc_reviews_project_idx").on(table.projectId),
  index("qc_reviews_content_idx").on(table.contentItemId),
  index("qc_reviews_shot_idx").on(table.shotId),
  index("qc_reviews_status_idx").on(table.status),
  index("qc_reviews_severity_idx").on(table.severity),
]);

export const continuityRules = sqliteTable("continuity_rules", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  ruleType: text("rule_type", { enum: continuityRuleTypes }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  severity: text("severity", { enum: qcSeverities }).notNull().default("MAJOR"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("continuity_rules_project_idx").on(table.projectId),
  index("continuity_rules_type_idx").on(table.ruleType),
]);

export const continuityChecks = sqliteTable("continuity_checks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contentItemId: text("content_item_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  sceneId: text("scene_id").references(() => scenes.id, { onDelete: "set null" }),
  shotId: text("shot_id").notNull().references(() => shots.id, { onDelete: "cascade" }),
  referenceShotId: text("reference_shot_id").notNull().references(() => shots.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull().references(() => continuityRules.id, { onDelete: "restrict" }),
  status: text("status", { enum: continuityCheckStatuses }).notNull().default("OPEN"),
  severity: text("severity", { enum: qcSeverities }).notNull().default("MAJOR"),
  finding: text("finding").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("continuity_checks_project_idx").on(table.projectId),
  index("continuity_checks_content_idx").on(table.contentItemId),
  index("continuity_checks_shot_idx").on(table.shotId),
  index("continuity_checks_status_idx").on(table.status),
]);

export const qcChecklistItems = sqliteTable("qc_checklist_items", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  category: text("category", { enum: qcChecklistCategories }).notNull().default("VISUAL"),
  code: text("code").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  defaultSeverity: text("default_severity", { enum: qcSeverities }).notNull().default("MINOR"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("qc_checklist_project_idx").on(table.projectId),
  index("qc_checklist_category_idx").on(table.category),
]);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type AiTask = typeof aiTasks.$inferSelect;
export type AiRequest = typeof aiRequests.$inferSelect;
export type StoryDocument = typeof storyDocuments.$inferSelect;
export type StoryDocumentVersion = typeof storyDocumentVersions.$inferSelect;
export type ScriptDocument = typeof scriptDocuments.$inferSelect;
export type ScriptVersion = typeof scriptVersions.$inferSelect;
export type ScriptScene = typeof scriptScenes.$inferSelect;
export type ScriptBlock = typeof scriptBlocks.$inferSelect;
export type StoryBible = typeof storyBibles.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Environment = typeof environments.$inferSelect;
export type StyleBible = typeof styleBibles.$inferSelect;
export type PromptDocument = typeof promptDocuments.$inferSelect;
export type PromptVersion = typeof promptVersions.$inferSelect;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type FlowQueueItem = typeof flowQueueItems.$inferSelect;
export type FlowQueueReference = typeof flowQueueReferences.$inferSelect;
export type GenerationAttempt = typeof generationAttempts.$inferSelect;
export type VideoOutput = typeof videoOutputs.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type AssetVersion = typeof assetVersions.$inferSelect;
export type Shot = typeof shots.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type Scene = typeof scenes.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type VideoOutputStatus = typeof videoOutputStatuses[number];

export type QcReview = typeof qcReviews.$inferSelect;
export type NewQcReview = typeof qcReviews.$inferInsert;
export type ContinuityRule = typeof continuityRules.$inferSelect;
export type NewContinuityRule = typeof continuityRules.$inferInsert;
export type ContinuityCheck = typeof continuityChecks.$inferSelect;
export type NewContinuityCheck = typeof continuityChecks.$inferInsert;
export type QcChecklistItem = typeof qcChecklistItems.$inferSelect;
export type NewQcChecklistItem = typeof qcChecklistItems.$inferInsert;

export type QcReviewType = typeof qcReviewTypes[number];
export type QcReviewStatus = typeof qcReviewStatuses[number];
export type QcSeverity = typeof qcSeverities[number];
export type ContinuityRuleType = typeof continuityRuleTypes[number];
export type ContinuityCheckStatus = typeof continuityCheckStatuses[number];
export type ProductionMilestoneStatus = typeof productionMilestoneStatuses[number];
export type QcChecklistCategory = typeof qcChecklistCategories[number];

export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  actionType: text("action_type", { enum: activityActionTypes }).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  metadataJson: text("metadata_json"),
  actor: text("actor").notNull().default("User"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("activity_logs_project_idx").on(table.projectId),
  index("activity_logs_created_idx").on(table.createdAt),
  index("activity_logs_action_idx").on(table.actionType),
]);

export const favorites = sqliteTable("favorites", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  entityType: text("entity_type", { enum: favoriteEntityTypes }).notNull(),
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("favorites_project_idx").on(table.projectId),
  uniqueIndex("favorites_project_entity_unique").on(table.projectId, table.entityType, table.entityId),
]);

export const systemSettings = sqliteTable("system_settings", {
  id: text("id").primaryKey(),
  language: text("language").notNull().default("Indonesian"),
  theme: text("theme").notNull().default("system"),
  defaultProjectId: text("default_project_id"),
  defaultAspectRatio: text("default_aspect_ratio").notNull().default("16:9"),
  backupRootPath: text("backup_root_path").notNull().default(""),
  backupRetentionCount: integer("backup_retention_count").notNull().default(5),
  ignoredDirectoriesJson: text("ignored_directories_json").notNull().default("[]"),
  autoScanOnLoad: integer("auto_scan_on_load", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const backups = sqliteTable("backups", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  backupType: text("backup_type", { enum: backupTypes }).notNull(),
  status: text("status", { enum: backupStatuses }).notNull().default("COMPLETED"),
  backupPath: text("backup_path").notNull(),
  filename: text("filename").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull().default(0),
  fileCount: integer("file_count").notNull().default(0),
  manifestJson: text("manifest_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("backups_project_idx").on(table.projectId),
  index("backups_created_idx").on(table.createdAt),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
export type BackupRecord = typeof backups.$inferSelect;
export type NewBackupRecord = typeof backups.$inferInsert;

export type ActivityActionType = typeof activityActionTypes[number];
export type FavoriteEntityType = typeof favoriteEntityTypes[number];
export type BackupType = typeof backupTypes[number];
export type BackupStatus = typeof backupStatuses[number];



