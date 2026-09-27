import { NextResponse } from "next/server";
import { listAvailableFlowModels } from "@/lib/flow";

export const runtime = "nodejs";

export async function GET() {
  const models = listAvailableFlowModels();
  return NextResponse.json({ models });
}
