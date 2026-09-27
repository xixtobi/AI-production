import { NextResponse } from "next/server";
import { createGenerationAttempt } from "@/lib/flow";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; itemId: string }> }
) {
  const { itemId } = await context.params;
  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      // Body may be empty
    }

    const attempt = createGenerationAttempt({
      flowQueueItemId: itemId,
      model: typeof body.model === "string" ? body.model : undefined,
      promptVersionId: typeof body.promptVersionId === "string" ? body.promptVersionId : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal membuat attempt generasi baru." },
      { status: 400 }
    );
  }
}
