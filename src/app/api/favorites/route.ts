import { NextResponse } from "next/server";
import { listFavorites, toggleFavorite } from "@/lib/favorites";
import type { FavoriteEntityType } from "@/lib/db/enums";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const entityType = (url.searchParams.get("entityType") as FavoriteEntityType) || undefined;

  const favorites = listFavorites({
    projectId,
    entityType,
  });

  return NextResponse.json({ favorites });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.projectId || !body.entityType || !body.entityId) {
      return NextResponse.json({ error: "projectId, entityType, dan entityId diperlukan." }, { status: 400 });
    }

    const result = toggleFavorite({
      projectId: body.projectId,
      entityType: body.entityType,
      entityId: body.entityId,
      title: body.title || body.entityId,
      subtitle: body.subtitle,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
