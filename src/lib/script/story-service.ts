import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import type { StoryDocumentType, StoryDocument, StoryDocumentVersion } from "./types";

export interface StoryDocumentWithVersions extends StoryDocument {
  versions: StoryDocumentVersion[];
  currentVersion: StoryDocumentVersion | null;
}

export function listStoryDocuments(projectId: string, contentItemId?: string): StoryDocumentWithVersions[] {
  const conditions = [eq(schema.storyDocuments.projectId, projectId)];
  if (contentItemId) {
    conditions.push(eq(schema.storyDocuments.contentItemId, contentItemId));
  }

  const docs = db
    .select()
    .from(schema.storyDocuments)
    .where(and(...conditions))
    .orderBy(schema.storyDocuments.createdAt)
    .all();

  return docs.map((doc) => {
    const versions = db
      .select()
      .from(schema.storyDocumentVersions)
      .where(eq(schema.storyDocumentVersions.storyDocumentId, doc.id))
      .orderBy(desc(schema.storyDocumentVersions.versionNumber))
      .all();

    const currentVersion = versions.find((v) => v.isCurrent) || versions[0] || null;
    return {
      ...doc,
      versions,
      currentVersion,
    };
  });
}

export function getStoryDocument(id: string): StoryDocumentWithVersions | null {
  const doc = db
    .select()
    .from(schema.storyDocuments)
    .where(eq(schema.storyDocuments.id, id))
    .get();

  if (!doc) return null;

  const versions = db
    .select()
    .from(schema.storyDocumentVersions)
    .where(eq(schema.storyDocumentVersions.storyDocumentId, doc.id))
    .orderBy(desc(schema.storyDocumentVersions.versionNumber))
    .all();

  const currentVersion = versions.find((v) => v.isCurrent) || versions[0] || null;

  return {
    ...doc,
    versions,
    currentVersion,
  };
}

export function createStoryDocument(params: {
  projectId: string;
  contentItemId?: string;
  docType: StoryDocumentType;
  title: string;
  initialContent?: string;
  notes?: string;
}): StoryDocumentWithVersions {
  if (!params.title.trim()) {
    throw new DomainError("Judul dokumen cerita tidak boleh kosong.");
  }

  const now = new Date();
  const docId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

  return db.transaction((tx) => {
    tx.insert(schema.storyDocuments)
      .values({
        id: docId,
        projectId: params.projectId,
        contentItemId: params.contentItemId || null,
        docType: params.docType,
        title: params.title.trim(),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const initialVersion: schema.StoryDocumentVersion = {
      id: versionId,
      storyDocumentId: docId,
      versionNumber: 1,
      title: `${params.title.trim()} V1`,
      content: params.initialContent ?? "",
      isCurrent: true,
      notes: params.notes ?? "Draf awal",
      createdAt: now,
    };

    tx.insert(schema.storyDocumentVersions).values(initialVersion).run();

    const doc = tx
      .select()
      .from(schema.storyDocuments)
      .where(eq(schema.storyDocuments.id, docId))
      .get()!;

    return {
      ...doc,
      versions: [initialVersion],
      currentVersion: initialVersion,
    };
  });
}

export function createStoryDocumentVersion(
  storyDocumentId: string,
  params: {
    title?: string;
    content: string;
    notes?: string;
  }
): StoryDocumentVersion {
  const doc = db
    .select()
    .from(schema.storyDocuments)
    .where(eq(schema.storyDocuments.id, storyDocumentId))
    .get();

  if (!doc) {
    throw new DomainError("Dokumen cerita tidak ditemukan.");
  }

  const existingVersions = db
    .select()
    .from(schema.storyDocumentVersions)
    .where(eq(schema.storyDocumentVersions.storyDocumentId, storyDocumentId))
    .orderBy(desc(schema.storyDocumentVersions.versionNumber))
    .all();

  const nextVersionNumber = existingVersions.length > 0 ? existingVersions[0].versionNumber + 1 : 1;
  const now = new Date();
  const newVersionId = crypto.randomUUID();
  const versionTitle = params.title?.trim() || `${doc.title} V${nextVersionNumber}`;

  return db.transaction((tx) => {
    // Unset previous current flags
    tx.update(schema.storyDocumentVersions)
      .set({ isCurrent: false })
      .where(eq(schema.storyDocumentVersions.storyDocumentId, storyDocumentId))
      .run();

    const newVersion: schema.StoryDocumentVersion = {
      id: newVersionId,
      storyDocumentId,
      versionNumber: nextVersionNumber,
      title: versionTitle,
      content: params.content,
      isCurrent: true,
      notes: params.notes ?? "",
      createdAt: now,
    };

    tx.insert(schema.storyDocumentVersions).values(newVersion).run();

    tx.update(schema.storyDocuments)
      .set({ updatedAt: now })
      .where(eq(schema.storyDocuments.id, storyDocumentId))
      .run();

    return newVersion;
  });
}

export function updateStoryDocument(id: string, params: { title?: string }): StoryDocument {
  const doc = db
    .select()
    .from(schema.storyDocuments)
    .where(eq(schema.storyDocuments.id, id))
    .get();

  if (!doc) {
    throw new DomainError("Dokumen cerita tidak ditemukan.");
  }

  const now = new Date();
  const updates: Partial<typeof schema.storyDocuments.$inferInsert> = {
    updatedAt: now,
  };

  if (params.title !== undefined) {
    if (!params.title.trim()) throw new DomainError("Judul dokumen cerita tidak boleh kosong.");
    updates.title = params.title.trim();
  }

  db.update(schema.storyDocuments).set(updates).where(eq(schema.storyDocuments.id, id)).run();

  return db
    .select()
    .from(schema.storyDocuments)
    .where(eq(schema.storyDocuments.id, id))
    .get()!;
}

export function deleteStoryDocument(id: string): void {
  const doc = db
    .select()
    .from(schema.storyDocuments)
    .where(eq(schema.storyDocuments.id, id))
    .get();

  if (!doc) {
    throw new DomainError("Dokumen cerita tidak ditemukan.");
  }

  db.transaction((tx) => {
    tx.delete(schema.storyDocumentVersions)
      .where(eq(schema.storyDocumentVersions.storyDocumentId, id))
      .run();
    tx.delete(schema.storyDocuments)
      .where(eq(schema.storyDocuments.id, id))
      .run();
  });
}
