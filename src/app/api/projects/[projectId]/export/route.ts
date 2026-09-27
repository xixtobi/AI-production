import { NextResponse } from "next/server";
import { exportProject } from "@/lib/export-import";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const result = exportProject({
      projectId,
      targetDirectory: body.targetDirectory,
      includeAssets: Boolean(body.includeAssets),
      author: body.author,
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
