import { NextResponse } from "next/server";
import { getSystemHealth, checkDatabaseIntegrity } from "@/lib/system";

export const runtime = "nodejs";

export async function GET() {
  const health = getSystemHealth();
  const dbIntegrity = checkDatabaseIntegrity();

  return NextResponse.json({
    systemHealth: health,
    databaseIntegrity: dbIntegrity,
  });
}
