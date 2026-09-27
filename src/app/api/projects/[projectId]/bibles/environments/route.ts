import { NextResponse } from "next/server";
import { listEnvironments, createEnvironment } from "@/lib/script/bible-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const environments = listEnvironments(projectId);
    return NextResponse.json({ success: true, environments });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal mengambil daftar lingkungan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const body = await request.json();
    const environment = createEnvironment({
      projectId,
      name: body.name,
      description: body.description,
      visualCharacteristics: body.visualCharacteristics,
      tone: body.tone,
      timeOfDayNotes: body.timeOfDayNotes,
      rules: body.rules,
      referenceAssets: body.referenceAssets,
    });
    return NextResponse.json({ success: true, environment }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal membuat lingkungan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
