const hre = require("hardhat");
const { ARC_TESTNET_USDC_ADDRESS, assertArcTestnet } = require("./arc-testnet");

async function main() {
  await assertArcTestnet(hre);
  const address = process.env.PENGUJAR_V3_ADDRESS?.trim();
  if (!address || !hre.ethers.isAddress(address)) throw new Error("Set a valid PENGUJAR_V3_ADDRESS");
  const code = await hre.ethers.provider.getCode(address);
  if (code === "0x") throw new Error("No contract bytecode exists at PENGUJAR_V3_ADDRESS");

  await hre.run("verify:verify", {
    address,
    constructorArguments: [ARC_TESTNET_USDC_ADDRESS],
    contract: "contracts/PenguJarV3.sol:PenguJarV3",
  });
  console.log(`ArcScan contract URL: https://testnet.arcscan.app/address/${address}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
