const hre = require("hardhat");
const {
  ARC_TESTNET_NAME,
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS,
  assertArcTestnet,
} = require("./arc-testnet");

async function main() {
  await assertArcTestnet(hre);
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("PRIVATE_KEY is not configured in the local .env file");
  }

  const factory = await hre.ethers.getContractFactory("PenguJarV2", deployer);
  const penguJar = await factory.deploy(ARC_TESTNET_USDC_ADDRESS);
  const deploymentTransaction = penguJar.deploymentTransaction();
  if (!deploymentTransaction) {
    throw new Error("Deployment transaction was not created");
  }

  const penguJarAddress = await penguJar.getAddress();
  console.log(`Network: ${ARC_TESTNET_NAME}`);
  console.log(`Chain ID: ${ARC_TESTNET_CHAIN_ID}`);
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`PenguJarV2 address: ${penguJarAddress}`);
  console.log(`Deployment transaction hash: ${deploymentTransaction.hash}`);
  console.log(`USDC address: ${ARC_TESTNET_USDC_ADDRESS}`);

  await penguJar.waitForDeployment();
  console.log("Deployment confirmed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
