import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import { GEMINI_PRIMARY_MODEL, GEMINI_DEFAULT_THINKING_LEVEL, TASK_DEFAULT_THINKING_LEVELS, type GeminiThinkingLevel } from "./config";
import { sendGeminiRequest, GeminiError } from "./client";
import { buildShotContext, buildShotContextPrompt } from "./context-builder";
import { GeminiJsonSchemas, validateStructuredOutput } from "./schemas";
import { estimateUsageCost } from "./usage-service";

export function resolveTask(taskCodeOrId: string): schema.AiTask {
  const isCode = schema.aiTaskCodes.includes(taskCodeOrId as (typeof schema.aiTaskCodes)[number]);
  const task = isCode
    ? db.select().from(schema.aiTasks).where(eq(schema.aiTasks.code, taskCodeOrId as (typeof schema.aiTaskCodes)[number])).get()
    : db.select().from(schema.aiTasks).where(eq(schema.aiTasks.id, taskCodeOrId)).get();


  if (!task) {
    throw new DomainError(`Tugas AI '${taskCodeOrId}' tidak ditemukan.`);
  }
  return task;
}

export function resolveThinkingLevel(
  task: schema.AiTask,
  preferredLevel?: GeminiThinkingLevel
): GeminiThinkingLevel {
  if (preferredLevel && ["LOW", "MEDIUM", "HIGH"].includes(preferredLevel)) {
    return preferredLevel;
  }
  if (task.defaultThinkingLevel && ["LOW", "MEDIUM", "HIGH"].includes(task.defaultThinkingLevel)) {
    return task.defaultThinkingLevel as GeminiThinkingLevel;
  }
  return TASK_DEFAULT_THINKING_LEVELS[task.code] || GEMINI_DEFAULT_THINKING_LEVEL;
}

export async function executeShotTask(params: {
  projectId: string;
  shotId: string;
  taskCode: string;
  thinkingLevel?: GeminiThinkingLevel;
}): Promise<{
  request: schema.AiRequest;
  result: unknown;
  draftText: string;
}> {
  const task = resolveTask(params.taskCode);
  const thinkingLevel = resolveThinkingLevel(task, params.thinkingLevel);
  const shotContext = buildShotContext(params.projectId, params.shotId);
  const prompt = buildShotContextPrompt(shotContext, task.name);

  const requestId = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.aiRequests)
    .values({
      id: requestId,
      projectId: params.projectId,
      contentItemId: shotContext.shot.contentItemId,
      sceneId: shotContext.shot.sceneId,
      shotId: params.shotId,
      taskId: task.id,
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      status: "RUNNING",
      startedAt: now,
      createdAt: now,
    })
    .run();

  const isStructured = Boolean(GeminiJsonSchemas[task.code]);
  const systemInstruction = `Anda adalah asisten AI produksi video dan animasi profesional.
Jawab dengan Bahasa Indonesia yang jelas, profesional, dan ringkas.
Untuk nilai prompt visual (seperti positivePrompt, negativePrompt, camera/art style), gunakan bahasa Inggris deskriptif berkualitas tinggi yang lazim digunakan pada prompt video/image AI.
Jangan mengubah format atau memotong respon.`;

  try {
    const response = await sendGeminiRequest({
      prompt,
      systemInstruction,
      model: GEMINI_PRIMARY_MODEL,
      thinkingLevel,
      responseMimeType: isStructured ? "application/json" : undefined,
      responseSchema: isStructured ? GeminiJsonSchemas[task.code] : undefined,
    });

    const completedAt = new Date();
    const cost = estimateUsageCost(GEMINI_PRIMARY_MODEL, response.inputTokens, response.outputTokens);

    let parsedResult: unknown = response.text;
    if (isStructured) {
      const validation = validateStructuredOutput(task.code, response.text);
      if (!validation.success) {
        db.update(schema.aiRequests)
          .set({
            status: "FAILED",
            errorMessage: validation.error,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            estimatedCost: cost,
            completedAt,
          })
          .where(eq(schema.aiRequests.id, requestId))
          .run();

        throw new GeminiError("STRUCTURED_OUTPUT_FAILURE", validation.error);
      }
      parsedResult = validation.data;
    }

    db.update(schema.aiRequests)
      .set({
        status: "SUCCEEDED",
        resultJson: response.text,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        estimatedCost: cost,
        completedAt,
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();

    const updatedRequest = db.select().from(schema.aiRequests).where(eq(schema.aiRequests.id, requestId)).get()!;

    return {
      request: updatedRequest,
      result: parsedResult,
      draftText: response.text,
    };
  } catch (err) {
    const errorObj = err instanceof GeminiError ? err : new GeminiError("UNKNOWN_ERROR", (err as Error).message);
    const completedAt = new Date();

    db.update(schema.aiRequests)
      .set({
        status: "FAILED",
        errorMessage: errorObj.message,
        completedAt,
      })
      .where(eq(schema.aiRequests.id, requestId))
      .run();

    throw errorObj;
  }
}

export async function acceptShotTaskResult(params: {
  requestId: string;
  editedContent?: string;
}): Promise<{
  success: boolean;
  message: string;
  shot: typeof schema.shots.$inferSelect;
}> {
  const request = db.select().from(schema.aiRequests).where(eq(schema.aiRequests.id, params.requestId)).get();
  if (!request) {
    throw new DomainError("Permintaan AI tidak ditemukan.");
  }
  if (!request.shotId) {
    throw new DomainError("Permintaan AI tidak terhubung ke shot produksi.");
  }

  const task = db.select().from(schema.aiTasks).where(eq(schema.aiTasks.id, request.taskId)).get();
  if (!task) {
    throw new DomainError("Tugas AI tidak ditemukan.");
  }

  const shot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.id, request.shotId), eq(schema.shots.projectId, request.projectId)))
    .get();

  if (!shot) {
    throw new DomainError("Shot target tidak ditemukan.");
  }

  const contentToApply = (params.editedContent ?? request.resultJson ?? "").trim();
  if (!contentToApply) {
    throw new DomainError("Tidak ada draf AI untuk disetujui.");
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    const raw = JSON.parse(contentToApply);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      parsed = raw as Record<string, unknown>;
    }
  } catch {
    parsed = null;
  }


  const shotUpdate: Partial<typeof schema.shots.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (task.code === "PROMPT_GENERATION") {
    if (parsed && typeof parsed === "object") {
      const promptLines = [
        `[POSITIVE PROMPT]: ${String(parsed.positivePrompt || "")}`,
        `[NEGATIVE PROMPT]: ${String(parsed.negativePrompt || "")}`,
        `[ART STYLE]: ${String(parsed.artStyle || "")}`,
        `[CAMERA]: ${String(parsed.cameraAndComposition || "")}`,
        `[LIGHTING]: ${String(parsed.lighting || "")}`,
        `[MOTION]: ${String(parsed.motionDescription || "")}`,
        parsed.notes ? `[CATATAN AI]: ${String(parsed.notes)}` : "",
      ].filter(Boolean);

      shotUpdate.notes = promptLines.join("\n\n");
      if (parsed.cameraAndComposition && !shot.cameraType) {
        shotUpdate.cameraType = String(parsed.cameraAndComposition).slice(0, 50);
      }
    } else {
      shotUpdate.notes = contentToApply;
    }
  } else if (task.code === "SHOT_BREAKDOWN") {
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.visualDescription === "string") shotUpdate.action = parsed.visualDescription;
      if (typeof parsed.cameraWork === "string") shotUpdate.cameraType = parsed.cameraWork.slice(0, 100);
      if (typeof parsed.audioAndDialogue === "string") shotUpdate.dialogue = parsed.audioAndDialogue;
      if (typeof parsed.estimatedDurationSeconds === "number") shotUpdate.durationTarget = parsed.estimatedDurationSeconds;
      if (parsed.summary || parsed.productionNotes) {
        const notes = [
          parsed.summary ? `Ringkasan: ${String(parsed.summary)}` : "",
          Array.isArray(parsed.productionNotes) ? `Catatan: ${parsed.productionNotes.map(String).join("; ")}` : "",
        ].filter(Boolean).join("\n");
        shotUpdate.notes = notes;
      }
    } else {
      shotUpdate.notes = contentToApply;
    }
  } else if (task.code === "DIALOGUE_POLISH") {
    if (parsed && typeof parsed === "object" && typeof parsed.polishedDialogue === "string") {
      shotUpdate.dialogue = parsed.polishedDialogue;
      if (parsed.deliveryNotes) {
        shotUpdate.notes = shot.notes
          ? `${shot.notes}\n\n[Delivery Notes]: ${String(parsed.deliveryNotes)}`
          : `[Delivery Notes]: ${String(parsed.deliveryNotes)}`;
      }
    } else {
      shotUpdate.dialogue = contentToApply;
    }
  } else if (task.code === "CONTINUITY_CHECK" || task.code === "PRODUCTION_REVIEW") {

    const header = task.code === "CONTINUITY_CHECK" ? "[TINJAUAN KONTINUITAS]" : "[TINJAUAN PRODUKSI]";
    shotUpdate.notes = shot.notes
      ? `${shot.notes}\n\n${header}\n${contentToApply}`
      : `${header}\n${contentToApply}`;
  } else {
    shotUpdate.notes = shot.notes
      ? `${shot.notes}\n\n[DRAF AI - ${task.name}]:\n${contentToApply}`
      : `[DRAF AI - ${task.name}]:\n${contentToApply}`;
  }

  db.update(schema.shots).set(shotUpdate).where(eq(schema.shots.id, shot.id)).run();

  db.update(schema.aiRequests)
    .set({
      status: "ACCEPTED",
      resultJson: contentToApply,
    })
    .where(eq(schema.aiRequests.id, request.id))
    .run();

  const updatedShot = db.select().from(schema.shots).where(eq(schema.shots.id, shot.id)).get()!;

  return {
    success: true,
    message: "Hasil AI berhasil disetujui dan diterapkan pada record produksi shot.",
    shot: updatedShot,
  };
}

export async function rejectShotTaskResult(params: {
  requestId: string;
}): Promise<{ success: boolean; message: string }> {
  const request = db.select().from(schema.aiRequests).where(eq(schema.aiRequests.id, params.requestId)).get();
  if (!request) {
    throw new DomainError("Permintaan AI tidak ditemukan.");
  }

  db.update(schema.aiRequests)
    .set({
      status: "REJECTED",
    })
    .where(eq(schema.aiRequests.id, request.id))
    .run();

  return {
    success: true,
    message: "Draf AI ditolak. Data produksi tetap tidak berubah.",
  };
}

export function listAiTasks(): schema.AiTask[] {
  return db.select().from(schema.aiTasks).where(eq(schema.aiTasks.enabled, true)).all();
}

export function listAiHistory(filter?: {
  projectId?: string;
  shotId?: string;
  limit?: number;
}) {
  const limitCount = filter?.limit ?? 50;

  const baseQuery = db
    .select({
      request: schema.aiRequests,
      task: schema.aiTasks,
      project: schema.projects,
      content: schema.contentItems,
      shot: schema.shots,
    })
    .from(schema.aiRequests)
    .innerJoin(schema.aiTasks, eq(schema.aiRequests.taskId, schema.aiTasks.id))
    .innerJoin(schema.projects, eq(schema.aiRequests.projectId, schema.projects.id))
    .leftJoin(schema.contentItems, eq(schema.aiRequests.contentItemId, schema.contentItems.id))
    .leftJoin(schema.shots, eq(schema.aiRequests.shotId, schema.shots.id))
    .orderBy(desc(schema.aiRequests.createdAt))
    .limit(limitCount);

  if (filter?.projectId && filter?.shotId) {
    return baseQuery
      .where(and(eq(schema.aiRequests.projectId, filter.projectId), eq(schema.aiRequests.shotId, filter.shotId)))
      .all();
  }

  if (filter?.projectId) {
    return baseQuery.where(eq(schema.aiRequests.projectId, filter.projectId)).all();
  }

  if (filter?.shotId) {
    return baseQuery.where(eq(schema.aiRequests.shotId, filter.shotId)).all();
  }

  return baseQuery.all();
}
