import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import type { Character, Environment, StoryBible, StyleBible } from "./types";

// ==================== CHARACTERS ====================

export function listCharacters(projectId: string): Character[] {
  return db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.projectId, projectId))
    .orderBy(schema.characters.name)
    .all();
}

export function getCharacter(id: string): Character | null {
  return db.select().from(schema.characters).where(eq(schema.characters.id, id)).get() ?? null;
}

export function getCharacterByName(projectId: string, name: string): Character | null {
  return (
    db
      .select()
      .from(schema.characters)
      .where(and(eq(schema.characters.projectId, projectId), eq(schema.characters.name, name)))
      .get() ?? null
  );
}

export function createCharacter(params: {
  projectId: string;
  name: string;
  age?: string;
  role?: string;
  personality?: string;
  appearance?: string;
  costume?: string;
  signatureProps?: string;
  storyFunction?: string;
  rules?: string;
  notes?: string;
}): Character {
  if (!params.name.trim()) {
    throw new DomainError("Nama karakter tidak boleh kosong.");
  }

  const existing = getCharacterByName(params.projectId, params.name.trim());
  if (existing) {
    throw new DomainError(`Karakter dengan nama '${params.name.trim()}' sudah ada dalam proyek ini.`);
  }

  const now = new Date();
  const id = crypto.randomUUID();

  db.insert(schema.characters)
    .values({
      id,
      projectId: params.projectId,
      name: params.name.trim(),
      age: params.age ?? "",
      role: params.role ?? "",
      personality: params.personality ?? "",
      appearance: params.appearance ?? "",
      costume: params.costume ?? "",
      signatureProps: params.signatureProps ?? "",
      storyFunction: params.storyFunction ?? "",
      rules: params.rules ?? "",
      notes: params.notes ?? "",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getCharacter(id)!;
}

export function updateCharacter(
  id: string,
  params: Partial<{
    name: string;
    age: string;
    role: string;
    personality: string;
    appearance: string;
    costume: string;
    signatureProps: string;
    storyFunction: string;
    rules: string;
    notes: string;
  }>
): Character {
  const existing = getCharacter(id);
  if (!existing) {
    throw new DomainError("Karakter tidak ditemukan.");
  }

  const now = new Date();
  const updates: Partial<typeof schema.characters.$inferInsert> = {
    updatedAt: now,
  };

  if (params.name !== undefined) {
    if (!params.name.trim()) throw new DomainError("Nama karakter tidak boleh kosong.");
    if (params.name.trim() !== existing.name) {
      const duplicate = getCharacterByName(existing.projectId, params.name.trim());
      if (duplicate && duplicate.id !== id) {
        throw new DomainError(`Karakter dengan nama '${params.name.trim()}' sudah ada.`);
      }
    }
    updates.name = params.name.trim();
  }
  if (params.age !== undefined) updates.age = params.age;
  if (params.role !== undefined) updates.role = params.role;
  if (params.personality !== undefined) updates.personality = params.personality;
  if (params.appearance !== undefined) updates.appearance = params.appearance;
  if (params.costume !== undefined) updates.costume = params.costume;
  if (params.signatureProps !== undefined) updates.signatureProps = params.signatureProps;
  if (params.storyFunction !== undefined) updates.storyFunction = params.storyFunction;
  if (params.rules !== undefined) updates.rules = params.rules;
  if (params.notes !== undefined) updates.notes = params.notes;

  db.update(schema.characters).set(updates).where(eq(schema.characters.id, id)).run();

  return getCharacter(id)!;
}

export function deleteCharacter(id: string): void {
  const existing = getCharacter(id);
  if (!existing) {
    throw new DomainError("Karakter tidak ditemukan.");
  }
  db.delete(schema.characters).where(eq(schema.characters.id, id)).run();
}

// ==================== ENVIRONMENTS ====================

export function listEnvironments(projectId: string): Environment[] {
  return db
    .select()
    .from(schema.environments)
    .where(eq(schema.environments.projectId, projectId))
    .orderBy(schema.environments.name)
    .all();
}

export function getEnvironment(id: string): Environment | null {
  return db.select().from(schema.environments).where(eq(schema.environments.id, id)).get() ?? null;
}

export function getEnvironmentByName(projectId: string, name: string): Environment | null {
  return (
    db
      .select()
      .from(schema.environments)
      .where(and(eq(schema.environments.projectId, projectId), eq(schema.environments.name, name)))
      .get() ?? null
  );
}

export function createEnvironment(params: {
  projectId: string;
  name: string;
  description?: string;
  visualCharacteristics?: string;
  tone?: string;
  timeOfDayNotes?: string;
  rules?: string;
  referenceAssets?: string;
}): Environment {
  if (!params.name.trim()) {
    throw new DomainError("Nama lingkungan tidak boleh kosong.");
  }

  const existing = getEnvironmentByName(params.projectId, params.name.trim());
  if (existing) {
    throw new DomainError(`Lingkungan dengan nama '${params.name.trim()}' sudah ada dalam proyek ini.`);
  }

  const now = new Date();
  const id = crypto.randomUUID();

  db.insert(schema.environments)
    .values({
      id,
      projectId: params.projectId,
      name: params.name.trim(),
      description: params.description ?? "",
      visualCharacteristics: params.visualCharacteristics ?? "",
      tone: params.tone ?? "",
      timeOfDayNotes: params.timeOfDayNotes ?? "",
      rules: params.rules ?? "",
      referenceAssets: params.referenceAssets ?? "",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getEnvironment(id)!;
}

export function updateEnvironment(
  id: string,
  params: Partial<{
    name: string;
    description: string;
    visualCharacteristics: string;
    tone: string;
    timeOfDayNotes: string;
    rules: string;
    referenceAssets: string;
  }>
): Environment {
  const existing = getEnvironment(id);
  if (!existing) {
    throw new DomainError("Lingkungan tidak ditemukan.");
  }

  const now = new Date();
  const updates: Partial<typeof schema.environments.$inferInsert> = {
    updatedAt: now,
  };

  if (params.name !== undefined) {
    if (!params.name.trim()) throw new DomainError("Nama lingkungan tidak boleh kosong.");
    if (params.name.trim() !== existing.name) {
      const duplicate = getEnvironmentByName(existing.projectId, params.name.trim());
      if (duplicate && duplicate.id !== id) {
        throw new DomainError(`Lingkungan dengan nama '${params.name.trim()}' sudah ada.`);
      }
    }
    updates.name = params.name.trim();
  }
  if (params.description !== undefined) updates.description = params.description;
  if (params.visualCharacteristics !== undefined) updates.visualCharacteristics = params.visualCharacteristics;
  if (params.tone !== undefined) updates.tone = params.tone;
  if (params.timeOfDayNotes !== undefined) updates.timeOfDayNotes = params.timeOfDayNotes;
  if (params.rules !== undefined) updates.rules = params.rules;
  if (params.referenceAssets !== undefined) updates.referenceAssets = params.referenceAssets;

  db.update(schema.environments).set(updates).where(eq(schema.environments.id, id)).run();

  return getEnvironment(id)!;
}

export function deleteEnvironment(id: string): void {
  const existing = getEnvironment(id);
  if (!existing) {
    throw new DomainError("Lingkungan tidak ditemukan.");
  }
  db.delete(schema.environments).where(eq(schema.environments.id, id)).run();
}

// ==================== STORY BIBLE ====================

export function getStoryBible(projectId: string): StoryBible | null {
  return (
    db
      .select()
      .from(schema.storyBibles)
      .where(and(eq(schema.storyBibles.projectId, projectId), eq(schema.storyBibles.isCurrent, true)))
      .get() ?? null
  );
}

export function getOrCreateStoryBible(projectId: string): StoryBible {
  const existing = getStoryBible(projectId);
  if (existing) return existing;

  const now = new Date();
  const id = crypto.randomUUID();

  db.insert(schema.storyBibles)
    .values({
      id,
      projectId,
      versionNumber: 1,
      versionLabel: "V01",
      premise: "",
      worldRules: "",
      mystery: "",
      themes: "",
      storyEngine: "",
      tone: "",
      constraints: "",
      isCurrent: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getStoryBible(projectId)!;
}

export function updateStoryBible(
  projectId: string,
  params: Partial<{
    premise: string;
    worldRules: string;
    mystery: string;
    themes: string;
    storyEngine: string;
    tone: string;
    constraints: string;
  }>
): StoryBible {
  const current = getOrCreateStoryBible(projectId);
  const now = new Date();

  db.update(schema.storyBibles)
    .set({
      ...params,
      updatedAt: now,
    })
    .where(eq(schema.storyBibles.id, current.id))
    .run();

  return getStoryBible(projectId)!;
}

// ==================== STYLE BIBLE ====================

export function getStyleBible(projectId: string): StyleBible | null {
  return (
    db
      .select()
      .from(schema.styleBibles)
      .where(eq(schema.styleBibles.projectId, projectId))
      .get() ?? null
  );
}

export function getOrCreateStyleBible(projectId: string): StyleBible {
  const existing = getStyleBible(projectId);
  if (existing) return existing;

  const now = new Date();
  const id = crypto.randomUUID();

  db.insert(schema.styleBibles)
    .values({
      id,
      projectId,
      visualStyle: "",
      audience: "",
      tone: "",
      cameraLanguage: "",
      lighting: "",
      paletteNotes: "",
      forbiddenVisuals: "",
      continuityRules: "",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getStyleBible(projectId)!;
}

export function updateStyleBible(
  projectId: string,
  params: Partial<{
    visualStyle: string;
    audience: string;
    tone: string;
    cameraLanguage: string;
    lighting: string;
    paletteNotes: string;
    forbiddenVisuals: string;
    continuityRules: string;
  }>
): StyleBible {
  const current = getOrCreateStyleBible(projectId);
  const now = new Date();

  db.update(schema.styleBibles)
    .set({
      ...params,
      updatedAt: now,
    })
    .where(eq(schema.styleBibles.id, current.id))
    .run();

  return getStyleBible(projectId)!;
}
