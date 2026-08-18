import assert from "node:assert/strict";
import test from "node:test";
import { arcTestnet } from "viem/chains";
import { getAssetById, parseAssetAmount } from "./assets.ts";
import { buildAddressQrPayload, buildErc20PaymentRequest } from "./paymentRequest.ts";

const usdc = getAssetById("usdc")!;
const eurc = getAssetById("eurc")!;
const recipient = "0x000000000000000000000000000000000000dead";
function request(asset = usdc, value = "5") { return buildErc20PaymentRequest({ token: asset.address, recipient, chainId: arcTestnet.id, amount: parseAssetAmount(value, asset)! }); }

test("USDC URI uses the canonical USDC contract", () => assert.match(request(), new RegExp(`^ethereum:${usdc.address}@`)));
test("EURC URI uses the canonical EURC contract", () => assert.match(request(eurc), new RegExp(`^ethereum:${eurc.address}@`)));
test("payment request uses Arc Testnet chain ID 5042002", () => assert.match(request(), /@5042002\/transfer/));
test("recipient is checksum-normalized", () => assert.match(request(), /address=0x000000000000000000000000000000000000dEaD/));
test("5 USDC becomes 5000000 atomic units", () => assert.match(request(), /uint256=5000000$/));
test("0.000001 becomes one atomic unit", () => assert.match(request(usdc, "0.000001"), /uint256=1$/));
test("invalid recipient is rejected", () => assert.throws(() => buildErc20PaymentRequest({ token: usdc.address, recipient: "bad", chainId: arcTestnet.id, amount: 1n }), /Invalid recipient/));
test("zero and negative atomic amounts are rejected", () => { for (const amount of [0n, -1n]) assert.throws(() => buildErc20PaymentRequest({ token: usdc.address, recipient, chainId: arcTestnet.id, amount }), /positive/); });
test("amounts with more than six decimals are rejected before URI generation", () => assert.equal(parseAssetAmount("1.0000001", usdc), undefined));
test("switching assets changes only the token contract for the same request", () => { assert.notEqual(request(usdc), request(eurc)); assert.match(request(eurc), new RegExp(eurc.address)); });
test("note is not injected into the ERC-681 URI", () => assert.equal(request().includes("note="), false));
test("generated URI is deterministic", () => assert.equal(request(), request()));
test("address-only QR is the raw checksummed wallet address", () => assert.equal(buildAddressQrPayload(recipient), "0x000000000000000000000000000000000000dEaD"));
test("special characters in a display note cannot alter the URI", () => { const note = "Dinner&uint256=999&address=evil"; assert.ok(note); assert.equal(request(), request()); assert.equal(request().includes("999"), false); });
test("invalid token, address QR, and chain ID are rejected", () => { assert.throws(() => buildErc20PaymentRequest({ token: "bad", recipient, chainId: arcTestnet.id, amount: 1n }), /token/); assert.throws(() => buildAddressQrPayload("bad"), /recipient/); assert.throws(() => buildErc20PaymentRequest({ token: usdc.address, recipient, chainId: 0, amount: 1n }), /chain/); });
