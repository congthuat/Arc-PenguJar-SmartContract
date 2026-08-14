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
  if (!deployer) throw new Error("PRIVATE_KEY is not configured for Arc Testnet deployment");

  const gasBalance = await hre.ethers.provider.getBalance(deployer.address);
  if (gasBalance === 0n) {
    throw new Error("Deployer has no Arc Testnet native USDC balance for gas");
  }

  const factory = await hre.ethers.getContractFactory("PenguJarV3", deployer);
  const contract = await factory.deploy(ARC_TESTNET_USDC_ADDRESS);
  const transaction = contract.deploymentTransaction();
  if (!transaction) throw new Error("Deployment transaction was not created");

  console.log(`Network: ${ARC_TESTNET_NAME}`);
  console.log(`Chain ID: ${ARC_TESTNET_CHAIN_ID}`);
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Deployer native USDC available for gas: ${hre.ethers.formatEther(gasBalance)}`);
  console.log(`Deployment transaction hash: ${transaction.hash}`);
  console.log(`Constructor USDC address: ${ARC_TESTNET_USDC_ADDRESS}`);

  await contract.waitForDeployment();
  const receipt = await transaction.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error("Deployment was not confirmed successfully");
  const address = await contract.getAddress();
  console.log(`PenguJarV3 address: ${address}`);
  console.log(`Deployment block number: ${receipt.blockNumber}`);
  console.log(`ArcScan contract URL: https://testnet.arcscan.app/address/${address}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
