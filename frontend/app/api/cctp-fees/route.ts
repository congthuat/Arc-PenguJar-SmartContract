import { NextResponse } from "next/server";

import { ARC_CCTP_DOMAIN, BASE_SEPOLIA_CCTP_DOMAIN, CCTP_STANDARD_FINALITY, type CctpForwardingFee } from "@/lib/cctp";

export const dynamic = "force-dynamic";

type CircleFeeRow = {
  finalityThreshold?: unknown;
  minimumFee?: unknown;
  forwardFee?: { med?: unknown; medium?: unknown };
};

export async function GET() {
  const url = `https://iris-api-sandbox.circle.com/v2/burn/USDC/fees/${ARC_CCTP_DOMAIN}/${BASE_SEPOLIA_CCTP_DOMAIN}?forward=true`;
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  } catch {
    return NextResponse.json({ error: "Circle fee service is temporarily unreachable." }, { status: 502 });
  }

  if (!response.ok) return NextResponse.json({ error: "Could not load the current CCTP forwarding fee." }, { status: 502 });

  const payload = await response.json().catch(() => undefined);
  if (!Array.isArray(payload)) return NextResponse.json({ error: "Circle returned an unexpected fee response." }, { status: 502 });

  const row = (payload as CircleFeeRow[]).find((item) => Number(item.finalityThreshold) === CCTP_STANDARD_FINALITY);
  const minimumFee = Number(row?.minimumFee);
  const forwardFeeMed = row?.forwardFee?.med ?? row?.forwardFee?.medium;
  const forwardFeeString = typeof forwardFeeMed === "number" && Number.isSafeInteger(forwardFeeMed) && forwardFeeMed >= 0
    ? String(forwardFeeMed)
    : typeof forwardFeeMed === "string" && /^\d+$/.test(forwardFeeMed)
      ? forwardFeeMed
      : undefined;

  if (!row || !Number.isFinite(minimumFee) || minimumFee < 0 || !forwardFeeString) {
    return NextResponse.json({ error: "A safe standard CCTP forwarding quote is not available right now." }, { status: 502 });
  }

  const fee: CctpForwardingFee = {
    finalityThreshold: CCTP_STANDARD_FINALITY,
    minimumFee,
    forwardFeeMed: forwardFeeString,
    quotedAt: Date.now(),
  };
  return NextResponse.json(fee, { headers: { "Cache-Control": "no-store" } });
}
