const hre = require("hardhat");
const { ARC_TESTNET_USDC_ADDRESS, assertArcTestnet } = require("./arc-testnet");

const SEND_FLAG = "V3_SMOKE_SEND_TRANSACTIONS";

async function main() {
  await assertArcTestnet(hre);
  const address = process.env.PENGUJAR_V3_ADDRESS?.trim();
  if (!address || !hre.ethers.isAddress(address)) throw new Error("Set a valid PENGUJAR_V3_ADDRESS");
  if (await hre.ethers.provider.getCode(address) === "0x") throw new Error("No bytecode at PENGUJAR_V3_ADDRESS");

  const contract = await hre.ethers.getContractAt("PenguJarV3", address);
  const usdc = await contract.USDC();
  if (usdc.toLowerCase() !== ARC_TESTNET_USDC_ADDRESS.toLowerCase()) throw new Error("PenguJarV3 USDC configuration mismatch");
  console.log("PenguJarV3 bytecode and USDC configuration: PASS");

  const inspectJarId = process.env.V3_SMOKE_JAR_ID?.trim();
  if (inspectJarId) {
    const jar = await contract.getJar(BigInt(inspectJarId));
    console.log(`Inspected jar ID: ${inspectJarId}`);
    console.log(`Mode: ${jar.mode === 0n ? "SAFE" : "SHIELDED"}`);
    console.log(`Privacy: ${jar.privacyMode === 0n ? "PUBLIC" : "PRIVATE"}`);
    console.log(`Withdrawal request active: ${jar.withdrawalReadyAt !== 0n ? "YES" : "NO"}`);
    console.log(`Guardian configured: ${jar.guardian !== hre.ethers.ZeroAddress ? "YES" : "NO"}`);
    console.log(`Recovery wallet configured: ${jar.recoveryWallet !== hre.ethers.ZeroAddress ? "YES" : "NO"}`);
  }

  if (process.env[SEND_FLAG] !== "YES") {
    console.log(`Read-only smoke check complete. Set ${SEND_FLAG}=YES only when explicit live creation transactions are approved.`);
    console.log("Transactions sent: 0");
    return;
  }

  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("PRIVATE_KEY is required for transaction smoke checks");
  const guardian = process.env.V3_SMOKE_GUARDIAN?.trim();
  const recovery = process.env.V3_SMOKE_RECOVERY_WALLET?.trim();
  if (!hre.ethers.isAddress(guardian) || !hre.ethers.isAddress(recovery)) throw new Error("Set valid V3_SMOKE_GUARDIAN and V3_SMOKE_RECOVERY_WALLET addresses");
  const identities = new Set([signer.address, guardian, recovery].map((value) => value.toLowerCase()));
  if (identities.size !== 3 || guardian === hre.ethers.ZeroAddress || recovery === hre.ethers.ZeroAddress) throw new Error("Owner, Guardian, and Recovery wallet must be distinct non-zero addresses");
  if (await hre.ethers.provider.getBalance(signer.address) === 0n) throw new Error("Signer has no Arc Testnet native USDC for gas");

  const connected = contract.connect(signer);
  const latest = await hre.ethers.provider.getBlock("latest");
  const unlockTime = BigInt(latest.timestamp + 3600);
  const delay = 3600n;
  const commitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`PenguJar V3 private smoke ${Date.now()}`));
  const calls = [
    ["PUBLIC SAFE", () => connected.createJar("V3 Smoke SAFE", 1_000_000n, unlockTime, 0n)],
    ["PUBLIC SHIELDED", () => connected.createShieldedJar("V3 Smoke SHIELDED", 1_000_000n, unlockTime, 0n, delay)],
    ["PUBLIC GUARDIAN SHIELDED", () => connected.createGuardianShieldedJar("V3 Smoke Guardian", 1_000_000n, unlockTime, 0n, delay, guardian, recovery)],
    ["PRIVATE SAFE", () => connected.createPrivateJar(commitment, unlockTime, 0n)],
    ["PRIVATE GUARDIAN SHIELDED", () => connected.createPrivateGuardianShieldedJar(commitment, unlockTime, 0n, delay, guardian, recovery)],
  ];
  for (const [label, send] of calls) {
    const transaction = await send();
    const receipt = await transaction.wait(1);
    if (!receipt || receipt.status !== 1) throw new Error(`${label} creation failed`);
    console.log(`${label}: PASS (${transaction.hash})`);
  }
  console.log("No deposits, withdrawals, freezes, guardian changes, or owner-recovery transactions were attempted.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
