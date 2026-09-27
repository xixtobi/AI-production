import "server-only";

import { eq, or, like, sql } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export type SearchResultType =
  | "PROJECT"
  | "CONTENT"
  | "SCENE"
  | "SHOT"
  | "ASSET"
  | "PROMPT"
  | "VIDEO"
  | "QC";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  code?: string;
  projectId?: string;
  projectName?: string;
  url: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  query: string;
  projectId?: string;
  limit?: number;
}

export function searchProduction(options: SearchOptions): SearchResultItem[] {
  ensureDatabaseReady();

  const rawQuery = options.query?.trim();
  if (!rawQuery) return [];

  const queryUpper = rawQuery.toUpperCase();
  const likePattern = `%${rawQuery}%`;
  const limit = options.limit || 50;

  const results: SearchResultItem[] = [];

  // Helper for scoring matches
  function calculateScore(targetText: string | null | undefined, isCode = false): number {
    if (!targetText) return 0;
    const upper = targetText.toUpperCase();
    if (upper === queryUpper) return isCode ? 100 : 90;
    if (upper.startsWith(queryUpper)) return isCode ? 80 : 70;
    if (upper.includes(queryUpper)) return isCode ? 60 : 50;
    return 0;
  }

  // Pre-fetch projects map for display names
  const allProjects = db.select().from(schema.projects).all();
  const projectMap = new Map<string, schema.Project>(allProjects.map((p) => [p.id, p]));

  // 1. Projects (if no projectId filter)
  if (!options.projectId) {
    const projects = db
      .select()
      .from(schema.projects)
      .where(
        or(
          like(schema.projects.code, likePattern),
          like(schema.projects.name, likePattern),
          like(schema.projects.description, likePattern)
        )
      )
      .limit(10)
      .all();

    for (const p of projects) {
      const codeScore = calculateScore(p.code, true);
      const nameScore = calculateScore(p.name, false);
      const score = Math.max(codeScore, nameScore, 30);
      results.push({
        id: p.id,
        type: "PROJECT",
        title: p.name,
        subtitle: `Proyek [${p.code}] - ${p.projectType}`,
        code: p.code,
        projectId: p.id,
        projectName: p.name,
        url: `/projects/${p.id}`,
        score,
        metadata: { rootPath: p.rootPath },
      });
    }
  }

  // 2. Content Items
  const contentCond = options.projectId
    ? sql`${schema.contentItems.projectId} = ${options.projectId} AND (${schema.contentItems.code} LIKE ${likePattern} OR ${schema.contentItems.title} LIKE ${likePattern})`
    : sql`${schema.contentItems.code} LIKE ${likePattern} OR ${schema.contentItems.title} LIKE ${likePattern}`;

  const contents = db
    .select()
    .from(schema.contentItems)
    .where(contentCond)
    .limit(15)
    .all();

  for (const c of contents) {
    const proj = projectMap.get(c.projectId);
    const codeScore = calculateScore(c.code, true);
    const titleScore = calculateScore(c.title, false);
    results.push({
      id: c.id,
      type: "CONTENT",
      title: c.title,
      subtitle: `Konten [${c.code}] (${c.contentType}) - ${proj?.name || "Proyek"}`,
      code: c.code,
      projectId: c.projectId,
      projectName: proj?.name,
      url: `/projects/${c.projectId}?tab=content&contentId=${c.id}`,
      score: Math.max(codeScore, titleScore, 40),
    });
  }

  // 3. Scenes
  const sceneCond = options.projectId
    ? sql`${schema.scenes.projectId} = ${options.projectId} AND (${schema.scenes.title} LIKE ${likePattern} OR ${schema.scenes.description} LIKE ${likePattern} OR ${schema.scenes.code} LIKE ${likePattern})`
    : sql`${schema.scenes.title} LIKE ${likePattern} OR ${schema.scenes.description} LIKE ${likePattern} OR ${schema.scenes.code} LIKE ${likePattern}`;

  const scenes = db
    .select()
    .from(schema.scenes)
    .where(sceneCond)
    .limit(15)
    .all();

  for (const s of scenes) {
    const proj = projectMap.get(s.projectId);
    const titleScore = calculateScore(s.title, false);
    results.push({
      id: s.id,
      type: "SCENE",
      title: s.title || `Scene ${s.sceneNumber}`,
      subtitle: `Scene #${s.sceneNumber} [${s.code}] - ${proj?.name || "Proyek"}`,
      code: s.code,
      projectId: s.projectId,
      projectName: proj?.name,
      url: `/projects/${s.projectId}?tab=scenes&sceneId=${s.id}`,
      score: Math.max(titleScore, 35),
    });
  }

  // 4. Shots
  const shotCond = options.projectId
    ? sql`${schema.shots.projectId} = ${options.projectId} AND (${schema.shots.shotCode} LIKE ${likePattern} OR ${schema.shots.title} LIKE ${likePattern} OR ${schema.shots.dialogue} LIKE ${likePattern} OR ${schema.shots.action} LIKE ${likePattern})`
    : sql`${schema.shots.shotCode} LIKE ${likePattern} OR ${schema.shots.title} LIKE ${likePattern} OR ${schema.shots.dialogue} LIKE ${likePattern} OR ${schema.shots.action} LIKE ${likePattern}`;

  const shots = db
    .select()
    .from(schema.shots)
    .where(shotCond)
    .limit(25)
    .all();

  for (const sh of shots) {
    const proj = projectMap.get(sh.projectId);
    const codeScore = calculateScore(sh.shotCode, true);
    const titleScore = calculateScore(sh.title, false);
    const dialogueScore = calculateScore(sh.dialogue, false);
    results.push({
      id: sh.id,
      type: "SHOT",
      title: `${sh.shotCode}: ${sh.title || "Tanpa Judul"}`,
      subtitle: `Shot ${sh.shotCode} (${sh.status}) ${sh.dialogue ? `| "${sh.dialogue.slice(0, 30)}..."` : ""} - ${proj?.name || "Proyek"}`,
      code: sh.shotCode,
      projectId: sh.projectId,
      projectName: proj?.name,
      url: `/projects/${sh.projectId}?tab=shots&shotId=${sh.id}`,
      score: Math.max(codeScore, titleScore, dialogueScore, 30),
      metadata: { shotCode: sh.shotCode, status: sh.status },
    });
  }

  // 5. Assets
  const assetCond = options.projectId
    ? sql`${schema.assets.projectId} = ${options.projectId} AND (${schema.assets.assetCode} LIKE ${likePattern} OR ${schema.assets.name} LIKE ${likePattern})`
    : sql`${schema.assets.assetCode} LIKE ${likePattern} OR ${schema.assets.name} LIKE ${likePattern}`;

  const assets = db
    .select()
    .from(schema.assets)
    .where(assetCond)
    .limit(20)
    .all();

  for (const a of assets) {
    const proj = projectMap.get(a.projectId);
    const codeScore = calculateScore(a.assetCode, true);
    const nameScore = calculateScore(a.name, false);
    results.push({
      id: a.id,
      type: "ASSET",
      title: `${a.assetCode || a.name}`,
      subtitle: `Aset [${a.assetType}] - ${proj?.name || "Proyek"}`,
      code: a.assetCode || undefined,
      projectId: a.projectId,
      projectName: proj?.name,
      url: `/projects/${a.projectId}?tab=assets&assetId=${a.id}`,
      score: Math.max(codeScore, nameScore, 30),
    });
  }

  // Asset Versions (filename and relativePath)
  const versionCond = options.projectId
    ? sql`${schema.assetVersions.projectId} = ${options.projectId} AND (${schema.assetVersions.filename} LIKE ${likePattern} OR ${schema.assetVersions.relativePath} LIKE ${likePattern})`
    : sql`${schema.assetVersions.filename} LIKE ${likePattern} OR ${schema.assetVersions.relativePath} LIKE ${likePattern}`;

  const assetVersions = db
    .select()
    .from(schema.assetVersions)
    .where(versionCond)
    .limit(15)
    .all();

  for (const av of assetVersions) {
    const proj = projectMap.get(av.projectId);
    const score = calculateScore(av.filename, true);
    results.push({
      id: av.id,
      type: "ASSET",
      title: av.filename,
      subtitle: `Berkas Aset (${av.versionLabel}) - ${av.relativePath}`,
      projectId: av.projectId,
      projectName: proj?.name,
      url: `/projects/${av.projectId}?tab=assets&versionId=${av.id}`,
      score: Math.max(score, 35),
      metadata: { relativePath: av.relativePath },
    });
  }

  // 6. Prompts
  const promptCond = options.projectId
    ? sql`${schema.promptDocuments.projectId} = ${options.projectId} AND ${schema.promptDocuments.name} LIKE ${likePattern}`
    : sql`${schema.promptDocuments.name} LIKE ${likePattern}`;

  const prompts = db
    .select()
    .from(schema.promptDocuments)
    .where(promptCond)
    .limit(15)
    .all();

  for (const p of prompts) {
    const proj = projectMap.get(p.projectId);
    const score = calculateScore(p.name, false);
    results.push({
      id: p.id,
      type: "PROMPT",
      title: p.name,
      subtitle: `Prompt [${p.promptType}] (${p.status}) - ${proj?.name || "Proyek"}`,
      projectId: p.projectId,
      projectName: proj?.name,
      url: `/projects/${p.projectId}/prompts?promptId=${p.id}`,
      score: Math.max(score, 30),
    });
  }

  // 7. Video Outputs
  const videoCond = options.projectId
    ? sql`${schema.videoOutputs.projectId} = ${options.projectId} AND (${schema.videoOutputs.filePath} LIKE ${likePattern} OR ${schema.videoOutputs.fileName} LIKE ${likePattern} OR ${schema.videoOutputs.versionLabel} LIKE ${likePattern})`
    : sql`${schema.videoOutputs.filePath} LIKE ${likePattern} OR ${schema.videoOutputs.fileName} LIKE ${likePattern} OR ${schema.videoOutputs.versionLabel} LIKE ${likePattern}`;

  const videos = db
    .select()
    .from(schema.videoOutputs)
    .where(videoCond)
    .limit(10)
    .all();

  for (const v of videos) {
    const proj = projectMap.get(v.projectId);
    const score = calculateScore(v.fileName, true);
    results.push({
      id: v.id,
      type: "VIDEO",
      title: `${v.versionLabel}: ${v.fileName}`,
      subtitle: `Video Output (${v.status}) - ${proj?.name || "Proyek"}`,
      projectId: v.projectId,
      projectName: proj?.name,
      url: `/projects/${v.projectId}/flow?videoOutputId=${v.id}`,
      score: Math.max(score, 30),
      metadata: { filePath: v.filePath },
    });
  }

  // 8. QC Reviews
  const qcCond = options.projectId
    ? sql`${schema.qcReviews.projectId} = ${options.projectId} AND (${schema.qcReviews.issue} LIKE ${likePattern} OR ${schema.qcReviews.action} LIKE ${likePattern})`
    : sql`${schema.qcReviews.issue} LIKE ${likePattern} OR ${schema.qcReviews.action} LIKE ${likePattern}`;

  const qcs = db
    .select()
    .from(schema.qcReviews)
    .where(qcCond)
    .limit(10)
    .all();

  for (const q of qcs) {
    const proj = projectMap.get(q.projectId);
    results.push({
      id: q.id,
      type: "QC",
      title: `QC [${q.severity}]: ${q.issue.slice(0, 45)}...`,
      subtitle: `Tinjauan QC (${q.status}) - ${proj?.name || "Proyek"}`,
      projectId: q.projectId,
      projectName: proj?.name,
      url: `/projects/${q.projectId}/qc?qcId=${q.id}`,
      score: 25,
    });
  }

  // Sort by score descending and truncate to limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
