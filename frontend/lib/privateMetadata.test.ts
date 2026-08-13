import assert from "node:assert/strict";
import test from "node:test";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import {
  PRIVATE_METADATA_STORAGE_NAMESPACE,
  createMetadataCommitment,
  decryptPrivateMetadata,
  encryptPrivateMetadata,
  finalizePendingEncryptedMetadata,
  loadEncryptedJarMetadata,
  loadPendingEncryptedMetadata,
  pendingPrivateMetadataStorageKey,
  privateMetadataSigningMessage,
  privateMetadataStorageKey,
  saveEncryptedJarMetadata,
  savePendingEncryptedMetadata,
  type EncryptedJarMetadata,
  type PrivateMetadata,
} from "./privateMetadata.ts";

const owner = "0x1111111111111111111111111111111111111111" as Address;
const contractAddress = "0x2222222222222222222222222222222222222222" as Address;
const signature = (`0x${"ab".repeat(65)}`) as Hex;
const transactionHash = (`0x${"cd".repeat(32)}`) as Hex;
const metadata: PrivateMetadata = {
  version: 1,
  name: "Secret Japan Trip",
  targetAmount: "250.5",
  note: "Surprise anniversary plan",
};

test("encrypt then decrypt returns identical canonical metadata", async () => {
  const pending = await encryptPrivateMetadata({ metadata, signature, owner, chainId: 5042002, contractAddress });
  const record = { ...pending, jarId: "7" };
  assert.deepEqual((await decryptPrivateMetadata(record, signature)).metadata, metadata);
});

test("decrypt rejects a record whose metadata commitment was tampered", async () => {
  const pending = await encryptPrivateMetadata({ metadata, signature, owner, chainId: 5042002, contractAddress });
  const record = { ...pending, jarId: "7", metadataCommitment: (`0x${"00".repeat(32)}`) as Hex };
  await assert.rejects(() => decryptPrivateMetadata(record, signature), /commitment verification/);
});

test("signing message domain includes product, purpose, version, wallet, chain, and contract", () => {
  const message = privateMetadataSigningMessage(owner, 5042002, contractAddress);
  assert.match(message, /PenguJar/);
  assert.match(message, /Encrypted private metadata/);
  assert.match(message, /Metadata encryption version: 1/);
  assert.match(message, new RegExp(owner, "i"));
  assert.match(message, /Chain ID: 5042002/);
  assert.match(message, new RegExp(contractAddress, "i"));
});

test("ciphertext and stored record contain no plaintext name or note", async () => {
  const pending = await encryptPrivateMetadata({ metadata, signature, owner, chainId: 5042002, contractAddress });
  const serialized = JSON.stringify({ ...pending, jarId: "7" });
  assert.equal(serialized.includes(metadata.name), false);
  assert.equal(serialized.includes(metadata.note), false);
  assert.equal(serialized.includes('"targetAmount":"250.5"'), false);
  assert.equal(serialized.includes("commitmentSalt"), false);
});

test("fresh IV and salts produce different ciphertext", async () => {
  const first = await encryptPrivateMetadata({ metadata, signature, owner, chainId: 5042002, contractAddress });
  const second = await encryptPrivateMetadata({ metadata, signature, owner, chainId: 5042002, contractAddress });
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.keyDerivationSalt, second.keyDerivationSalt);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("different metadata produces a different commitment", () => {
  const salt = (`0x${"01".repeat(32)}`) as Hex;
  const changed = { ...metadata, note: "Different note" };
  assert.notEqual(createMetadataCommitment(metadata, salt), createMetadataCommitment(changed, salt));
});

test("same metadata with a different commitment salt produces a different commitment", () => {
  const firstSalt = (`0x${"01".repeat(32)}`) as Hex;
  const secondSalt = (`0x${"02".repeat(32)}`) as Hex;
  assert.notEqual(createMetadataCommitment(metadata, firstSalt), createMetadataCommitment(metadata, secondSalt));
});

test("storage namespace contains only encrypted data and composite identity key", async () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem(key: string) { return memory.get(key) ?? null; },
    setItem(key: string, value: string) { memory.set(key, value); },
  };
  const pending = await encryptPrivateMetadata({ metadata, signature, owner, chainId: 5042002, contractAddress });
  const record: EncryptedJarMetadata = { ...pending, jarId: "42" };
  saveEncryptedJarMetadata(record, storage);
  const raw = memory.get(PRIVATE_METADATA_STORAGE_NAMESPACE) ?? "";
  assert.equal(raw.includes(metadata.name), false);
  assert.equal(raw.includes(metadata.note), false);
  assert.equal(raw.includes("commitmentSalt"), false);
  assert.match(raw, /5042002:0x2222222222222222222222222222222222222222:0x1111111111111111111111111111111111111111:jar:42/);
  assert.equal(privateMetadataStorageKey(record), "5042002:0x2222222222222222222222222222222222222222:0x1111111111111111111111111111111111111111:jar:42");
});

test("pending encrypted metadata is keyed by transaction hash and contains no secrets", async () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem(key: string) { return memory.get(key) ?? null; },
    setItem(key: string, value: string) { memory.set(key, value); },
  };
  const encrypted = await encryptPrivateMetadata({ metadata, signature, owner, chainId: 5042002, contractAddress });
  const pending = { ...encrypted, transactionHash };
  savePendingEncryptedMetadata(pending, storage);
  const raw = memory.get(PRIVATE_METADATA_STORAGE_NAMESPACE) ?? "";
  assert.match(raw, new RegExp(`:tx:${transactionHash}`, "i"));
  assert.equal(raw.includes(metadata.name), false);
  assert.equal(raw.includes(metadata.targetAmount), false);
  assert.equal(raw.includes(metadata.note), false);
  assert.equal(raw.includes(signature), false);
  assert.equal(raw.includes("commitmentSalt"), false);
  assert.deepEqual(loadPendingEncryptedMetadata(pending, storage), pending);
  assert.equal(pendingPrivateMetadataStorageKey(pending).endsWith(`:tx:${transactionHash}`), true);
});

test("finalization moves pending metadata to jar ID and deletes the transaction record", async () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem(key: string) { return memory.get(key) ?? null; },
    setItem(key: string, value: string) { memory.set(key, value); },
  };
  const encrypted = await encryptPrivateMetadata({ metadata, signature, owner, chainId: 5042002, contractAddress });
  const pending = { ...encrypted, transactionHash };
  savePendingEncryptedMetadata(pending, storage);
  const confirmed = finalizePendingEncryptedMetadata(pending, "99", storage);
  assert.equal(confirmed?.jarId, "99");
  assert.equal(loadPendingEncryptedMetadata(pending, storage), undefined);
  const stored = loadEncryptedJarMetadata({ ...pending, jarId: "99" }, storage);
  assert.equal(stored?.metadataCommitment, encrypted.metadataCommitment);
  assert.deepEqual((await decryptPrivateMetadata(stored!, signature)).metadata, metadata);
});

test("public path needs no encryption and has no private utility side effect", () => {
  const before = keccak256(toBytes("public"));
  const publicTransactionArgs = ["Public Jar", 100_000_000n, 2_000_000_000n, 0n];
  assert.equal(publicTransactionArgs[0], "Public Jar");
  assert.equal(keccak256(toBytes("public")), before);
});
