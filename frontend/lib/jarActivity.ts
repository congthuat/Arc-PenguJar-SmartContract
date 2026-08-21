import type { JarActivityItem } from "./types";

export const ACTIVITY_REORG_OVERLAP = 12n;

export async function fetchAdaptiveRange<T>(options: {
  fromBlock: bigint;
  toBlock: bigint;
  request(fromBlock: bigint, toBlock: bigint): Promise<T[]>;
  wait?: (milliseconds: number) => Promise<void>;
  attempts?: number;
}): Promise<T[]> {
  const wait = options.wait ?? delay;
  const attempts = options.attempts ?? 4;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await options.request(options.fromBlock, options.toBlock);
    } catch (error) {
      const message = rpcErrorMessage(error);
      if (isRateLimitError(message) && attempt < attempts - 1) {
        await wait(600 * 2 ** attempt);
        continue;
      }
      if (isRangeLimitError(message) && options.fromBlock < options.toBlock) {
        const middle = (options.fromBlock + options.toBlock) / 2n;
        const first = await fetchAdaptiveRange({ ...options, toBlock: middle });
        const second = await fetchAdaptiveRange({ ...options, fromBlock: middle + 1n });
        return [...first, ...second];
      }
      throw error;
    }
  }
  return [];
}

export async function withRateLimitRetry<T>(request: () => Promise<T>, wait: (milliseconds: number) => Promise<void> = delay, attempts = 4): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await request(); }
    catch (error) {
      if (!isRateLimitError(rpcErrorMessage(error)) || attempt === attempts - 1) throw error;
      await wait(600 * 2 ** attempt);
    }
  }
  throw new Error("RPC retry attempts exhausted.");
}

export function incrementalScanStart(deploymentBlock: bigint, lastScannedBlock?: bigint, overlap = ACTIVITY_REORG_OVERLAP) {
  if (lastScannedBlock === undefined) return deploymentBlock;
  const candidate = lastScannedBlock - overlap + 1n;
  return candidate > deploymentBlock ? candidate : deploymentBlock;
}

export function mergeActivityOverlap(previous: readonly JarActivityItem[], fresh: readonly JarActivityItem[], overlapFrom: bigint) {
  const byId = new Map<string, JarActivityItem>();
  for (const item of previous) if (item.blockNumber < overlapFrom) byId.set(activityIdentity(item), item);
  for (const item of fresh) byId.set(activityIdentity(item), item);
  return [...byId.values()].sort((a, b) => a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1);
}

export async function loadBlockTimestamps(
  blockNumbers: readonly bigint[],
  cache: Map<string, bigint>,
  cacheKey: (blockNumber: bigint) => string,
  fetchTimestamp: (blockNumber: bigint) => Promise<bigint>,
  concurrency = 3,
) {
  const uniqueMissing = [...new Set(blockNumbers)].filter((blockNumber) => !cache.has(cacheKey(blockNumber)));
  await mapWithConcurrency(uniqueMissing, concurrency, async (blockNumber) => {
    cache.set(cacheKey(blockNumber), await withRateLimitRetry(() => fetchTimestamp(blockNumber)));
  });
}

export function rpcErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const details = "details" in error && typeof error.details === "string" ? error.details : "";
  return `${error.message} ${details}`;
}

export function isRateLimitError(message: string) {
  return /rate limit|too many requests|\b429\b/i.test(message);
}

export function isRangeLimitError(message: string) {
  return /block range|range limit|range too large|requested range|response size|too many results|query returned more than/i.test(message);
}

async function mapWithConcurrency<T>(values: readonly T[], limit: number, task: (value: T) => Promise<void>) {
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next;
      next += 1;
      await task(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), values.length) }, worker));
}

function activityIdentity(item: JarActivityItem) {
  return `${item.transactionHash ?? "milestone"}:${item.logIndex}`;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
