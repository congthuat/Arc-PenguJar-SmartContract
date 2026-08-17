import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("private metadata decryption remains owner-gated", () => {
  const hook = read("hooks/usePrivateJarMetadata.ts");
  assert.match(hook, /isOwner/);
  assert.match(hook, /if \(!isPrivate \|\| !isOwner/);
});

test("guardian and recovery copy never implies a transfer of Jar funds", () => {
  const panel = read("components/JarSecurityPanel.tsx");
  const create = read("components/CreateJarFlow.tsx");
  assert.match(panel, /does NOT transfer USDC/i);
  assert.match(panel, /does not transfer USDC/i);
  assert.match(create, /cannot withdraw or receive Jar funds/i);
});

test("PUBLIC SAFE and SHIELDED creation remain compatible", () => {
  const create = read("components/CreateJarFlow.tsx");
  assert.match(create, /functionName: "createJar"/);
  assert.match(create, /functionName: "createShieldedJar"/);
  assert.match(create, /functionName: "createGuardianShieldedJar"/);
});

test("V3 app source has no user-facing obsolete test-network label", () => {
  const obsoleteNetwork = /ethereum sepolia|sepolia testnet/i;
  const files = walk(".").filter((path) =>
    /\.(ts|tsx|css|md)$/.test(path)
    && !path.startsWith(join("app", "api"))
    && !path.endsWith("guardianFrontend.test.ts"),
  );
  for (const file of files) assert.equal(obsoleteNetwork.test(read(file)), false, file);
});

function walk(directory: string): string[] {
  return readdirSync(directory).filter((name) => name !== "node_modules" && name !== ".next").flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
