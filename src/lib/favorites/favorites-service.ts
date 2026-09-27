import "server-only";

import { and, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { FavoriteEntityType } from "@/lib/db/schema";

export function addFavorite(params: {
  projectId: string;
  entityType: FavoriteEntityType;
  entityId: string;
  title: string;
  subtitle?: string;
}): schema.Favorite {
  ensureDatabaseReady();

  const existing = db
    .select()
    .from(schema.favorites)
    .where(
      and(
        eq(schema.favorites.projectId, params.projectId),
        eq(schema.favorites.entityType, params.entityType),
        eq(schema.favorites.entityId, params.entityId)
      )
    )
    .get();

  if (existing) return existing;

  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(schema.favorites)
    .values({
      id,
      projectId: params.projectId,
      entityType: params.entityType,
      entityId: params.entityId,
      title: params.title,
      subtitle: params.subtitle || "",
      createdAt: now,
    })
    .run();

  const inserted = db.select().from(schema.favorites).where(eq(schema.favorites.id, id)).get();
  return inserted!;
}

export function removeFavorite(params: {
  projectId: string;
  entityType: FavoriteEntityType;
  entityId: string;
}): boolean {
  ensureDatabaseReady();

  const res = db
    .delete(schema.favorites)
    .where(
      and(
        eq(schema.favorites.projectId, params.projectId),
        eq(schema.favorites.entityType, params.entityType),
        eq(schema.favorites.entityId, params.entityId)
      )
    )
    .run();

  return res.changes > 0;
}

export function toggleFavorite(params: {
  projectId: string;
  entityType: FavoriteEntityType;
  entityId: string;
  title: string;
  subtitle?: string;
}): { isFavorite: boolean; favorite?: schema.Favorite } {
  ensureDatabaseReady();

  const existing = db
    .select()
    .from(schema.favorites)
    .where(
      and(
        eq(schema.favorites.projectId, params.projectId),
        eq(schema.favorites.entityType, params.entityType),
        eq(schema.favorites.entityId, params.entityId)
      )
    )
    .get();

  if (existing) {
    removeFavorite(params);
    return { isFavorite: false };
  } else {
    const fav = addFavorite(params);
    return { isFavorite: true, favorite: fav };
  }
}

export function isFavorite(params: {
  projectId: string;
  entityType: FavoriteEntityType;
  entityId: string;
}): boolean {
  ensureDatabaseReady();

  const existing = db
    .select()
    .from(schema.favorites)
    .where(
      and(
        eq(schema.favorites.projectId, params.projectId),
        eq(schema.favorites.entityType, params.entityType),
        eq(schema.favorites.entityId, params.entityId)
      )
    )
    .get();

  return !!existing;
}

export function listFavorites(params?: {
  projectId?: string;
  entityType?: FavoriteEntityType;
}): schema.Favorite[] {
  ensureDatabaseReady();

  if (params?.projectId && params?.entityType) {
    return db
      .select()
      .from(schema.favorites)
      .where(
        and(
          eq(schema.favorites.projectId, params.projectId),
          eq(schema.favorites.entityType, params.entityType)
        )
      )
      .all();
  }

  if (params?.projectId) {
    return db
      .select()
      .from(schema.favorites)
      .where(eq(schema.favorites.projectId, params.projectId))
      .all();
  }

  return db.select().from(schema.favorites).all();
}
