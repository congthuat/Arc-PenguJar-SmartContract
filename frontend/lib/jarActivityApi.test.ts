import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics, pad, toHex, type Hex } from "viem";
import { penguJarV3Abi } from "./abi/penguJarV3.ts";
import { deserializeJarActivityResponse, JAR_ACTIVITY_CONTRACT, JAR_ACTIVITY_DEPLOYMENT_BLOCK, JAR_ACTIVITY_EVENT_TOPICS, loadJarActivity, parseJarActivitySearch } from "./jarActivityApi.ts";

const owner = "0x1111111111111111111111111111111111111111" as const;
const jarTopic = toHex(9n, { size: 32 });
const createdTopic = encodeEventTopics({ abi: penguJarV3Abi, eventName: "JarCreated" })[0];
const depositedTopic = encodeEventTopics({ abi: penguJarV3Abi, eventName: "JarDeposited" })[0];

test("Jar #9 and supported event topics use exact deployed ABI encoding", () => {
  assert.equal(jarTopic, "0x0000000000000000000000000000000000000000000000000000000000000009");
  assert.deepEqual(JAR_ACTIVITY_EVENT_TOPICS, [
    "0xca0f912fc642e60f0efbf79146cf061fb3d691a8f99fa342d94c70c6527cef9c",
    "0x71999135b77cf5a025c05daed5e8fbba8ef93940d8ba49979d61d235f6c6cfa1",
    "0xb7e59cb5cbf89fc3cb6f89c8ea077af2be451d63b40d67010c2b5eaed494982f",
    "0xb054bea83a57ed9be63e9eff09219709e7f0eb60f33554cb1eb07e4834ea9bed",
  ]);
});

test("request validation rejects invalid IDs and arbitrary proxy inputs", () => {
  assert.throws(() => parseJarActivitySearch(new URLSearchParams("jarId=0")), /Invalid jar ID/);
  assert.throws(() => parseJarActivitySearch(new URLSearchParams("jarId=9&rpc=https://evil.example")), /Unsupported/);
  assert.throws(() => parseJarActivitySearch(new URLSearchParams("jarId=9&contract=0x1111111111111111111111111111111111111111")), /Unsupported/);
  assert.deepEqual(parseJarActivitySearch(new URLSearchParams(`jarId=9&fromBlock=${JAR_ACTIVITY_DEPLOYMENT_BLOCK}`)), { jarId: 9n, fromBlock: JAR_ACTIVITY_DEPLOYMENT_BLOCK });
});

test("measured pruned-history failure fails over and normalizes JarCreated plus 0.01 deposit", async () => {
  const calls: { url: string; method: string; params: unknown[] }[] = [];
  const logs = [createdLog(), depositedLog(), depositedLog()];
  const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
    const url = String(input);
    calls.push({ url, ...body });
    if (body.method === "eth_blockNumber") return json({ result: toHex(JAR_ACTIVITY_DEPLOYMENT_BLOCK + 500n) });
    if (body.method === "eth_getLogs" && url === "pruned") return json({ error: { code: 4444, message: "pruned history unavailable" } });
    if (body.method === "eth_getLogs") return json({ result: logs });
    if (body.method === "eth_getBlockByNumber") return json({ result: { timestamp: "0x64" } });
    return json({ error: { code: -32601, message: "unsupported" } }, 400);
  };
  const payload = await loadJarActivity({ jarId: 9n, fetchFn: fetchFn as typeof fetch, endpoints: [{ url: "pruned", maxBlocks: 100_001n }, { url: "working", maxBlocks: 10_000n }] });
  const result = deserializeJarActivityResponse(payload);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items.map(({ type }) => type), ["deposit", "created"]);
  assert.equal(result.items[0].amount, 10_000n);
  assert.equal(result.creationBlock, JAR_ACTIVITY_DEPLOYMENT_BLOCK + 100n);
  assert.equal(calls.some(({ url, method }) => url === "working" && method === "eth_getLogs"), true);
  const filter = calls.find(({ method, url }) => method === "eth_getLogs" && url === "working")?.params[0] as { address: string; topics: unknown[] };
  assert.equal(filter.address, JAR_ACTIVITY_CONTRACT);
  assert.deepEqual(filter.topics, [JAR_ACTIVITY_EVENT_TOPICS, jarTopic]);
});

test("all RPC endpoint failures remain a genuine Activity error", async () => {
  const fetchFn = async () => json({ error: { code: 35, message: "ranges over 10000 blocks are not supported on free plan" } }, 400);
  await assert.rejects(loadJarActivity({ jarId: 9n, fetchFn: fetchFn as typeof fetch, endpoints: [{ url: "failed", maxBlocks: 100_001n }] }), /ranges over 10000 blocks/);
});

test("serialized response validation rejects unsupported event types", () => {
  assert.throws(() => deserializeJarActivityResponse({ lastScannedBlock: "1", items: [{ ...serializedItem(), type: "admin" }] }), /Invalid Jar Activity item/);
});

function createdLog() {
  return { address: JAR_ACTIVITY_CONTRACT, blockNumber: toHex(JAR_ACTIVITY_DEPLOYMENT_BLOCK + 100n), data: encodeAbiParameters([{ type: "string" }, { type: "uint256" }, { type: "uint256" }], ["Jar 9", 1_000_000n, 2_000_000n]), logIndex: "0x0", removed: false, topics: [createdTopic, jarTopic, pad(owner)] as [Hex, ...Hex[]], transactionHash: `0x${"a".repeat(64)}` };
}
function depositedLog() {
  return { address: JAR_ACTIVITY_CONTRACT, blockNumber: toHex(JAR_ACTIVITY_DEPLOYMENT_BLOCK + 101n), data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [10_000n, 10_000n]), logIndex: "0x1", removed: false, topics: [depositedTopic, jarTopic, pad(owner)] as [Hex, ...Hex[]], transactionHash: `0x${"b".repeat(64)}` };
}
function serializedItem() { return { id: "id", type: "created", actor: owner, timestamp: "1", transactionHash: `0x${"a".repeat(64)}`, blockNumber: "1", logIndex: 0 }; }
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } }); }
