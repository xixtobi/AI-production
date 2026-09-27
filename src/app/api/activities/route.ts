import { NextResponse } from "next/server";
import { listActivities } from "@/lib/activity";
import type { ActivityActionType } from "@/lib/db/enums";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const actionType = (url.searchParams.get("actionType") as ActivityActionType) || undefined;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : undefined;

  const activities = listActivities({
    projectId,
    actionType,
    limit,
  });

  return NextResponse.json({ activities });
}
