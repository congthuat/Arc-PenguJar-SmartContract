import assert from "node:assert/strict";
import test from "node:test";
import { summarizeSavingsJars } from "./savingsSummary.ts";

test("summary keeps zero-progress and partially funded jars active", () => {
  const summary = summarizeSavingsJars([
    { balance: 0n, targetAmount: 100_000_000n, closed: false },
    { balance: 40_000_000n, targetAmount: 100_000_000n, closed: false },
  ]);

  assert.deepEqual(summary, { totalSaved: 40_000_000n, active: 2, completed: 0 });
});

test("summary counts a 100-percent goal-reached jar as completed", () => {
  const summary = summarizeSavingsJars([
    { balance: 100_000_000n, targetAmount: 100_000_000n, closed: false },
  ]);

  assert.deepEqual(summary, { totalSaved: 100_000_000n, active: 0, completed: 1 });
});

test("summary retains closed jars as completed without fabricating saved balance", () => {
  const summary = summarizeSavingsJars([
    { balance: 0n, targetAmount: 100_000_000n, closed: true },
  ]);

  assert.deepEqual(summary, { totalSaved: 0n, active: 0, completed: 1 });
});
