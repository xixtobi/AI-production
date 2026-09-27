import { NextResponse } from "next/server";
import { prepareFlowJob } from "@/lib/flow";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; itemId: string }> }
) {
  const { itemId } = await context.params;
  try {
    let createPackage = false;
    try {
      const body = await request.json();
      createPackage = Boolean(body.createPackage);
    } catch {
      // Body may be empty
    }

    const prep = prepareFlowJob(itemId, { createPackage });
    return NextResponse.json({
      success: true,
      jobDirectory: prep.jobDirectory,
      manifest: prep.manifest,
      files: prep.files,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal menyiapkan paket Flow." },
      { status: 400 }
    );
  }
}
