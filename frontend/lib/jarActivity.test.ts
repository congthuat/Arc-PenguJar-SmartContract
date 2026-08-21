import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { JarActivityItem } from "./types.ts";
import { fetchAdaptiveRange, fetchCompatibleEventLogs, incrementalScanStart, isRangeLimitError, loadBlockTimestamps, mergeActivityOverlap, rpcErrorMessage, withRateLimitRetry } from "./jarActivity.ts";

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

test("provider request to limit the query to blocks triggers adaptive split", async () => {
  assert.equal(isRangeLimitError("please limit the query to 10000 blocks"), true);
  const calls: [bigint, bigint][] = [];
  await fetchAdaptiveRange({ fromBlock: 1n, toBlock: 8n, request: async (from, to) => { calls.push([from, to]); if (to - from > 3n) throw new Error("please limit the query to 4 blocks"); return []; } });
  assert.deepEqual(calls, [[1n, 8n], [1n, 4n], [5n, 8n]]);
});

test("nested Viem provider details preserve range-limit wording", () => {
  const error = Object.assign(new Error("RPC request failed"), { cause: Object.assign(new Error("server error"), { details: "query exceeds maximum block range" }) });
  assert.match(rpcErrorMessage(error), /query exceeds maximum block range/);
  assert.equal(isRangeLimitError(rpcErrorMessage(error)), true);
});

test("ambiguous broad getLogs failure receives one bounded fallback", async () => {
  const calls: [bigint, bigint][] = [];
  const logs = await fetchAdaptiveRange({ fromBlock: 1n, toBlock: 100_001n, request: async (from, to) => { calls.push([from, to]); if (from === 1n && to === 100_001n) throw new Error("eth_getLogs internal error"); return [`${from}-${to}`]; } });
  assert.deepEqual(logs, ["1-50001", "50002-100001"]);
  assert.equal(calls.length, 3);
});

test("bounded ambiguous failure surfaces instead of retrying forever", async () => {
  let calls = 0;
  await assert.rejects(fetchAdaptiveRange({ fromBlock: 1n, toBlock: 100_001n, request: async () => { calls += 1; throw new Error("eth_getLogs internal error"); } }), /internal error/);
  assert.equal(calls, 2);
});

test("known range splitting has a finite depth guard", async () => {
  let calls = 0;
  await assert.rejects(fetchAdaptiveRange({ fromBlock: 1n, toBlock: 8n, splitsRemaining: 1, request: async () => { calls += 1; throw new Error("maximum block range exceeded"); } }), /maximum block range/);
  assert.equal(calls, 2);
});

test("genuine invalid parameter error remains an error", async () => {
  let calls = 0;
  await assert.rejects(fetchAdaptiveRange({ fromBlock: 1n, toBlock: 1_000_000n, request: async () => { calls += 1; throw new Error("invalid params: malformed topic"); } }), /invalid params/);
  assert.equal(calls, 1);
});

test("OR-topic incompatibility falls back per event and deduplicates logs", async () => {
  const calls: string[][] = [];
  const logs = await fetchCompatibleEventLogs({ fromBlock: 1n, toBlock: 10n, eventTopics: ["created", "deposit"], identity: (log) => log.id, request: async (_from, _to, topics) => { calls.push([...topics]); if (topics.length > 1) throw new Error("nested topic arrays are not supported"); return topics[0] === "created" ? [{ id: "same" }, { id: "created" }] : [{ id: "same" }, { id: "deposit" }]; } });
  assert.deepEqual(calls, [["created", "deposit"], ["created"], ["deposit"]]);
  assert.deepEqual(logs.map(({ id }) => id), ["same", "created", "deposit"]);
});

test("retry can recover after a previous provider range failure", async () => {
  let providerReady = false;
  const query = () => fetchAdaptiveRange({ fromBlock: 1n, toBlock: 100_001n, request: async (from, to) => { if (!providerReady || to - from > 60_000n) throw new Error("eth_getLogs internal error"); return [from]; } });
  await assert.rejects(query());
  providerReady = true;
  assert.deepEqual(await query(), [1n, 50_002n]);
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

test("hook delegates to the same-origin API and server keeps indexed jar topic", () => {
  const hook = readFileSync(new URL("../hooks/useJarActivity.ts", import.meta.url), "utf8");
  const api = readFileSync(new URL("./jarActivityApi.ts", import.meta.url), "utf8");
  assert.match(hook, /\/api\/jar-activity/);
  assert.match(api, /topics:\s*\[eventTopics,\s*toHex\(jarId/);
});

function item(hash: string, blockNumber: bigint, logIndex: number): JarActivityItem {
  return { id: `${hash}-${logIndex}`, type: "deposit", actor: "0x1111111111111111111111111111111111111111", amount: 1n, timestamp: blockNumber, transactionHash: hash as `0x${string}`, blockNumber, logIndex };
}
