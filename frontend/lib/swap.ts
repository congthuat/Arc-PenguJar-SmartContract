import { getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import { arcTestnet } from "viem/chains";

import { getAssetById, type SupportedAssetId } from "./assets.ts";

export const SWAP_SLIPPAGE_OPTIONS = [0.005, 0.01, 0.03] as const;
export const SWAP_QUOTE_MAX_AGE_MS = 45_000;

export type SwapQuote = {
  id: string;
  tool: string;
  toolName: string;
  fromAssetId: SupportedAssetId;
  toAssetId: SupportedAssetId;
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  approvalAddress: Address;
  executionDuration: number;
  transactionRequest: {
    to: Address;
    data: Hex;
    value: string;
    from: Address;
    chainId: typeof arcTestnet.id;
  };
  quotedAt: number;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as UnknownRecord;
}

function stringField(source: UnknownRecord, key: string, label = key) {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid ${label}`);
  return value;
}

function integerString(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value) || BigInt(value) <= 0n) throw new Error(`Invalid ${label}`);
  return value;
}

function numericField(source: UnknownRecord, key: string, fallback = 0) {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function isAllowedSwapSlippage(value: number): value is (typeof SWAP_SLIPPAGE_OPTIONS)[number] {
  return SWAP_SLIPPAGE_OPTIONS.includes(value as (typeof SWAP_SLIPPAGE_OPTIONS)[number]);
}

export function oppositeAssetId(assetId: SupportedAssetId): SupportedAssetId {
  return assetId === "usdc" ? "eurc" : "usdc";
}

export function isSwapQuoteFresh(quotedAt: number, now = Date.now()) {
  return Number.isFinite(quotedAt) && quotedAt <= now && now - quotedAt <= SWAP_QUOTE_MAX_AGE_MS;
}

export async function fetchLifiQuoteWithPresetFallback(
  upstreamUrl: URL,
  init: RequestInit,
  fetcher: typeof fetch = fetch,
) {
  const presetUrl = new URL(upstreamUrl);
  presetUrl.searchParams.set("preset", "stablecoin");
  const first = await fetcher(presetUrl, init);
  if (first.ok) return first;

  const error = await first.clone().json().catch(() => undefined) as { code?: unknown; message?: unknown } | undefined;
  const presetRejected = error?.code === 1011 && typeof error.message === "string" && error.message.includes("preset");
  return presetRejected ? fetcher(upstreamUrl, init) : first;
}

export function normalizeLifiQuote(
  payload: unknown,
  expected: {
    fromAssetId: SupportedAssetId;
    toAssetId: SupportedAssetId;
    fromAmount: string;
    fromAddress: Address;
  },
): SwapQuote {
  const root = record(payload, "quote");
  const action = record(root.action, "quote action");
  const estimate = record(root.estimate, "quote estimate");
  const transactionRequest = record(root.transactionRequest, "transaction request");
  const fromToken = record(action.fromToken, "from token");
  const toToken = record(action.toToken, "to token");
  const toolDetails = root.toolDetails && typeof root.toolDetails === "object" && !Array.isArray(root.toolDetails)
    ? (root.toolDetails as UnknownRecord)
    : undefined;

  const fromAsset = getAssetById(expected.fromAssetId);
  const toAsset = getAssetById(expected.toAssetId);
  if (!fromAsset || !toAsset || fromAsset.id === toAsset.id) throw new Error("Unsupported swap pair");

  if (action.fromChainId !== arcTestnet.id || action.toChainId !== arcTestnet.id) throw new Error("Quote is not Arc-only");
  validateSameChainSteps(root.includedSteps);
  if (stringField(fromToken, "address").toLowerCase() !== fromAsset.address.toLowerCase()) throw new Error("Unexpected sell token");
  if (stringField(toToken, "address").toLowerCase() !== toAsset.address.toLowerCase()) throw new Error("Unexpected buy token");
  if (integerString(action.fromAmount, "quote input amount") !== expected.fromAmount) throw new Error("Quote input changed");

  const approvalAddressRaw = stringField(estimate, "approvalAddress");
  if (!isAddress(approvalAddressRaw)) throw new Error("Invalid approval address");
  const approvalAddress = getAddress(approvalAddressRaw);

  const txToRaw = stringField(transactionRequest, "to", "transaction target");
  const txFromRaw = stringField(transactionRequest, "from", "transaction sender");
  const txDataRaw = stringField(transactionRequest, "data", "transaction data");
  const txValue = typeof transactionRequest.value === "string" ? transactionRequest.value : "0x0";
  if (!isAddress(txToRaw) || !isAddress(txFromRaw) || !isHex(txDataRaw) || !isHex(txValue)) throw new Error("Invalid transaction request");
  if (getAddress(txFromRaw) !== getAddress(expected.fromAddress)) throw new Error("Quote sender mismatch");
  if (transactionRequest.chainId !== arcTestnet.id) throw new Error("Transaction is not for Arc Testnet");
  if (BigInt(txValue) !== 0n) throw new Error("Unexpected native value in token swap");

  const estimateFromAmount = integerString(estimate.fromAmount ?? action.fromAmount, "estimate input amount");
  if (estimateFromAmount !== expected.fromAmount) throw new Error("Estimate input changed");

  const id = stringField(root, "id");
  const tool = stringField(root, "tool");
  const toolName = toolDetails && typeof toolDetails.name === "string" && toolDetails.name.length > 0 ? toolDetails.name : tool;

  return {
    id,
    tool,
    toolName,
    fromAssetId: fromAsset.id,
    toAssetId: toAsset.id,
    fromAmount: estimateFromAmount,
    toAmount: integerString(estimate.toAmount, "estimated output"),
    toAmountMin: integerString(estimate.toAmountMin, "minimum output"),
    approvalAddress,
    executionDuration: numericField(estimate, "executionDuration"),
    transactionRequest: {
      to: getAddress(txToRaw),
      data: txDataRaw as Hex,
      value: txValue,
      from: getAddress(txFromRaw),
      chainId: arcTestnet.id,
    },
    quotedAt: Date.now(),
  };
}

function validateSameChainSteps(value: unknown) {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error("Invalid quote steps");
  for (const stepValue of value) {
    const step = record(stepValue, "quote step");
    const action = record(step.action, "quote step action");
    if (action.fromChainId !== arcTestnet.id || action.toChainId !== arcTestnet.id) throw new Error("Bridge step is not allowed in swap mode");
  }
}
