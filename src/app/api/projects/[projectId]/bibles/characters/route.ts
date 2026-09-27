import { NextResponse } from "next/server";
import { listCharacters, createCharacter } from "@/lib/script/bible-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  try {
    const characters = listCharacters(projectId);
    return NextResponse.json({ success: true, characters });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal mengambil daftar karakter.";
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
    const character = createCharacter({
      projectId,
      name: body.name,
      age: body.age,
      role: body.role,
      personality: body.personality,
      appearance: body.appearance,
      costume: body.costume,
      signatureProps: body.signatureProps,
      storyFunction: body.storyFunction,
      rules: body.rules,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, character }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal membuat karakter.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
