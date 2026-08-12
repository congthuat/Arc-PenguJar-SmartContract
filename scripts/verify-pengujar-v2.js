const hre = require("hardhat");
const {
  ARC_TESTNET_NAME,
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS,
  assertArcTestnet,
} = require("./arc-testnet");

async function main() {
  await assertArcTestnet(hre);
  const penguJarAddress = process.env.PENGUJAR_ADDRESS?.trim();
  if (!penguJarAddress || !hre.ethers.isAddress(penguJarAddress)) {
    throw new Error("Set a valid PENGUJAR_ADDRESS in the local .env file");
  }

  const code = await hre.ethers.provider.getCode(penguJarAddress);
  if (code === "0x") {
    throw new Error(`No contract code found at ${penguJarAddress}`);
  }

  const penguJar = await hre.ethers.getContractAt("PenguJarV2", penguJarAddress);
  const configuredUsdc = await penguJar.USDC();
  if (configuredUsdc.toLowerCase() !== ARC_TESTNET_USDC_ADDRESS.toLowerCase()) {
    throw new Error(
      `USDC constructor value mismatch: expected ${ARC_TESTNET_USDC_ADDRESS}, received ${configuredUsdc}`
    );
  }

  const nextJarId = await penguJar.nextJarId();
  console.log(`Network: ${ARC_TESTNET_NAME}`);
  console.log(`Chain ID: ${ARC_TESTNET_CHAIN_ID}`);
  console.log(`PenguJarV2 address: ${penguJarAddress}`);
  console.log(`USDC address: ${configuredUsdc}`);
  console.log(`Next jar ID: ${nextJarId}`);
  console.log("Read-only deployment verification passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
