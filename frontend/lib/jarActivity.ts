import type { JarActivityItem } from "./types";

export const ACTIVITY_REORG_OVERLAP = 12n;

export async function fetchAdaptiveRange<T>(options: {
  fromBlock: bigint;
  toBlock: bigint;
  request(fromBlock: bigint, toBlock: bigint): Promise<T[]>;
  wait?: (milliseconds: number) => Promise<void>;
  attempts?: number;
  ambiguousFallbacks?: number;
  splitsRemaining?: number;
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
      const canSplit = options.fromBlock < options.toBlock;
      const knownRangeLimit = isRangeLimitError(message);
      const ambiguousFallbacks = options.ambiguousFallbacks ?? 1;
      const splitsRemaining = options.splitsRemaining ?? 20;
      const ambiguousBroadFailure = ambiguousFallbacks > 0 && isAmbiguousGetLogsError(message) && options.toBlock - options.fromBlock >= 50_000n;
      if ((knownRangeLimit || ambiguousBroadFailure) && canSplit && splitsRemaining > 0) {
        const middle = (options.fromBlock + options.toBlock) / 2n;
        const nextAmbiguousFallbacks = knownRangeLimit ? ambiguousFallbacks : ambiguousFallbacks - 1;
        const first = await fetchAdaptiveRange({ ...options, toBlock: middle, ambiguousFallbacks: nextAmbiguousFallbacks, splitsRemaining: splitsRemaining - 1 });
        const second = await fetchAdaptiveRange({ ...options, fromBlock: middle + 1n, ambiguousFallbacks: nextAmbiguousFallbacks, splitsRemaining: splitsRemaining - 1 });
        return [...first, ...second];
      }
      throw error;
    }
  }
  return [];
}

export async function fetchCompatibleEventLogs<T, TTopic>(options: {
  fromBlock: bigint;
  toBlock: bigint;
  eventTopics: readonly TTopic[];
  request(fromBlock: bigint, toBlock: bigint, eventTopics: readonly TTopic[]): Promise<T[]>;
  identity(value: T): string;
}): Promise<T[]> {
  try {
    return await fetchAdaptiveRange({ fromBlock: options.fromBlock, toBlock: options.toBlock, request: (fromBlock, toBlock) => options.request(fromBlock, toBlock, options.eventTopics) });
  } catch (error) {
    if (!isTopicCompatibilityError(rpcErrorMessage(error)) || options.eventTopics.length < 2) throw error;
    const merged = new Map<string, T>();
    for (const eventTopic of options.eventTopics) {
      const logs = await fetchAdaptiveRange({ fromBlock: options.fromBlock, toBlock: options.toBlock, request: (fromBlock, toBlock) => options.request(fromBlock, toBlock, [eventTopic]) });
      for (const log of logs) merged.set(options.identity(log), log);
    }
    return [...merged.values()];
  }
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
  const messages: string[] = [];
  const seen = new Set<unknown>();
  function collect(value: unknown, depth: number) {
    if (value === null || value === undefined || depth > 4 || seen.has(value)) return;
    if (typeof value === "string") { messages.push(value); return; }
    if (typeof value !== "object") return;
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ["message", "shortMessage", "details"]) if (typeof record[key] === "string") messages.push(record[key]);
    if (Array.isArray(record.metaMessages)) for (const message of record.metaMessages) if (typeof message === "string") messages.push(message);
    collect(record.cause, depth + 1);
  }
  collect(error, 0);
  return messages.length > 0 ? messages.join(" ") : String(error);
}

export function isRateLimitError(message: string) {
  return /rate limit|too many requests|\b429\b/i.test(message);
}

export function isRangeLimitError(message: string) {
  return /block range|range limit|range too large|requested range|maximum (?:block )?range|max(?:imum)? range|exceeds? (?:the )?(?:maximum|allowed) (?:block )?range|limited to [\d,]+ blocks|please limit (?:the )?query|too many blocks|log response size (?:limit )?exceeded|response size|too many results|query returned more than|query timeout.{0,40}(?:range|blocks)|(?:range|blocks).{0,40}query timeout/i.test(message);
}

export function isAmbiguousGetLogsError(message: string) {
  if (/invalid (?:param|argument|topic|address)|malformed|method not found|unsupported method|unauthori[sz]ed|forbidden|authentication|api key|network error|failed to fetch|connection (?:failed|refused|reset)|\bdns\b|offline/i.test(message)) return false;
  return /timeout|timed out|internal error|server error|request failed|query failed|eth_getLogs/i.test(message);
}

export function isTopicCompatibilityError(message: string) {
  return /(?:nested|array|or)[ -]?topics?.{0,50}(?:unsupported|not supported|invalid)|(?:unsupported|not supported).{0,50}(?:nested|array|or)[ -]?topics?|topic[ -]?0.{0,30}(?:array|or).{0,30}(?:invalid|unsupported|not supported)/i.test(message);
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
