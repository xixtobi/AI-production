import { NextResponse } from "next/server";
import { checkDatabaseIntegrity } from "@/lib/system";

export const runtime = "nodejs";

export async function GET() {
  const result = checkDatabaseIntegrity();
  return NextResponse.json(result);
}

export async function POST() {
  const result = checkDatabaseIntegrity();
  return NextResponse.json(result);
}
