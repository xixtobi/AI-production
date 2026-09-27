import { NextResponse } from "next/server";
import { rejectShotTaskResult } from "@/lib/gemini/task-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await context.params;
  try {
    const res = await rejectShotTaskResult({ requestId });
    return NextResponse.json({
      success: true,
      message: res.message,
    });
  } catch (error) {
    const message = error instanceof DomainError ? error.message : (error as Error)?.message || "Gagal menolak draf AI.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
