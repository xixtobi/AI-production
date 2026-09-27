import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export interface LogActivityParams {
  projectId?: string | null;
  actionType: schema.ActivityActionType;
  entityType: string;
  entityId?: string | null;
  title: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  actor?: string;
}

export interface ListActivitiesParams {
  projectId?: string;
  limit?: number;
  actionType?: schema.ActivityActionType;
}

/**
 * Sanitizes metadata to ensure no API keys or sensitive values are recorded.
 */
function sanitizeMetadata(data?: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    const lk = key.toLowerCase();
    if (lk.includes("key") || lk.includes("secret") || lk.includes("token") || lk.includes("password")) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = val;
    }
  }
  return JSON.stringify(sanitized);
}

export function logActivity(params: LogActivityParams): schema.ActivityLog {
  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.activityLogs)
    .values({
      id,
      projectId: params.projectId || null,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId || null,
      title: params.title.trim(),
      description: (params.description || "").trim(),
      metadataJson: sanitizeMetadata(params.metadata),
      actor: params.actor || "User",
      createdAt: now,
    })
    .run();

  const created = db
    .select()
    .from(schema.activityLogs)
    .where(eq(schema.activityLogs.id, id))
    .get();

  return created!;
}

export function listActivities(params: ListActivitiesParams = {}): schema.ActivityLog[] {
  const limit = params.limit ?? 100;
  const query = db.select().from(schema.activityLogs);

  if (params.projectId && params.actionType) {
    return db
      .select()
      .from(schema.activityLogs)
      .where(and(eq(schema.activityLogs.projectId, params.projectId), eq(schema.activityLogs.actionType, params.actionType)))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit)
      .all();
  } else if (params.projectId) {
    return db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.projectId, params.projectId))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit)
      .all();
  } else if (params.actionType) {
    return db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.actionType, params.actionType))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit)
      .all();
  }

  return query.orderBy(desc(schema.activityLogs.createdAt)).limit(limit).all();
}
