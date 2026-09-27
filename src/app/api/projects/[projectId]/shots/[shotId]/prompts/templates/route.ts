import { NextResponse } from "next/server";
import { listPromptTemplates, applyTemplateToShot } from "@/lib/prompts/template-service";
import { DomainError } from "@/lib/projects/domain-error";
import type { PromptType } from "@/lib/prompts/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category") || undefined;
    const promptType = (url.searchParams.get("type") as PromptType) || undefined;

    const templates = listPromptTemplates({ category, promptType });
    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal memuat template prompt.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; shotId: string }> }
) {
  const { projectId, shotId } = await context.params;
  try {
    const body = await request.json();
    const { templateIdOrCode } = body;

    if (!templateIdOrCode) {
      return NextResponse.json(
        { success: false, error: "Parameter 'templateIdOrCode' diperlukan." },
        { status: 400 }
      );
    }

    const applied = applyTemplateToShot({
      templateIdOrCode,
      shotId,
      projectId,
    });

    return NextResponse.json({
      success: true,
      ...applied,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menerapkan template prompt.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
