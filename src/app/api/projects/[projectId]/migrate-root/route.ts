import { NextResponse } from "next/server";
import { migrateProjectRoot } from "@/lib/projects/service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json();
    if (!body.newRootPath) {
      return NextResponse.json({ error: "newRootPath diperlukan." }, { status: 400 });
    }

    const result = await migrateProjectRoot(projectId, body.newRootPath);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
