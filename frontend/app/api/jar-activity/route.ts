import { NextRequest, NextResponse } from "next/server";
import { loadJarActivity, parseJarActivitySearch } from "@/lib/jarActivityApi";

export const dynamic = "force-dynamic";
const requests = new Map<string, { count: number; resetAt: number }>();

export async function GET(request: NextRequest) {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!withinRateLimit(client)) return response({ error: "Too many Activity requests." }, 429);
  let input: ReturnType<typeof parseJarActivitySearch>;
  try { input = parseJarActivitySearch(request.nextUrl.searchParams); }
  catch (error) { return response({ error: error instanceof Error ? error.message : "Invalid Activity request." }, 400); }
  try { return response(await loadJarActivity(input), 200); }
  catch { return response({ error: "Activity provider is temporarily unavailable." }, 502); }
}

function withinRateLimit(client: string) {
  const now = Date.now();
  const current = requests.get(client);
  if (!current || current.resetAt <= now) { requests.set(client, { count: 1, resetAt: now + 60_000 }); return true; }
  current.count += 1;
  return current.count <= 30;
}

function response(payload: unknown, status: number) { return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store" } }); }
