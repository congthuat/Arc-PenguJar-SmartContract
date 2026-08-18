import assert from "node:assert/strict";
import test from "node:test";
import type { Address } from "viem";
import { ContactError, contactsStorageKey, deleteContact, loadContacts, loadRecentRecipients, MAX_CONTACTS, MAX_RECENT_RECIPIENTS, recentRecipientsStorageKey, recordRecentRecipient, saveContact } from "./contacts.ts";

const owner = "0x0000000000000000000000000000000000000001" as Address;
const otherOwner = "0x0000000000000000000000000000000000000002" as Address;
const recipient = "0x000000000000000000000000000000000000dead";
class MemoryStorage { values = new Map<string, string>(); getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, value: string) { this.values.set(key, value); } }
function expectCode(code: string, action: () => unknown) { assert.throws(action, (error) => error instanceof ContactError && error.code === code); }
function address(index: number) { return `0x${index.toString(16).padStart(40, "0")}`; }

test("valid contact saves with checksum address and trims whitespace", () => { const contacts = saveContact(owner, 5042002, "  Shizu  ", recipient, new MemoryStorage(), 10); assert.equal(contacts[0].name, "Shizu"); assert.equal(contacts[0].address, "0x000000000000000000000000000000000000dEaD"); });
test("invalid address is rejected", () => expectCode("invalid-address", () => saveContact(owner, 5042002, "Shizu", "bad", new MemoryStorage())));
test("empty name is rejected", () => expectCode("empty-name", () => saveContact(owner, 5042002, "   ", recipient, new MemoryStorage())));
test("name over 40 characters is rejected", () => expectCode("name-too-long", () => saveContact(owner, 5042002, "x".repeat(41), recipient, new MemoryStorage())));
test("duplicate address updates instead of duplicating", () => { const storage = new MemoryStorage(); saveContact(owner, 5042002, "Old", recipient, storage, 1); const contacts = saveContact(owner, 5042002, "New", "0x000000000000000000000000000000000000dEaD", storage, 2); assert.equal(contacts.length, 1); assert.deepEqual([contacts[0].name, contacts[0].createdAt, contacts[0].updatedAt], ["New", 1, 2]); });
test("connected wallet cannot be its own contact", () => expectCode("self", () => saveContact(owner, 5042002, "Me", owner, new MemoryStorage())));
test("contacts are isolated by owner and chain", () => { const storage = new MemoryStorage(); saveContact(owner, 5042002, "Shizu", recipient, storage); assert.equal(loadContacts(owner, 5042002, storage).length, 1); assert.equal(loadContacts(otherOwner, 5042002, storage).length, 0); assert.equal(loadContacts(owner, 1, storage).length, 0); assert.match(contactsStorageKey(owner, 5042002), /:0x0000000000000000000000000000000000000001:5042002$/); });
test("malformed JSON and malformed contact objects fail safely", () => { const storage = new MemoryStorage(); storage.setItem(contactsStorageKey(owner, 5042002), "{bad"); assert.deepEqual(loadContacts(owner, 5042002, storage), []); storage.setItem(contactsStorageKey(owner, 5042002), JSON.stringify([{ name: "Bad" }])); assert.deepEqual(loadContacts(owner, 5042002, storage), []); });
test("delete contact works", () => { const storage = new MemoryStorage(); saveContact(owner, 5042002, "Shizu", recipient, storage); assert.deepEqual(deleteContact(owner, 5042002, recipient, storage), []); });
test("maximum 50 contacts is enforced without losing existing contacts", () => { const storage = new MemoryStorage(); for (let index = 10; index < 10 + MAX_CONTACTS; index += 1) saveContact(owner, 5042002, `Contact ${index}`, address(index), storage); expectCode("limit", () => saveContact(owner, 5042002, "Extra", address(999), storage)); assert.equal(loadContacts(owner, 5042002, storage).length, MAX_CONTACTS); });
test("recent recipients deduplicate and newest moves to front", () => { const storage = new MemoryStorage(); recordRecentRecipient(owner, 5042002, address(10), storage, 1); recordRecentRecipient(owner, 5042002, address(11), storage, 2); const records = recordRecentRecipient(owner, 5042002, address(10), storage, 3); assert.deepEqual(records.map((item) => item.address.toLowerCase()), [address(10), address(11)]); assert.equal(records[0].lastUsedAt, 3); });
test("recent recipient list is capped at 6", () => { const storage = new MemoryStorage(); for (let index = 10; index < 20; index += 1) recordRecentRecipient(owner, 5042002, address(index), storage, index); assert.equal(loadRecentRecipients(owner, 5042002, storage).length, MAX_RECENT_RECIPIENTS); assert.match(recentRecipientsStorageKey(owner, 5042002), /:5042002$/); });
test("storage read and write errors do not throw", () => { const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } }; assert.doesNotThrow(() => saveContact(owner, 5042002, "Shizu", recipient, broken)); assert.deepEqual(loadContacts(owner, 5042002, broken), []); assert.doesNotThrow(() => recordRecentRecipient(owner, 5042002, recipient, broken)); });
