import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { penguJarV3Abi } from "./penguJarV3.ts";

const artifact = JSON.parse(readFileSync("../artifacts/contracts/PenguJarV3.sol/PenguJarV3.json", "utf8"));
const key = (item: { type: string; name?: string }) => `${item.type}:${item.name ?? "constructor"}`;

test("frontend V3 functions and events match the compiled artifact", () => {
  const expected = artifact.abi.filter((item: { type: string }) => item.type === "function" || item.type === "event");
  const actual = penguJarV3Abi.filter((item) => item.type === "function" || item.type === "event");
  const required = expected.filter((item: { name: string }) => !["nextJarId", "MAX_NAME_LENGTH", "MIN_WITHDRAWAL_DELAY", "MAX_WITHDRAWAL_DELAY", "GUARDIAN_FREEZE_RECOVERY_DELAY", "GUARDIAN_CHANGE_DELAY", "OWNER_RECOVERY_DELAY"].includes(item.name));
  assert.deepEqual(actual.map(key).sort(), required.map(key).sort());
  const expectedJar = expected.find((item: { name: string }) => item.name === "getJar").outputs[0].components.map((field: { name: string; type: string }) => [field.name, field.type]);
  const actualJar = actual.find((item) => item.type === "function" && item.name === "getJar")!.outputs[0].components!.map((field) => [field.name, field.type]);
  assert.deepEqual(actualJar, expectedJar);
});
