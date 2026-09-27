import { NextResponse } from "next/server";
import { searchProduction } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const projectId = url.searchParams.get("projectId") || undefined;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : undefined;

  const results = searchProduction({
    query: q,
    projectId,
    limit,
  });

  return NextResponse.json({ results });
}
