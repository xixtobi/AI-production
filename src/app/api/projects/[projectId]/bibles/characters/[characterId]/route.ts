import { NextResponse } from "next/server";
import { getCharacter, updateCharacter, deleteCharacter } from "@/lib/script/bible-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; characterId: string }> }
) {
  const { characterId } = await context.params;
  try {
    const character = getCharacter(characterId);
    if (!character) {
      return NextResponse.json({ success: false, error: "Karakter tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ success: true, character });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal mengambil data karakter.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; characterId: string }> }
) {
  const { characterId } = await context.params;
  try {
    const body = await request.json();
    const character = updateCharacter(characterId, body);
    return NextResponse.json({ success: true, character });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal memperbarui data karakter.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string; characterId: string }> }
) {
  const { characterId } = await context.params;
  try {
    deleteCharacter(characterId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menghapus karakter.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
