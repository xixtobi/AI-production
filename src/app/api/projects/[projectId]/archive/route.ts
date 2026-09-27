import { NextResponse } from "next/server";
import { archiveProject, unarchiveProject } from "@/lib/archive";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "ARCHIVE";

    const project = action === "UNARCHIVE"
      ? unarchiveProject(projectId)
      : archiveProject(projectId);

    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
