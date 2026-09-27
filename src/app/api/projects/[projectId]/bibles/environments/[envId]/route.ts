import { NextResponse } from "next/server";
import { getEnvironment, updateEnvironment, deleteEnvironment } from "@/lib/script/bible-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; envId: string }> }
) {
  const { envId } = await context.params;
  try {
    const environment = getEnvironment(envId);
    if (!environment) {
      return NextResponse.json({ success: false, error: "Lingkungan tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ success: true, environment });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal mengambil data lingkungan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; envId: string }> }
) {
  const { envId } = await context.params;
  try {
    const body = await request.json();
    const environment = updateEnvironment(envId, body);
    return NextResponse.json({ success: true, environment });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal memperbarui data lingkungan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string; envId: string }> }
) {
  const { envId } = await context.params;
  try {
    deleteEnvironment(envId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menghapus lingkungan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
