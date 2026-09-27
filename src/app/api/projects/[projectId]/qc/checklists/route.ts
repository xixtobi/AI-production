import { NextResponse } from "next/server";
import { listQcChecklistItems } from "@/lib/qc";
import type { QcChecklistCategory } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const categoryParam = url.searchParams.get("category");
  const category = categoryParam ? (categoryParam as QcChecklistCategory) : undefined;

  const items = listQcChecklistItems(projectId, category);
  return NextResponse.json({ items });
}
