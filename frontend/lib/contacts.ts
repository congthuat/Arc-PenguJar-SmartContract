import { getAddress, isAddress, type Address } from "viem";

const CONTACTS_PREFIX = "makoto-wallet:contacts:v1";
const RECENTS_PREFIX = "makoto-wallet:recent-recipients:v1";
export const MAX_CONTACTS = 50;
export const MAX_RECENT_RECIPIENTS = 6;

export type WalletContact = { name: string; address: Address; createdAt: number; updatedAt: number };
export type RecentRecipient = { address: Address; lastUsedAt: number };
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type ContactErrorCode = "invalid-address" | "self" | "empty-name" | "name-too-long" | "limit";
export class ContactError extends Error {
  readonly code: ContactErrorCode;
  constructor(code: ContactErrorCode) { super(code); this.name = "ContactError"; this.code = code; }
}

export function contactsStorageKey(owner: Address, chainId: number) { return `${CONTACTS_PREFIX}:${owner.toLowerCase()}:${chainId}`; }
export function recentRecipientsStorageKey(owner: Address, chainId: number) { return `${RECENTS_PREFIX}:${owner.toLowerCase()}:${chainId}`; }

export function loadContacts(owner: Address, chainId: number, storage = browserStorage()): WalletContact[] {
  return readList(storage, contactsStorageKey(owner, chainId), parseContact, MAX_CONTACTS);
}

export function saveContact(owner: Address, chainId: number, name: string, address: string, storage = browserStorage(), now = Date.now()): WalletContact[] {
  const trimmed = name.trim();
  if (!trimmed) throw new ContactError("empty-name");
  if (trimmed.length > 40) throw new ContactError("name-too-long");
  if (!isAddress(address)) throw new ContactError("invalid-address");
  const normalized = getAddress(address);
  if (normalized.toLowerCase() === owner.toLowerCase()) throw new ContactError("self");
  const contacts = loadContacts(owner, chainId, storage);
  const existing = contacts.findIndex((item) => item.address.toLowerCase() === normalized.toLowerCase());
  if (existing >= 0) contacts[existing] = { ...contacts[existing], name: trimmed, address: normalized, updatedAt: now };
  else {
    if (contacts.length >= MAX_CONTACTS) throw new ContactError("limit");
    contacts.unshift({ name: trimmed, address: normalized, createdAt: now, updatedAt: now });
  }
  writeList(storage, contactsStorageKey(owner, chainId), contacts);
  return contacts;
}

export function deleteContact(owner: Address, chainId: number, address: string, storage = browserStorage()): WalletContact[] {
  const normalized = isAddress(address) ? getAddress(address).toLowerCase() : address.toLowerCase();
  const contacts = loadContacts(owner, chainId, storage).filter((item) => item.address.toLowerCase() !== normalized);
  writeList(storage, contactsStorageKey(owner, chainId), contacts);
  return contacts;
}

export function loadRecentRecipients(owner: Address, chainId: number, storage = browserStorage()): RecentRecipient[] {
  return readList(storage, recentRecipientsStorageKey(owner, chainId), parseRecent, MAX_RECENT_RECIPIENTS);
}

export function recordRecentRecipient(owner: Address, chainId: number, address: string, storage = browserStorage(), now = Date.now()): RecentRecipient[] {
  if (!isAddress(address)) return loadRecentRecipients(owner, chainId, storage);
  const normalized = getAddress(address);
  const records = [{ address: normalized, lastUsedAt: now }, ...loadRecentRecipients(owner, chainId, storage).filter((item) => item.address.toLowerCase() !== normalized.toLowerCase())].slice(0, MAX_RECENT_RECIPIENTS);
  writeList(storage, recentRecipientsStorageKey(owner, chainId), records);
  return records;
}

function parseContact(value: unknown): WalletContact | undefined {
  if (!isRecord(value) || typeof value.name !== "string" || value.name !== value.name.trim() || !value.name || value.name.length > 40 || typeof value.address !== "string" || !isAddress(value.address) || !isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) return undefined;
  return { name: value.name, address: getAddress(value.address), createdAt: value.createdAt, updatedAt: value.updatedAt };
}

function parseRecent(value: unknown): RecentRecipient | undefined {
  if (!isRecord(value) || typeof value.address !== "string" || !isAddress(value.address) || !isTimestamp(value.lastUsedAt)) return undefined;
  return { address: getAddress(value.address), lastUsedAt: value.lastUsedAt };
}

function readList<T>(storage: StorageLike | undefined, key: string, parser: (value: unknown) => T | undefined, maximum: number): T[] {
  try {
    const payload = storage?.getItem(key);
    if (payload == null) return [];
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed) || parsed.length > maximum) return [];
    const records = parsed.map(parser);
    return records.every(Boolean) ? records as T[] : [];
  } catch { return []; }
}

function writeList(storage: StorageLike | undefined, key: string, records: unknown[]) { try { storage?.setItem(key, JSON.stringify(records)); } catch { /* Contacts are optional, non-authoritative local UX data. */ } }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function isTimestamp(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function browserStorage(): StorageLike | undefined { return typeof window === "undefined" ? undefined : window.localStorage; }
