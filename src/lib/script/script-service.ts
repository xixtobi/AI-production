import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { DomainError } from "@/lib/projects/domain-error";
import type {
  ScriptBlockInput,
  ScriptDocumentDetail,
  ScriptSceneInput,
  ScriptSceneWithBlocks,
  ScriptVersionDetail,
} from "./types";

// ==================== SCRIPT DOCUMENTS ====================

export function getOrCreateScriptDocument(projectId: string, contentItemId: string): ScriptDocumentDetail {
  let doc = db
    .select()
    .from(schema.scriptDocuments)
    .where(eq(schema.scriptDocuments.contentItemId, contentItemId))
    .get();

  if (!doc) {
    const now = new Date();
    const docId = crypto.randomUUID();
    const versionId = crypto.randomUUID();

    // Get content title if available
    const content = db.select().from(schema.contentItems).where(eq(schema.contentItems.id, contentItemId)).get();
    const docTitle = content ? `Skrip - ${content.title}` : "Skrip Baru";

    db.transaction((tx) => {
      tx.insert(schema.scriptDocuments)
        .values({
          id: docId,
          projectId,
          contentItemId,
          title: docTitle,
          description: "Dokumen skrip kanonikal produksi.",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      tx.insert(schema.scriptVersions)
        .values({
          id: versionId,
          scriptDocumentId: docId,
          versionNumber: 1,
          versionLabel: "V01",
          isLocked: false,
          isCurrent: true,
          notes: "Draf awal V01",
          createdAt: now,
        })
        .run();
    });

    doc = db.select().from(schema.scriptDocuments).where(eq(schema.scriptDocuments.id, docId)).get()!;
  }

  return getScriptDocumentDetail(doc.id)!;
}

export function getScriptDocumentDetail(scriptDocumentId: string): ScriptDocumentDetail | null {
  const doc = db.select().from(schema.scriptDocuments).where(eq(schema.scriptDocuments.id, scriptDocumentId)).get();
  if (!doc) return null;

  const versions = db
    .select()
    .from(schema.scriptVersions)
    .where(eq(schema.scriptVersions.scriptDocumentId, scriptDocumentId))
    .orderBy(desc(schema.scriptVersions.versionNumber))
    .all();

  const currentVersionRow = versions.find((v) => v.isCurrent) || versions[0] || null;
  const currentVersion = currentVersionRow ? getVersionDetail(currentVersionRow.id) : null;

  return {
    ...doc,
    versions,
    currentVersion,
  };
}

export function getVersionDetail(versionId: string): ScriptVersionDetail | null {
  const version = db.select().from(schema.scriptVersions).where(eq(schema.scriptVersions.id, versionId)).get();
  if (!version) return null;

  const scenes = db
    .select()
    .from(schema.scriptScenes)
    .where(eq(schema.scriptScenes.scriptVersionId, versionId))
    .orderBy(schema.scriptScenes.sortOrder, schema.scriptScenes.sceneNumber)
    .all();

  const sceneIds = scenes.map((s) => s.id);
  const blocks =
    sceneIds.length > 0
      ? db
          .select()
          .from(schema.scriptBlocks)
          .where(inArray(schema.scriptBlocks.scriptSceneId, sceneIds))
          .orderBy(schema.scriptBlocks.sortOrder, schema.scriptBlocks.createdAt)
          .all()
      : [];

  const blocksByScene = new Map<string, schema.ScriptBlock[]>();
  for (const block of blocks) {
    const list = blocksByScene.get(block.scriptSceneId) || [];
    list.push(block);
    blocksByScene.set(block.scriptSceneId, list);
  }

  const scenesWithBlocks: ScriptSceneWithBlocks[] = scenes.map((scene) => ({
    ...scene,
    blocks: blocksByScene.get(scene.id) || [],
  }));

  return {
    ...version,
    scenes: scenesWithBlocks,
  };
}

// ==================== VERSIONING & LOCKING ====================

export function createNewVersion(
  scriptDocumentId: string,
  params?: {
    cloneFromVersionId?: string;
    notes?: string;
  }
): ScriptVersionDetail {
  const doc = db.select().from(schema.scriptDocuments).where(eq(schema.scriptDocuments.id, scriptDocumentId)).get();
  if (!doc) {
    throw new DomainError("Dokumen skrip tidak ditemukan.");
  }

  const existingVersions = db
    .select()
    .from(schema.scriptVersions)
    .where(eq(schema.scriptVersions.scriptDocumentId, scriptDocumentId))
    .orderBy(desc(schema.scriptVersions.versionNumber))
    .all();

  const maxVersion = existingVersions.length > 0 ? existingVersions[0].versionNumber : 0;
  const nextVersionNumber = maxVersion + 1;
  const versionLabel = `V${String(nextVersionNumber).padStart(2, "0")}`;
  const now = new Date();
  const newVersionId = crypto.randomUUID();

  // Determine source version to clone from
  const cloneSourceId =
    params?.cloneFromVersionId ||
    existingVersions.find((v) => v.isCurrent)?.id ||
    (existingVersions.length > 0 ? existingVersions[0].id : null);

  const sourceVersionDetail = cloneSourceId ? getVersionDetail(cloneSourceId) : null;

  return db.transaction((tx) => {
    // Unset current on existing versions
    tx.update(schema.scriptVersions)
      .set({ isCurrent: false })
      .where(eq(schema.scriptVersions.scriptDocumentId, scriptDocumentId))
      .run();

    // Insert new version
    tx.insert(schema.scriptVersions)
      .values({
        id: newVersionId,
        scriptDocumentId,
        versionNumber: nextVersionNumber,
        versionLabel,
        isLocked: false,
        isCurrent: true,
        notes: params?.notes ?? `Draf ${versionLabel}`,
        createdAt: now,
      })
      .run();

    // Clone scenes and blocks if source exists
    if (sourceVersionDetail && sourceVersionDetail.scenes.length > 0) {
      for (const scene of sourceVersionDetail.scenes) {
        const newSceneId = crypto.randomUUID();
        tx.insert(schema.scriptScenes)
          .values({
            id: newSceneId,
            scriptVersionId: newVersionId,
            sceneNumber: scene.sceneNumber,
            sceneCode: scene.sceneCode,
            heading: scene.heading,
            location: scene.location,
            timeOfDay: scene.timeOfDay,
            description: scene.description,
            sortOrder: scene.sortOrder,
            linkedSceneId: scene.linkedSceneId,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        for (const block of scene.blocks) {
          tx.insert(schema.scriptBlocks)
            .values({
              id: crypto.randomUUID(),
              scriptSceneId: newSceneId,
              blockType: block.blockType,
              character: block.character,
              content: block.content,
              sortOrder: block.sortOrder,
              notes: block.notes,
              createdAt: now,
              updatedAt: now,
            })
            .run();
        }
      }
    }

    tx.update(schema.scriptDocuments)
      .set({ updatedAt: now })
      .where(eq(schema.scriptDocuments.id, scriptDocumentId))
      .run();

    return getVersionDetail(newVersionId)!;
  });
}

export function lockVersion(versionId: string, notes?: string): ScriptVersionDetail {
  const versionDetail = getVersionDetail(versionId);
  if (!versionDetail) {
    throw new DomainError("Versi skrip tidak ditemukan.");
  }

  if (versionDetail.isLocked) {
    return versionDetail;
  }

  const now = new Date();
  const snapshotJson = JSON.stringify(versionDetail.scenes);

  db.update(schema.scriptVersions)
    .set({
      isLocked: true,
      lockedAt: now,
      snapshotJson,
      notes: notes !== undefined ? notes : versionDetail.notes,
    })
    .where(eq(schema.scriptVersions.id, versionId))
    .run();

  return getVersionDetail(versionId)!;
}

export function assertVersionNotLocked(versionId: string): void {
  const version = db.select().from(schema.scriptVersions).where(eq(schema.scriptVersions.id, versionId)).get();
  if (!version) {
    throw new DomainError("Versi skrip tidak ditemukan.");
  }
  if (version.isLocked) {
    throw new DomainError(
      `Versi skrip ${version.versionLabel} telah dikunci (LOCKED) sebagai snapshot resmi produksi dan tidak dapat diubah. Silakan buat versi baru (misal V02) untuk melanjutkan penulisan.`
    );
  }
}

// ==================== SCENES ====================

export function addScene(versionId: string, data: ScriptSceneInput): ScriptSceneWithBlocks {
  assertVersionNotLocked(versionId);

  const now = new Date();
  const sceneId = crypto.randomUUID();

  // Validate or calculate scene number / order
  const existingScenes = db
    .select()
    .from(schema.scriptScenes)
    .where(eq(schema.scriptScenes.scriptVersionId, versionId))
    .orderBy(desc(schema.scriptScenes.sceneNumber))
    .all();

  const nextSceneNumber = data.sceneNumber || (existingScenes.length > 0 ? existingScenes[0].sceneNumber + 1 : 1);
  const sceneCode = data.sceneCode || `SC${String(nextSceneNumber).padStart(3, "0")}`;
  const sortOrder = data.sortOrder ?? (existingScenes.length > 0 ? existingScenes.length : 0);

  db.transaction((tx) => {
    tx.insert(schema.scriptScenes)
      .values({
        id: sceneId,
        scriptVersionId: versionId,
        sceneNumber: nextSceneNumber,
        sceneCode,
        heading: data.heading.trim(),
        location: data.location ?? "",
        timeOfDay: data.timeOfDay ?? "",
        description: data.description ?? "",
        sortOrder,
        linkedSceneId: data.linkedSceneId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    if (data.blocks && data.blocks.length > 0) {
      for (const [index, block] of data.blocks.entries()) {
        tx.insert(schema.scriptBlocks)
          .values({
            id: crypto.randomUUID(),
            scriptSceneId: sceneId,
            blockType: block.blockType,
            character: block.character ?? null,
            content: block.content,
            sortOrder: block.sortOrder ?? index,
            notes: block.notes ?? "",
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }
  });

  const scene = db.select().from(schema.scriptScenes).where(eq(schema.scriptScenes.id, sceneId)).get()!;
  const blocks = db
    .select()
    .from(schema.scriptBlocks)
    .where(eq(schema.scriptBlocks.scriptSceneId, sceneId))
    .orderBy(schema.scriptBlocks.sortOrder)
    .all();

  return { ...scene, blocks };
}

export function updateScene(
  sceneId: string,
  data: Partial<Omit<ScriptSceneInput, "blocks">>
): ScriptSceneWithBlocks {
  const scene = db.select().from(schema.scriptScenes).where(eq(schema.scriptScenes.id, sceneId)).get();
  if (!scene) {
    throw new DomainError("Adegan skrip tidak ditemukan.");
  }
  assertVersionNotLocked(scene.scriptVersionId);

  const now = new Date();
  const updates: Partial<typeof schema.scriptScenes.$inferInsert> = {
    updatedAt: now,
  };

  if (data.sceneNumber !== undefined) updates.sceneNumber = data.sceneNumber;
  if (data.sceneCode !== undefined) updates.sceneCode = data.sceneCode;
  if (data.heading !== undefined) updates.heading = data.heading.trim();
  if (data.location !== undefined) updates.location = data.location;
  if (data.timeOfDay !== undefined) updates.timeOfDay = data.timeOfDay;
  if (data.description !== undefined) updates.description = data.description;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  if (data.linkedSceneId !== undefined) updates.linkedSceneId = data.linkedSceneId;

  db.update(schema.scriptScenes).set(updates).where(eq(schema.scriptScenes.id, sceneId)).run();

  const updatedScene = db.select().from(schema.scriptScenes).where(eq(schema.scriptScenes.id, sceneId)).get()!;
  const blocks = db
    .select()
    .from(schema.scriptBlocks)
    .where(eq(schema.scriptBlocks.scriptSceneId, sceneId))
    .orderBy(schema.scriptBlocks.sortOrder)
    .all();

  return { ...updatedScene, blocks };
}

export function deleteScene(sceneId: string): void {
  const scene = db.select().from(schema.scriptScenes).where(eq(schema.scriptScenes.id, sceneId)).get();
  if (!scene) {
    throw new DomainError("Adegan skrip tidak ditemukan.");
  }
  assertVersionNotLocked(scene.scriptVersionId);

  db.transaction((tx) => {
    tx.delete(schema.scriptBlocks).where(eq(schema.scriptBlocks.scriptSceneId, sceneId)).run();
    tx.delete(schema.scriptScenes).where(eq(schema.scriptScenes.id, sceneId)).run();
  });
}

export function reorderScenes(versionId: string, orderedSceneIds: string[]): void {
  assertVersionNotLocked(versionId);
  const now = new Date();

  db.transaction((tx) => {
    for (const [index, sceneId] of orderedSceneIds.entries()) {
      tx.update(schema.scriptScenes)
        .set({ sortOrder: index, updatedAt: now })
        .where(and(eq(schema.scriptScenes.id, sceneId), eq(schema.scriptScenes.scriptVersionId, versionId)))
        .run();
    }
  });
}

// ==================== BLOCKS ====================

export function addBlock(sceneId: string, data: ScriptBlockInput): schema.ScriptBlock {
  const scene = db.select().from(schema.scriptScenes).where(eq(schema.scriptScenes.id, sceneId)).get();
  if (!scene) {
    throw new DomainError("Adegan skrip tidak ditemukan.");
  }
  assertVersionNotLocked(scene.scriptVersionId);

  const existingBlocks = db
    .select()
    .from(schema.scriptBlocks)
    .where(eq(schema.scriptBlocks.scriptSceneId, sceneId))
    .orderBy(desc(schema.scriptBlocks.sortOrder))
    .all();

  const sortOrder = data.sortOrder ?? (existingBlocks.length > 0 ? existingBlocks[0].sortOrder + 1 : 0);
  const now = new Date();
  const blockId = crypto.randomUUID();

  db.insert(schema.scriptBlocks)
    .values({
      id: blockId,
      scriptSceneId: sceneId,
      blockType: data.blockType,
      character: data.character ?? null,
      content: data.content,
      sortOrder,
      notes: data.notes ?? "",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return db.select().from(schema.scriptBlocks).where(eq(schema.scriptBlocks.id, blockId)).get()!;
}

export function updateBlock(
  blockId: string,
  data: Partial<ScriptBlockInput>
): schema.ScriptBlock {
  const block = db.select().from(schema.scriptBlocks).where(eq(schema.scriptBlocks.id, blockId)).get();
  if (!block) {
    throw new DomainError("Blok skrip tidak ditemukan.");
  }
  const scene = db.select().from(schema.scriptScenes).where(eq(schema.scriptScenes.id, block.scriptSceneId)).get();
  if (!scene) {
    throw new DomainError("Adegan induk blok skrip tidak ditemukan.");
  }
  assertVersionNotLocked(scene.scriptVersionId);

  const now = new Date();
  const updates: Partial<typeof schema.scriptBlocks.$inferInsert> = {
    updatedAt: now,
  };

  if (data.blockType !== undefined) updates.blockType = data.blockType;
  if (data.character !== undefined) updates.character = data.character;
  if (data.content !== undefined) updates.content = data.content;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  if (data.notes !== undefined) updates.notes = data.notes;

  db.update(schema.scriptBlocks).set(updates).where(eq(schema.scriptBlocks.id, blockId)).run();

  return db.select().from(schema.scriptBlocks).where(eq(schema.scriptBlocks.id, blockId)).get()!;
}

export function deleteBlock(blockId: string): void {
  const block = db.select().from(schema.scriptBlocks).where(eq(schema.scriptBlocks.id, blockId)).get();
  if (!block) {
    throw new DomainError("Blok skrip tidak ditemukan.");
  }
  const scene = db.select().from(schema.scriptScenes).where(eq(schema.scriptScenes.id, block.scriptSceneId)).get();
  if (!scene) {
    throw new DomainError("Adegan induk blok skrip tidak ditemukan.");
  }
  assertVersionNotLocked(scene.scriptVersionId);

  db.delete(schema.scriptBlocks).where(eq(schema.scriptBlocks.id, blockId)).run();
}

export function reorderBlocks(sceneId: string, orderedBlockIds: string[]): void {
  const scene = db.select().from(schema.scriptScenes).where(eq(schema.scriptScenes.id, sceneId)).get();
  if (!scene) {
    throw new DomainError("Adegan skrip tidak ditemukan.");
  }
  assertVersionNotLocked(scene.scriptVersionId);

  const now = new Date();
  db.transaction((tx) => {
    for (const [index, blockId] of orderedBlockIds.entries()) {
      tx.update(schema.scriptBlocks)
        .set({ sortOrder: index, updatedAt: now })
        .where(and(eq(schema.scriptBlocks.id, blockId), eq(schema.scriptBlocks.scriptSceneId, sceneId)))
        .run();
    }
  });
}

// ==================== SCREENPLAY FORMATTING ====================

export function exportToScreenplayText(versionDetail: ScriptVersionDetail): string {
  const lines: string[] = [];

  for (const scene of versionDetail.scenes) {
    lines.push(`SCENE ${scene.sceneNumber}: ${scene.heading}`);
    if (scene.location || scene.timeOfDay) {
      lines.push(`[${scene.location} - ${scene.timeOfDay}]`);
    }
    if (scene.description) {
      lines.push(scene.description);
    }
    lines.push("");

    for (const block of scene.blocks) {
      switch (block.blockType) {
        case "CHARACTER":
        case "DIALOGUE":
          if (block.character) {
            lines.push(block.character.toUpperCase());
          }
          lines.push(block.content);
          break;
        case "PARENTHETICAL":
          lines.push(`(${block.content})`);
          break;
        case "SFX":
          lines.push(`SFX: ${block.content}`);
          break;
        case "MUSIC":
          lines.push(`MUSIK: ${block.content}`);
          break;
        case "TRANSITION":
          lines.push(`${block.content.toUpperCase()}:`);
          break;
        case "NOTE":
          lines.push(`[[CATATAN: ${block.content}]]`);
          break;
        case "ACTION":
        default:
          lines.push(block.content);
          break;
      }
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n").trim();
}
