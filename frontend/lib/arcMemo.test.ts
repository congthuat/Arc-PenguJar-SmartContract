import assert from "node:assert/strict";
import test from "node:test";
import { encodeEventTopics, encodeAbiParameters, getAddress, hexToString, parseAbiParameters } from "viem";
import { arcTestnet } from "viem/chains";
import { getAssetById } from "./assets.ts";
import { ARC_MEMO_ADDRESS, arcMemoAbi, buildArcMemoTransfer, buildSendTransaction, decodeInnerTransfer, normalizeMemoNote, verifyMemoEvent } from "./arcMemo.ts";

const sender = getAddress("0x1111111111111111111111111111111111111111");
const recipient = getAddress("0x2222222222222222222222222222222222222222");
const other = getAddress("0x3333333333333333333333333333333333333333");
const usdc = getAssetById("usdc")!, eurc = getAssetById("eurc")!;
const build = (overrides: Partial<Parameters<typeof buildArcMemoTransfer>[0]> = {}) => buildArcMemoTransfer({ sender, token: usdc.address, recipient, amount: 5_000_000n, note: "Dinner", ...overrides });

test("empty and whitespace-only notes return no memo", () => { assert.equal(normalizeMemoNote(""), undefined); assert.equal(normalizeMemoNote("  \n "), undefined); });
test("memo note is trimmed", () => assert.equal(normalizeMemoNote("  Dinner  "), "Dinner"));
test("100 Unicode characters are accepted and 101 rejected", () => { assert.equal(normalizeMemoNote("a".repeat(100))?.length, 100); assert.throws(() => normalizeMemoNote("a".repeat(101)), /100/); });
test("256 UTF-8 bytes are accepted and more than 256 rejected", () => { const exact = `${"€".repeat(85)}a`; assert.equal(normalizeMemoNote(exact), exact); assert.throws(() => normalizeMemoNote("€".repeat(86)), /256/); });
test("Vietnamese and emoji encode and decode as UTF-8", () => { for (const note of ["Tiền ăn tối", "Coffee ☕️"]) { const built = build({ note }); assert.equal(hexToString(built.memoBytes), note); } });
test("official address, chain, function and argument ABI are exact", () => { assert.equal(ARC_MEMO_ADDRESS, "0x5294E9927c3306DcBaDb03fe70b92e01cCede505"); assert.equal(arcTestnet.id, 5042002); const fn = arcMemoAbi.find((item) => item.type === "function")!; assert.equal(fn.name, "memo"); assert.deepEqual(fn.inputs.map((input) => input.type), ["address", "bytes", "bytes32", "bytes"]); assert.equal(arcMemoAbi.some((item) => item.name === "callWithMemo"), false); });
test("USDC and EURC inner transfers preserve recipient and exact bigint", () => { for (const token of [usdc.address, eurc.address]) { const built = build({ token, amount: 9_876_543n }); const decoded = decodeInnerTransfer(built.innerTransferData); assert.equal(built.args[0], token); assert.equal(decoded.functionName, "transfer"); assert.deepEqual(decoded.args, [recipient, 9_876_543n]); } });
test("calldata hash and bytes32 memo ID are deterministic", () => { const a = build(), b = build(); assert.equal(a.callDataHash, b.callDataHash); assert.equal(a.memoId, b.memoId); assert.match(a.memoId, /^0x[0-9a-f]{64}$/); });
test("memo ID changes with recipient, amount, note, and token", () => { const baseline = build().memoId; for (const changed of [build({ recipient: other }), build({ amount: 1n }), build({ note: "Coffee" }), build({ token: eurc.address })]) assert.notEqual(changed.memoId, baseline); });
test("empty note routes directly to ERC20 transfer and note routes to Memo", () => { const direct = buildSendTransaction({ sender, token: usdc.address, recipient, amount: 5n, note: "  " }); assert.equal(direct.address, usdc.address); assert.equal(direct.functionName, "transfer"); assert.deepEqual(direct.args, [recipient, 5n]); const memo = buildSendTransaction({ sender, token: usdc.address, recipient, amount: 5n, note: "Dinner" }); assert.equal(memo.address, ARC_MEMO_ADDRESS); assert.equal(memo.functionName, "memo"); assert.equal(memo.args[0], usdc.address); });

function eventLog(built = build(), overrides: { sender?: typeof sender; target?: typeof recipient; callDataHash?: `0x${string}`; memoId?: `0x${string}`; memoBytes?: `0x${string}` } = {}) {
  const values = { sender: overrides.sender ?? sender, target: overrides.target ?? usdc.address, callDataHash: overrides.callDataHash ?? built.callDataHash, memoId: overrides.memoId ?? built.memoId, memo: overrides.memoBytes ?? built.memoBytes, memoIndex: 7n };
  const topics = encodeEventTopics({ abi: arcMemoAbi, eventName: "Memo", args: { sender: values.sender, target: values.target, memoId: values.memoId } });
  const data = encodeAbiParameters(parseAbiParameters("bytes32 callDataHash, bytes memo, uint256 memoIndex"), [values.callDataHash, values.memo, values.memoIndex]);
  return { address: ARC_MEMO_ADDRESS, topics, data };
}
test("matching Memo event verifies successfully", () => { const built = build(); assert.equal(verifyMemoEvent([eventLog(built)], { ...built, sender, target: usdc.address }), true); });
test("wrong Memo sender, target, calldata hash, ID, and bytes are rejected", () => { const built = build(); const expected = { ...built, sender, target: usdc.address }; const wrongHash = `0x${"f".repeat(64)}` as const; for (const log of [eventLog(built, { sender: other }), eventLog(built, { target: other }), eventLog(built, { callDataHash: wrongHash }), eventLog(built, { memoId: wrongHash }), eventLog(built, { memoBytes: "0x1234" })]) assert.equal(verifyMemoEvent([log], expected), false); });
test("missing Memo event returns unverified safely", () => assert.equal(verifyMemoEvent([], { ...build(), sender, target: usdc.address }), false));
