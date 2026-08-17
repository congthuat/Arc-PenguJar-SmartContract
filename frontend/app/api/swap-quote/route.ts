import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { arcTestnet } from "viem/chains";

import { getAssetById, type SupportedAssetId } from "@/lib/assets";
import { isAllowedSwapSlippage, normalizeLifiQuote } from "@/lib/swap";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const fromAssetId = request.nextUrl.searchParams.get("from") as SupportedAssetId | null;
  const toAssetId = request.nextUrl.searchParams.get("to") as SupportedAssetId | null;
  const amount = request.nextUrl.searchParams.get("amount") ?? "";
  const fromAddress = request.nextUrl.searchParams.get("address") ?? "";
  const slippage = Number(request.nextUrl.searchParams.get("slippage") ?? "0.005");

  const fromAsset = fromAssetId ? getAssetById(fromAssetId) : undefined;
  const toAsset = toAssetId ? getAssetById(toAssetId) : undefined;
  if (!fromAsset || !toAsset || fromAsset.id === toAsset.id) return errorResponse("Unsupported Arc swap pair.", 400);
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) return errorResponse("Invalid swap amount.", 400);
  if (!isAddress(fromAddress)) return errorResponse("Invalid wallet address.", 400);
  if (!isAllowedSwapSlippage(slippage)) return errorResponse("Unsupported slippage setting.", 400);

  const upstreamUrl = new URL("https://li.quest/v1/quote");
  upstreamUrl.searchParams.set("fromChain", String(arcTestnet.id));
  upstreamUrl.searchParams.set("toChain", String(arcTestnet.id));
  upstreamUrl.searchParams.set("fromToken", fromAsset.address);
  upstreamUrl.searchParams.set("toToken", toAsset.address);
  upstreamUrl.searchParams.set("fromAmount", amount);
  upstreamUrl.searchParams.set("fromAddress", fromAddress);
  upstreamUrl.searchParams.set("toAddress", fromAddress);
  upstreamUrl.searchParams.set("slippage", String(slippage));
  upstreamUrl.searchParams.set("allowBridges", "none");
  upstreamUrl.searchParams.set("preset", "stablecoin");
  upstreamUrl.searchParams.set("integrator", "makoto-wallet");

  const apiKey = process.env.LIFI_API_KEY;
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: apiKey ? { "x-lifi-api-key": apiKey } : undefined,
    });
  } catch {
    return errorResponse("Swap quote service is temporarily unreachable.", 502);
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => undefined) as { message?: unknown } | undefined;
    const message = typeof body?.message === "string" ? body.message : "No executable Arc swap route is available for this amount.";
    return errorResponse(message, upstream.status === 429 ? 429 : 502);
  }

  try {
    const payload = await upstream.json();
    const quote = normalizeLifiQuote(payload, {
      fromAssetId: fromAsset.id,
      toAssetId: toAsset.id,
      fromAmount: amount,
      fromAddress: fromAddress as Address,
    });
    return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("The swap provider returned an unsafe or unexpected quote.", 502);
  }
}
