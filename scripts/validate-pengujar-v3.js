const hre = require("hardhat");
const {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS,
  assertArcTestnet,
} = require("./arc-testnet");

const REQUIRED_FUNCTIONS = [
  "createJar", "createShieldedJar", "createGuardianShieldedJar",
  "createPrivateJar", "createPrivateShieldedJar", "createPrivateGuardianShieldedJar",
  "depositToJar", "contributeToJar", "requestWithdrawal", "cancelWithdrawalRequest",
  "withdrawJar", "freezeWithdrawal", "unfreezeJar", "requestGuardianChange",
  "approveGuardianChange", "cancelGuardianChange", "executeGuardianChange",
  "requestOwnerRecovery", "approveOwnerRecovery", "executeOwnerRecovery",
  "getJar", "getOwnerJarIds", "getContribution", "getTotalContributed", "USDC",
];

async function main() {
  await assertArcTestnet(hre);
  const address = process.env.PENGUJAR_V3_ADDRESS?.trim();
  if (!address || !hre.ethers.isAddress(address)) throw new Error("Set a valid PENGUJAR_V3_ADDRESS");

  const artifact = await hre.artifacts.readArtifact("PenguJarV3");
  const localFunctions = new Set(artifact.abi.filter((item) => item.type === "function").map((item) => item.name));
  const missing = REQUIRED_FUNCTIONS.filter((name) => !localFunctions.has(name));
  if (missing.length) throw new Error(`Local PenguJarV3 ABI is missing: ${missing.join(", ")}`);
  const code = await hre.ethers.provider.getCode(address);
  if (code === "0x") throw new Error("No contract bytecode exists at PENGUJAR_V3_ADDRESS");

  const contract = await hre.ethers.getContractAt("PenguJarV3", address);
  const [usdc, ownerIds, minimumDelay, maximumDelay, freezeDelay, guardianDelay, ownerDelay] = await Promise.all([
    contract.USDC(),
    contract.getOwnerJarIds(hre.ethers.ZeroAddress),
    contract.MIN_WITHDRAWAL_DELAY(),
    contract.MAX_WITHDRAWAL_DELAY(),
    contract.GUARDIAN_FREEZE_RECOVERY_DELAY(),
    contract.GUARDIAN_CHANGE_DELAY(),
    contract.OWNER_RECOVERY_DELAY(),
  ]);
  if (usdc.toLowerCase() !== ARC_TESTNET_USDC_ADDRESS.toLowerCase()) throw new Error("PenguJarV3 USDC configuration mismatch");
  if (!Array.isArray(ownerIds)) throw new Error("getOwnerJarIds did not return an array");
  if ([minimumDelay, maximumDelay, freezeDelay, guardianDelay, ownerDelay].some((value) => value <= 0n)) throw new Error("A required V3 security constant is unavailable");

  console.log("PenguJarV3 read-only validation: PASS");
  console.log(`Chain ID: ${ARC_TESTNET_CHAIN_ID}`);
  console.log(`Contract address: ${address}`);
  console.log(`USDC address: ${usdc}`);
  console.log(`Required local ABI functions: ${REQUIRED_FUNCTIONS.length}/${REQUIRED_FUNCTIONS.length}`);
  console.log("Transactions sent: 0");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
