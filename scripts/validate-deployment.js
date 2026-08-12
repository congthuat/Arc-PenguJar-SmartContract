const hre = require("hardhat");
const {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
} = require("./arc-testnet");

async function main() {
  const arcConfig = hre.config.networks.arcTestnet;
  if (!arcConfig) throw new Error("arcTestnet is missing from Hardhat configuration");
  if (arcConfig.chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(`Expected Arc Testnet chain ID ${ARC_TESTNET_CHAIN_ID}`);
  }
  if (arcConfig.url !== (process.env.ARC_TESTNET_RPC_URL?.trim() || ARC_TESTNET_RPC_URL)) {
    throw new Error("Arc Testnet RPC configuration does not match the expected environment value");
  }

  const artifact = await hre.artifacts.readArtifact("PenguJarV2");
  const constructor = artifact.abi.find((item) => item.type === "constructor");
  if (!constructor || constructor.inputs.length !== 1 || constructor.inputs[0].type !== "address") {
    throw new Error("PenguJarV2 constructor is not the expected single address argument");
  }

  const factory = await hre.ethers.getContractFactory("PenguJarV2");
  const transaction = await factory.getDeployTransaction(ARC_TESTNET_USDC_ADDRESS);
  if (!transaction.data || transaction.data === "0x") {
    throw new Error("Unable to encode the PenguJarV2 deployment transaction");
  }

  console.log("Arc Testnet Hardhat configuration: valid");
  console.log(`Chain ID: ${ARC_TESTNET_CHAIN_ID}`);
  console.log(`RPC URL: ${arcConfig.url}`);
  console.log(`USDC constructor argument: ${ARC_TESTNET_USDC_ADDRESS}`);
  console.log("Deployment transaction encoding: valid");
  console.log("Broadcast performed: no");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
