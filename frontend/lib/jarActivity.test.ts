import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { JarActivityItem } from "./types.ts";
import { fetchAdaptiveRange, incrementalScanStart, loadBlockTimestamps, mergeActivityOverlap, withRateLimitRetry } from "./jarActivity.ts";

test("fast path requests the full selective range once", async () => {
  const calls: [bigint, bigint][] = [];
  const result = await fetchAdaptiveRange({ fromBlock: 10n, toBlock: 1_000_000n, request: async (from, to) => { calls.push([from, to]); return ["log"]; } });
  assert.deepEqual(result, ["log"]);
  assert.deepEqual(calls, [[10n, 1_000_000n]]);
});

test("range rejection adaptively splits only the rejected range", async () => {
  const calls: [bigint, bigint][] = [];
  const result = await fetchAdaptiveRange({ fromBlock: 1n, toBlock: 8n, request: async (from, to) => { calls.push([from, to]); if (to - from > 3n) throw new Error("block range too large"); return [`${from}-${to}`]; } });
  assert.deepEqual(result, ["1-4", "5-8"]);
  assert.deepEqual(calls, [[1n, 8n], [1n, 4n], [5n, 8n]]);
});

test("rate limits retry with backoff but successful requests have no mandatory wait", async () => {
  let attempts = 0;
  const waits: number[] = [];
  const value = await withRateLimitRetry(async () => { attempts += 1; if (attempts < 3) throw new Error("429 too many requests"); return "ok"; }, async (milliseconds) => { waits.push(milliseconds); });
  assert.equal(value, "ok");
  assert.deepEqual(waits, [600, 1200]);
  waits.length = 0;
  await withRateLimitRetry(async () => "fast", async (milliseconds) => { waits.push(milliseconds); });
  assert.deepEqual(waits, []);
});

test("incremental refresh overlaps safely and replaces overlap logs without duplicates", () => {
  assert.equal(incrementalScanStart(100n, undefined), 100n);
  assert.equal(incrementalScanStart(100n, 150n), 139n);
  assert.equal(incrementalScanStart(100n, 105n), 100n);
  const old = [item("0x01", 120n, 0), item("0x02", 145n, 0)];
  const fresh = [item("0x02", 145n, 0), item("0x03", 151n, 1)];
  assert.deepEqual(mergeActivityOverlap(old, fresh, 139n).map(({ id }) => id), ["0x03-1", "0x02-0", "0x01-0"]);
});

test("timestamps are fetched only for matching uncached blocks with bounded concurrency", async () => {
  const cache = new Map<string, bigint>([["arc:7", 70n]]);
  let active = 0;
  let maximum = 0;
  const fetched: bigint[] = [];
  await loadBlockTimestamps([7n, 8n, 8n, 9n, 10n], cache, (block) => `arc:${block}`, async (block) => { active += 1; maximum = Math.max(maximum, active); fetched.push(block); await Promise.resolve(); active -= 1; return block * 10n; }, 2);
  assert.deepEqual(fetched.sort((left, right) => left < right ? -1 : left > right ? 1 : 0), [8n, 9n, 10n]);
  assert.equal(maximum <= 2, true);
  assert.equal(cache.get("arc:10"), 100n);
});

test("hook contains no mandatory 10000-block scan loop and keeps indexed jar topic", () => {
  const hook = readFileSync(new URL("../hooks/useJarActivity.ts", import.meta.url), "utf8");
  assert.doesNotMatch(hook, /10_000|ACTIVITY_BLOCK_CHUNK/);
  assert.match(hook, /topics:\s*\[eventTopics,\s*jarTopic\]/);
});

function item(hash: string, blockNumber: bigint, logIndex: number): JarActivityItem {
  return { id: `${hash}-${logIndex}`, type: "deposit", actor: "0x1111111111111111111111111111111111111111", amount: 1n, timestamp: blockNumber, transactionHash: hash as `0x${string}`, blockNumber, logIndex };
}
