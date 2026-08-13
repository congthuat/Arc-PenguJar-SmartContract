import {
  encodeAbiParameters,
  getAddress,
  hexToBytes,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";

export const PRIVATE_METADATA_VERSION = 1 as const;
export const PRIVATE_METADATA_STORAGE_NAMESPACE = "pengujar:v3:private-metadata:v1";

export type PrivateMetadata = {
  version: typeof PRIVATE_METADATA_VERSION;
  name: string;
  targetAmount: string;
  note: string;
};

type EncryptedMetadataBase = {
  version: typeof PRIVATE_METADATA_VERSION;
  owner: Address;
  chainId: number;
  contractAddress: Address;
  ciphertext: string;
  iv: string;
  keyDerivationSalt: string;
  metadataCommitment: Hex;
};

export type EncryptedJarMetadata = EncryptedMetadataBase & { jarId: string };
export type EncryptedPendingMetadata = EncryptedMetadataBase & { transactionHash: Hex };
export type PendingEncryptedMetadata = EncryptedMetadataBase;
export type DecryptedPrivateMetadata = {
  metadata: PrivateMetadata;
  commitmentSalt: Hex;
};

type StoredMetadataRecord = EncryptedJarMetadata | EncryptedPendingMetadata;
type MetadataStorage = Pick<Storage, "getItem" | "setItem">;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function canonicalizePrivateMetadata(metadata: PrivateMetadata): string {
  return JSON.stringify({
    version: PRIVATE_METADATA_VERSION,
    name: metadata.name,
    targetAmount: metadata.targetAmount,
    note: metadata.note,
  });
}

export function privateMetadataSigningMessage(
  owner: Address,
  chainId: number,
  contractAddress: Address,
): string {
  return [
    "PenguJar",
    "Encrypted private metadata",
    `Metadata encryption version: ${PRIVATE_METADATA_VERSION}`,
    `Wallet address: ${getAddress(owner)}`,
    `Chain ID: ${chainId}`,
    `Contract address: ${getAddress(contractAddress)}`,
    "This signature derives a local encryption key. It does not authorize a transaction.",
  ].join("\n");
}

export function randomBytes(length: number): Uint8Array {
  const value = new Uint8Array(length);
  globalThis.crypto.getRandomValues(value);
  return value;
}

export function createMetadataCommitment(metadata: PrivateMetadata, commitmentSalt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes32" }],
      [stringToHex(canonicalizePrivateMetadata(metadata)), commitmentSalt],
    ),
  );
}

export async function encryptPrivateMetadata({
  metadata,
  signature,
  owner,
  chainId,
  contractAddress,
}: {
  metadata: PrivateMetadata;
  signature: Hex;
  owner: Address;
  chainId: number;
  contractAddress: Address;
}): Promise<PendingEncryptedMetadata> {
  const iv = randomBytes(12);
  const keyDerivationSalt = randomBytes(32);
  const commitmentSalt = bytesToHex(randomBytes(32));
  const metadataCommitment = createMetadataCommitment(metadata, commitmentSalt);
  const normalizedContract = getAddress(contractAddress);
  const key = await deriveEncryptionKey(
    signature,
    keyDerivationSalt,
    owner,
    chainId,
    normalizedContract,
  );
  const encryptedPayload = JSON.stringify({ metadata, commitmentSalt });
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoder.encode(encryptedPayload)),
  );

  return {
    version: PRIVATE_METADATA_VERSION,
    owner: getAddress(owner),
    chainId,
    contractAddress: normalizedContract,
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    keyDerivationSalt: bytesToBase64(keyDerivationSalt),
    metadataCommitment,
  };
}

export async function decryptPrivateMetadata(
  record: EncryptedJarMetadata,
  signature: Hex,
): Promise<DecryptedPrivateMetadata> {
  const key = await deriveEncryptionKey(
    signature,
    base64ToBytes(record.keyDerivationSalt),
    record.owner,
    record.chainId,
    record.contractAddress,
  );
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(record.iv)) },
    key,
    toArrayBuffer(base64ToBytes(record.ciphertext)),
  );
  const parsed = JSON.parse(decoder.decode(plaintext)) as Partial<DecryptedPrivateMetadata>;
  const metadata = parsed.metadata;
  if (
    metadata?.version !== PRIVATE_METADATA_VERSION ||
    typeof metadata.name !== "string" ||
    typeof metadata.targetAmount !== "string" ||
    typeof metadata.note !== "string" ||
    typeof parsed.commitmentSalt !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(parsed.commitmentSalt)
  ) {
    throw new Error("Invalid private metadata payload.");
  }
  const commitmentSalt = parsed.commitmentSalt as Hex;
  if (createMetadataCommitment(metadata, commitmentSalt).toLowerCase() !== record.metadataCommitment.toLowerCase()) {
    throw new Error("Decrypted metadata failed commitment verification.");
  }
  return { metadata, commitmentSalt };
}

export function privateMetadataStorageKey({
  chainId,
  contractAddress,
  owner,
  jarId,
}: Pick<EncryptedJarMetadata, "chainId" | "contractAddress" | "owner" | "jarId">): string {
  return `${storageIdentity(chainId, contractAddress, owner)}:jar:${jarId}`;
}

export function pendingPrivateMetadataStorageKey({
  chainId,
  contractAddress,
  owner,
  transactionHash,
}: Pick<EncryptedPendingMetadata, "chainId" | "contractAddress" | "owner" | "transactionHash">): string {
  return `${storageIdentity(chainId, contractAddress, owner)}:tx:${transactionHash.toLowerCase()}`;
}

export function saveEncryptedJarMetadata(
  record: EncryptedJarMetadata,
  storage: MetadataStorage = localStorage,
): void {
  const records = readStorage(storage);
  records[privateMetadataStorageKey(record)] = record;
  writeStorage(records, storage);
}

export function loadEncryptedJarMetadata(
  identity: Pick<EncryptedJarMetadata, "chainId" | "contractAddress" | "owner" | "jarId">,
  storage: Pick<Storage, "getItem"> = localStorage,
): EncryptedJarMetadata | undefined {
  return readStorage(storage)[privateMetadataStorageKey(identity)] as EncryptedJarMetadata | undefined;
}

export function savePendingEncryptedMetadata(
  record: EncryptedPendingMetadata,
  storage: MetadataStorage = localStorage,
): void {
  const records = readStorage(storage);
  records[pendingPrivateMetadataStorageKey(record)] = record;
  writeStorage(records, storage);
}

export function loadPendingEncryptedMetadata(
  identity: Pick<EncryptedPendingMetadata, "chainId" | "contractAddress" | "owner" | "transactionHash">,
  storage: Pick<Storage, "getItem"> = localStorage,
): EncryptedPendingMetadata | undefined {
  return readStorage(storage)[pendingPrivateMetadataStorageKey(identity)] as EncryptedPendingMetadata | undefined;
}

export function finalizePendingEncryptedMetadata(
  identity: Pick<EncryptedPendingMetadata, "chainId" | "contractAddress" | "owner" | "transactionHash">,
  jarId: string,
  storage: MetadataStorage = localStorage,
): EncryptedJarMetadata | undefined {
  const records = readStorage(storage);
  const pendingKey = pendingPrivateMetadataStorageKey(identity);
  const pending = records[pendingKey] as EncryptedPendingMetadata | undefined;
  if (!pending) return undefined;
  const confirmed: EncryptedJarMetadata = {
    version: pending.version,
    owner: pending.owner,
    chainId: pending.chainId,
    contractAddress: pending.contractAddress,
    ciphertext: pending.ciphertext,
    iv: pending.iv,
    keyDerivationSalt: pending.keyDerivationSalt,
    metadataCommitment: pending.metadataCommitment,
    jarId,
  };
  records[privateMetadataStorageKey(confirmed)] = confirmed;
  delete records[pendingKey];
  writeStorage(records, storage);
  return confirmed;
}

async function deriveEncryptionKey(
  signature: Hex,
  salt: Uint8Array,
  owner: Address,
  chainId: number,
  contractAddress: Address,
): Promise<CryptoKey> {
  const signatureMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(hexToBytes(signature)),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(encoder.encode(privateMetadataSigningMessage(owner, chainId, contractAddress))),
    },
    signatureMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function storageIdentity(chainId: number, contractAddress: Address, owner: Address): string {
  return `${chainId}:${getAddress(contractAddress).toLowerCase()}:${getAddress(owner).toLowerCase()}`;
}

function readStorage(storage: Pick<Storage, "getItem">): Record<string, StoredMetadataRecord> {
  const raw = storage.getItem(PRIVATE_METADATA_STORAGE_NAMESPACE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorage(records: Record<string, StoredMetadataRecord>, storage: Pick<Storage, "setItem">): void {
  storage.setItem(PRIVATE_METADATA_STORAGE_NAMESPACE, JSON.stringify(records));
}

function bytesToHex(value: Uint8Array): Hex {
  return `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function bytesToBase64(value: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(value).toString("base64");
  let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}
