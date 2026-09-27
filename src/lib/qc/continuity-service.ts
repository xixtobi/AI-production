import "server-only";

import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import type {
  ContinuityCheckFilters,
  CreateContinuityCheckInput,
  CreateContinuityRuleInput,
} from "./types";

export function listContinuityRules(
  projectId?: string,
  enabledOnly = true
): schema.ContinuityRule[] {
  const allRules = projectId
    ? db
        .select()
        .from(schema.continuityRules)
        .where(
          or(
            isNull(schema.continuityRules.projectId),
            eq(schema.continuityRules.projectId, projectId)
          )
        )
        .all()
    : db.select().from(schema.continuityRules).all();

  return allRules.filter((r) => !enabledOnly || r.enabled);
}

export function getContinuityRule(id: string): schema.ContinuityRule | null {
  const rule = db
    .select()
    .from(schema.continuityRules)
    .where(eq(schema.continuityRules.id, id))
    .get();
  return rule || null;
}

export function createContinuityRule(input: CreateContinuityRuleInput): schema.ContinuityRule {
  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.continuityRules)
    .values({
      id,
      projectId: input.projectId || null,
      ruleType: input.ruleType,
      name: input.name.trim(),
      description: (input.description || "").trim(),
      severity: input.severity || "MAJOR",
      enabled: input.enabled !== false,
      createdAt: now,
    })
    .run();

  const rule = getContinuityRule(id);
  if (!rule) throw new DomainError("Gagal membuat continuity rule.");
  return rule;
}

export function createContinuityCheck(
  input: CreateContinuityCheckInput
): schema.ContinuityCheck {
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, input.projectId))
    .get();
  if (!project) throw new DomainError("Proyek tidak ditemukan.");

  // Verify shot belongs to project
  const shot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.id, input.shotId), eq(schema.shots.projectId, input.projectId)))
    .get();
  if (!shot) throw new DomainError("Shot tidak ditemukan dalam proyek ini.");

  // Verify reference shot belongs to project
  const refShot = db
    .select()
    .from(schema.shots)
    .where(and(eq(schema.shots.id, input.referenceShotId), eq(schema.shots.projectId, input.projectId)))
    .get();
  if (!refShot) throw new DomainError("Reference shot tidak ditemukan dalam proyek ini.");

  const rule = getContinuityRule(input.ruleId);
  if (!rule) throw new DomainError("Continuity rule tidak ditemukan.");

  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.continuityChecks)
    .values({
      id,
      projectId: input.projectId,
      contentItemId: input.contentItemId,
      sceneId: input.sceneId || null,
      shotId: input.shotId,
      referenceShotId: input.referenceShotId,
      ruleId: input.ruleId,
      status: "OPEN",
      severity: input.severity,
      finding: input.finding.trim(),
      createdAt: now,
    })
    .run();

  const check = db
    .select()
    .from(schema.continuityChecks)
    .where(eq(schema.continuityChecks.id, id))
    .get();
  if (!check) throw new DomainError("Gagal membuat continuity check.");
  return check;
}

export function listContinuityChecks(
  filters: ContinuityCheckFilters
): Array<schema.ContinuityCheck & { ruleName: string; ruleType: string; shotCode: string; refShotCode: string }> {
  const query = db
    .select()
    .from(schema.continuityChecks)
    .where(eq(schema.continuityChecks.projectId, filters.projectId))
    .orderBy(desc(schema.continuityChecks.createdAt));

  const allChecks = query.all();

  const results: Array<schema.ContinuityCheck & { ruleName: string; ruleType: string; shotCode: string; refShotCode: string }> = [];

  for (const c of allChecks) {
    if (filters.contentItemId && c.contentItemId !== filters.contentItemId) continue;
    if (filters.shotId && c.shotId !== filters.shotId) continue;
    if (filters.status && c.status !== filters.status) continue;
    if (filters.severity && c.severity !== filters.severity) continue;

    const rule = getContinuityRule(c.ruleId);
    const shot = db.select().from(schema.shots).where(eq(schema.shots.id, c.shotId)).get();
    const refShot = db.select().from(schema.shots).where(eq(schema.shots.id, c.referenceShotId)).get();

    results.push({
      ...c,
      ruleName: rule?.name || "Unknown Rule",
      ruleType: rule?.ruleType || "OTHER",
      shotCode: shot?.shotCode || "Unknown",
      refShotCode: refShot?.shotCode || "Unknown",
    });
  }

  return results;
}

export function updateContinuityCheckStatus(
  id: string,
  projectId: string,
  status: schema.ContinuityCheckStatus
): schema.ContinuityCheck {
  const existing = db
    .select()
    .from(schema.continuityChecks)
    .where(and(eq(schema.continuityChecks.id, id), eq(schema.continuityChecks.projectId, projectId)))
    .get();
  if (!existing) throw new DomainError("Continuity check tidak ditemukan.");

  db.update(schema.continuityChecks)
    .set({ status })
    .where(and(eq(schema.continuityChecks.id, id), eq(schema.continuityChecks.projectId, projectId)))
    .run();

  const updated = db
    .select()
    .from(schema.continuityChecks)
    .where(eq(schema.continuityChecks.id, id))
    .get();
  if (!updated) throw new DomainError("Gagal memperbarui status continuity check.");
  return updated;
}
