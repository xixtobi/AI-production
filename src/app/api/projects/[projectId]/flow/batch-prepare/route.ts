import { NextResponse } from "next/server";
import { prepareBatchFlowJobs } from "@/lib/flow";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
    if (itemIds.length === 0) {
      return NextResponse.json({ error: "Pilih setidaknya satu job untuk disiapkan." }, { status: 400 });
    }

    const results = prepareBatchFlowJobs(itemIds, { createPackage: Boolean(body.createPackage) });
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof DomainError ? error.message : "Gagal memproses batch preparation." },
      { status: 400 }
    );
  }
}
