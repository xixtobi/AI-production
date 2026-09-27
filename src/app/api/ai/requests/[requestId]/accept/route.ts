import { NextResponse } from "next/server";
import { acceptShotTaskResult } from "@/lib/gemini/task-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await context.params;
  try {
    let editedContent: string | undefined;
    try {
      const body = await request.json();
      if (body?.editedContent !== undefined) {
        editedContent = String(body.editedContent);
      }
    } catch {
      // body optional
    }

    const res = await acceptShotTaskResult({
      requestId,
      editedContent,
    });

    return NextResponse.json({
      success: true,
      message: res.message,
      shot: res.shot,
    });
  } catch (error) {
    const message = error instanceof DomainError ? error.message : (error as Error)?.message || "Gagal menyetujui draf AI.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
