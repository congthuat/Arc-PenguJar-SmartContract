const hre = require("hardhat");
const {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS,
  assertArcTestnet,
} = require("./arc-testnet");

const JAR_NAME = "PenguJar Smoke Test";
const TARGET_AMOUNT = 1_000_000n;
const DEPOSIT_AMOUNT = 100_000n;
const UNLOCK_DELAY_SECONDS = 10 * 60;

async function main() {
  await assertArcTestnet(hre);
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No deployer configured");

  const penguJarAddress = process.env.PENGUJAR_ADDRESS?.trim();
  if (!penguJarAddress || !hre.ethers.isAddress(penguJarAddress)) {
    throw new Error("PENGUJAR_ADDRESS is missing or invalid");
  }

  const code = await hre.ethers.provider.getCode(penguJarAddress);
  if (code === "0x") throw new Error("No bytecode at PENGUJAR_ADDRESS");

  const penguJar = await hre.ethers.getContractAt("PenguJarV2", penguJarAddress, deployer);
  const configuredUsdc = await penguJar.USDC();
  if (configuredUsdc.toLowerCase() !== ARC_TESTNET_USDC_ADDRESS.toLowerCase()) {
    throw new Error("PenguJarV2 USDC configuration mismatch");
  }

  const usdc = new hre.ethers.Contract(
    ARC_TESTNET_USDC_ADDRESS,
    [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function balanceOf(address owner) view returns (uint256)",
    ],
    deployer
  );

  const jarId = await penguJar.nextJarId();
  const contractBalanceBefore = await usdc.balanceOf(penguJarAddress);
  const latestBlock = await hre.ethers.provider.getBlock("latest");
  const unlockTime = BigInt(latestBlock.timestamp + UNLOCK_DELAY_SECONDS);

  const createTx = await penguJar.createJar(
    JAR_NAME,
    TARGET_AMOUNT,
    unlockTime,
    0
  );
  await createTx.wait();

  const createdJar = await penguJar.getJar(jarId);
  if (createdJar.owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Created jar owner mismatch");
  }
  if (createdJar.targetAmount !== TARGET_AMOUNT || createdJar.unlockTime !== unlockTime) {
    throw new Error("Created jar terms mismatch");
  }

  const approvalTx = await usdc.approve(penguJarAddress, DEPOSIT_AMOUNT);
  await approvalTx.wait();

  const depositTx = await penguJar.contributeToJar(jarId, DEPOSIT_AMOUNT);
  await depositTx.wait();

  const jar = await penguJar.getJar(jarId);
  const ownerContribution = await penguJar.getContribution(jarId, deployer.address);
  const totalContributed = await penguJar.getTotalContributed(jarId);
  const contractBalanceAfter = await usdc.balanceOf(penguJarAddress);

  if (jar.owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Owner changed after contribution");
  }
  if (jar.balance !== DEPOSIT_AMOUNT) throw new Error("Jar balance mismatch");
  if (jar.targetAmount !== TARGET_AMOUNT) throw new Error("Jar target mismatch");
  if (jar.unlockTime !== unlockTime) throw new Error("Jar unlock time changed");
  if (ownerContribution !== DEPOSIT_AMOUNT || totalContributed !== DEPOSIT_AMOUNT) {
    throw new Error("Contribution accounting mismatch");
  }
  if (contractBalanceAfter !== contractBalanceBefore + DEPOSIT_AMOUNT) {
    throw new Error("Contract token balance mismatch");
  }

  let timeLockConfirmed = false;
  try {
    await penguJar.withdrawJar.staticCall(jarId);
  } catch (error) {
    const revertData = error.data || error.info?.error?.data || error.error?.data;
    if (revertData) {
      const parsed = penguJar.interface.parseError(revertData);
      timeLockConfirmed = parsed?.name === "JarStillLocked";
    }
  }
  if (!timeLockConfirmed) throw new Error("Expected JarStillLocked was not confirmed");

  const withdrawalData = penguJar.interface.encodeFunctionData("withdrawJar", [jarId]);
  const withdrawalTx = await deployer.sendTransaction({
    to: penguJarAddress,
    data: withdrawalData,
    gasLimit: 200_000,
  });

  let withdrawalReceipt;
  try {
    withdrawalReceipt = await withdrawalTx.wait();
  } catch (error) {
    withdrawalReceipt = error.receipt;
  }
  if (!withdrawalReceipt || withdrawalReceipt.status !== 0) {
    throw new Error("Pre-unlock withdrawal transaction did not revert as expected");
  }

  const finalJar = await penguJar.getJar(jarId);
  if (finalJar.balance !== DEPOSIT_AMOUNT || finalJar.closed) {
    throw new Error("Reverted withdrawal changed jar state");
  }

  const remainingUsdc = await usdc.balanceOf(deployer.address);
  console.log("Phase 3C: PASS");
  console.log(`Network: Arc Testnet`);
  console.log(`Chain ID: ${ARC_TESTNET_CHAIN_ID}`);
  console.log(`PenguJarV2 address: ${penguJarAddress}`);
  console.log(`Jar ID: ${jarId}`);
  console.log(`Owner: ${jar.owner}`);
  console.log(`Create transaction: ${createTx.hash}`);
  console.log(`Approval transaction: ${approvalTx.hash}`);
  console.log(`Deposit transaction: ${depositTx.hash}`);
  console.log(`Pre-unlock withdrawal transaction: ${withdrawalTx.hash}`);
  console.log(`Target raw USDC: ${TARGET_AMOUNT}`);
  console.log(`Deposited raw USDC: ${DEPOSIT_AMOUNT}`);
  console.log(`Jar balance raw USDC: ${finalJar.balance}`);
  console.log(`Unlock timestamp: ${unlockTime}`);
  console.log("Pre-unlock withdrawal test: PASS (JarStillLocked)");
  console.log("Contract accounting check: PASS");
  console.log(`Remaining testnet USDC: ${hre.ethers.formatUnits(remainingUsdc, 6)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
