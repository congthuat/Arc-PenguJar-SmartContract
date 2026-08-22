import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";

import { decodeArcScanCursor, parseArcScanActivity, serializeWalletActivityPage } from "@/lib/onchainActivity";
import { contractAddress } from "@/lib/config";

export const dynamic = "force-dynamic";

const ARCSCAN_API = "https://testnet.arcscan.app/api/v2";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const rawAddress = request.nextUrl.searchParams.get("address") ?? "";
  if (!isAddress(rawAddress)) return errorResponse("Invalid wallet address.", 400);

  const cursorValue = request.nextUrl.searchParams.get("cursor");
  const cursor = cursorValue ? decodeArcScanCursor(cursorValue) : undefined;
  if (cursorValue && !cursor) return errorResponse("Invalid activity cursor.", 400);

  const address = getAddress(rawAddress);
  const upstreamUrl = new URL(`${ARCSCAN_API}/addresses/${address}/token-transfers`);
  upstreamUrl.searchParams.set("type", "ERC-20");
  if (cursor) {
    upstreamUrl.searchParams.set("block_number", String(cursor.block_number));
    upstreamUrl.searchParams.set("index", String(cursor.index));
  }

  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return errorResponse("Activity provider is temporarily unavailable.", 502);
  }
  if (!response.ok) return errorResponse("Activity provider could not load this wallet.", 502);

  try {
    const page = parseArcScanActivity(await response.json(), address, contractAddress);
    return NextResponse.json(serializeWalletActivityPage(page), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return errorResponse("Activity provider returned an invalid response.", 502);
  }
}
