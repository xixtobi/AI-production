import "server-only";

import { eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { logActivity } from "@/lib/activity/activity-service";

export const APP_VERSION = "1.0.0";

export interface SystemSettingsPayload {
  language?: string;
  theme?: string;
  defaultProjectId?: string | null;
  defaultAspectRatio?: string;
  backupRootPath?: string;
  backupRetentionCount?: number;
  ignoredDirectoriesJson?: string;
  autoScanOnLoad?: boolean;
}

export function getSystemSettings(): schema.SystemSetting & { appVersion: string } {
  ensureDatabaseReady();
  let settings = db.select().from(schema.systemSettings).where(eq(schema.systemSettings.id, "default")).get();

  if (!settings) {
    const now = new Date();
    db.insert(schema.systemSettings).values({
      id: "default",
      language: "Indonesian",
      theme: "system",
      defaultProjectId: null,
      defaultAspectRatio: "16:9",
      backupRootPath: "",
      backupRetentionCount: 5,
      ignoredDirectoriesJson: JSON.stringify([".git", "node_modules", ".local-production-control", ".archive"]),
      autoScanOnLoad: false,
      updatedAt: now,
    }).run();

    settings = db.select().from(schema.systemSettings).where(eq(schema.systemSettings.id, "default")).get()!;
  }

  return {
    ...settings,
    appVersion: APP_VERSION,
  };
}

export function updateSystemSettings(payload: SystemSettingsPayload): schema.SystemSetting & { appVersion: string } {
  ensureDatabaseReady();
  const current = getSystemSettings();
  const now = new Date();

  const updates: Partial<typeof schema.systemSettings.$inferInsert> = {
    updatedAt: now,
  };

  if (payload.language !== undefined) updates.language = payload.language;
  if (payload.theme !== undefined) updates.theme = payload.theme;
  if (payload.defaultProjectId !== undefined) updates.defaultProjectId = payload.defaultProjectId;
  if (payload.defaultAspectRatio !== undefined) updates.defaultAspectRatio = payload.defaultAspectRatio;
  if (payload.backupRootPath !== undefined) updates.backupRootPath = payload.backupRootPath;
  if (payload.backupRetentionCount !== undefined) updates.backupRetentionCount = payload.backupRetentionCount;
  if (payload.ignoredDirectoriesJson !== undefined) updates.ignoredDirectoriesJson = payload.ignoredDirectoriesJson;
  if (payload.autoScanOnLoad !== undefined) updates.autoScanOnLoad = payload.autoScanOnLoad;

  db.update(schema.systemSettings)
    .set(updates)
    .where(eq(schema.systemSettings.id, "default"))
    .run();

  logActivity({
    actionType: "SETTINGS_UPDATE",
    entityType: "SYSTEM",
    title: "Pengaturan sistem diperbarui",
    description: `Pengaturan aplikasi diperbarui oleh pengguna`,
    metadata: { ...payload },
  });

  return getSystemSettings();
}
