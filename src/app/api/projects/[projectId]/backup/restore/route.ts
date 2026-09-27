import { NextResponse } from "next/server";
import { restoreBackup } from "@/lib/backup";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json();
    if (!body.backupPath || !body.confirmCode) {
      return NextResponse.json(
        { error: "backupPath dan confirmCode diperlukan untuk memulihkan cadangan." },
        { status: 400 }
      );
    }

    const result = restoreBackup({
      projectId,
      backupPath: body.backupPath,
      confirmCode: body.confirmCode,
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
