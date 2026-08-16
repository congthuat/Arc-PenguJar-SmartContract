const hre = require("hardhat");
const { ARC_TESTNET_USDC_ADDRESS, assertArcTestnet } = require("./arc-testnet");

const SEND_FLAG = "V3_SMOKE_SEND_TRANSACTIONS";
const CONFIRM_FLAG = "V3_SMOKE_CONFIRM_CONTRACT";
const EXPECTED_CONTRACT = "0x2d2C30ACe5d1f057C6eC2e2E8219A43355Dd226a";
const ONE_USDC = 1_000_000n;
const ONE_HOUR = 3_600n;

async function main() {
  await assertArcTestnet(hre);
  const address = process.env.PENGUJAR_V3_ADDRESS?.trim();
  if (!address || !hre.ethers.isAddress(address)) throw new Error("Set a valid PENGUJAR_V3_ADDRESS");
  if (address.toLowerCase() !== EXPECTED_CONTRACT.toLowerCase()) throw new Error("PENGUJAR_V3_ADDRESS is not the approved V3 smoke-test contract");
  if (await hre.ethers.provider.getCode(address) === "0x") throw new Error("No bytecode at PENGUJAR_V3_ADDRESS");

  const contract = await hre.ethers.getContractAt("PenguJarV3", address);
  const usdcAddress = await contract.USDC();
  if (usdcAddress.toLowerCase() !== ARC_TESTNET_USDC_ADDRESS.toLowerCase()) throw new Error("PenguJarV3 USDC configuration mismatch");
  console.log("PenguJarV3 bytecode and USDC configuration: PASS");

  if (process.env[SEND_FLAG] !== "YES") {
    console.log(`Read-only smoke check complete. Set ${SEND_FLAG}=YES only when live creation transactions are explicitly approved.`);
    console.log("Transactions sent: 0");
    return;
  }
  if (process.env[CONFIRM_FLAG]?.toLowerCase() !== EXPECTED_CONTRACT.toLowerCase()) {
    throw new Error(`Set ${CONFIRM_FLAG} to the exact approved contract address`);
  }

  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("PRIVATE_KEY is required for transaction smoke checks");
  const deployerBalanceBefore = await hre.ethers.provider.getBalance(signer.address);
  if (deployerBalanceBefore === 0n) throw new Error("Signer has no Arc Testnet native USDC for gas");

  // These wallets are address-only temporary roles. Their private keys are discarded
  // because this smoke test must not perform freeze, recovery, or withdrawal actions.
  const guardian = hre.ethers.Wallet.createRandom().address;
  const recoveryWallet = hre.ethers.Wallet.createRandom().address;
  const identities = new Set([signer.address, guardian, recoveryWallet].map((value) => value.toLowerCase()));
  if (identities.size !== 3 || guardian === hre.ethers.ZeroAddress || recoveryWallet === hre.ethers.ZeroAddress) {
    throw new Error("Temporary Guardian and Recovery wallet addresses are not safely distinct");
  }

  const usdc = new hre.ethers.Contract(
    ARC_TESTNET_USDC_ADDRESS,
    ["function balanceOf(address owner) view returns (uint256)"],
    hre.ethers.provider
  );
  const tokenBalanceBefore = await usdc.balanceOf(address);
  const latest = await hre.ethers.provider.getBlock("latest");
  const unlockTime = BigInt(latest.timestamp) + ONE_HOUR;
  const commitment = hre.ethers.keccak256(hre.ethers.randomBytes(32));
  if (commitment === hre.ethers.ZeroHash) throw new Error("Private metadata commitment is zero");

  const connected = contract.connect(signer);
  const cases = [
    {
      label: "PUBLIC SAFE",
      send: () => connected.createJar("V3 Live Smoke SAFE", ONE_USDC, unlockTime, 0n),
      expected: { mode: 0n, privacyMode: 0n, withdrawalDelay: 0n, guardian: hre.ethers.ZeroAddress, recoveryWallet: hre.ethers.ZeroAddress },
    },
    {
      label: "PUBLIC SHIELDED",
      send: () => connected.createShieldedJar("V3 Live Smoke SHIELDED", ONE_USDC, unlockTime, 0n, ONE_HOUR),
      expected: { mode: 1n, privacyMode: 0n, withdrawalDelay: ONE_HOUR, guardian: hre.ethers.ZeroAddress, recoveryWallet: hre.ethers.ZeroAddress },
    },
    {
      label: "PRIVATE SAFE",
      send: () => connected.createPrivateJar(commitment, unlockTime, 0n),
      expected: { mode: 0n, privacyMode: 1n, withdrawalDelay: 0n, guardian: hre.ethers.ZeroAddress, recoveryWallet: hre.ethers.ZeroAddress, commitment },
    },
    {
      label: "PUBLIC GUARDIAN SHIELDED",
      send: () => connected.createGuardianShieldedJar("V3 Live Smoke Guardian", ONE_USDC, unlockTime, 0n, ONE_HOUR, guardian, recoveryWallet),
      expected: { mode: 1n, privacyMode: 0n, withdrawalDelay: ONE_HOUR, guardian, recoveryWallet },
    },
  ];

  const results = [];
  for (const testCase of cases) {
    const transaction = await testCase.send();
    if (transaction.value !== 0n) throw new Error(`${testCase.label} unexpectedly sends native value`);
    const receipt = await transaction.wait(1);
    if (!receipt || receipt.status !== 1) throw new Error(`${testCase.label} creation failed`);
    const jarId = getCreatedJarId(contract, receipt.logs, signer.address);
    const jar = await contract.getJar(jarId);
    verifyJar(testCase.label, jar, signer.address, testCase.expected);
    results.push({ label: testCase.label, jarId, hash: transaction.hash });
    console.log(`${testCase.label}: PASS`);
    console.log(`Jar ID: ${jarId}`);
    console.log(`Transaction hash: ${transaction.hash}`);
  }

  const [tokenBalanceAfter, deployerBalanceAfter] = await Promise.all([
    usdc.balanceOf(address),
    hre.ethers.provider.getBalance(signer.address),
  ]);
  if (tokenBalanceAfter !== tokenBalanceBefore) throw new Error("PenguJarV3 USDC balance changed during zero-deposit creation smoke test");

  console.log(`Transactions sent: ${results.length}`);
  console.log(`Deployer balance before: ${hre.ethers.formatEther(deployerBalanceBefore)} native USDC`);
  console.log(`Deployer balance after: ${hre.ethers.formatEther(deployerBalanceAfter)} native USDC`);
  console.log(`PenguJarV3 ERC-20 USDC balance unchanged: YES (${hre.ethers.formatUnits(tokenBalanceAfter, 6)} USDC)`);
  console.log("USDC approvals/transfers sent: 0");
  console.log("Withdrawal/freeze/guardian-change/owner-recovery transactions sent: 0");
  console.log("OVERALL LIVE V3 SMOKE TEST: PASS");
}

function getCreatedJarId(contract, logs, expectedOwner) {
  for (const log of logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "JarCreated" && parsed.args.owner.toLowerCase() === expectedOwner.toLowerCase()) return parsed.args.jarId;
    } catch { /* unrelated log */ }
  }
  throw new Error("Confirmed transaction has no matching JarCreated event");
}

function verifyJar(label, jar, owner, expected) {
  const equalAddress = (actual, wanted) => actual.toLowerCase() === wanted.toLowerCase();
  if (!equalAddress(jar.owner, owner)) throw new Error(`${label} owner mismatch`);
  if (jar.mode !== expected.mode) throw new Error(`${label} mode mismatch`);
  if (jar.privacyMode !== expected.privacyMode) throw new Error(`${label} privacy mode mismatch`);
  if (jar.withdrawalDelay !== expected.withdrawalDelay) throw new Error(`${label} withdrawal delay mismatch`);
  if (!equalAddress(jar.guardian, expected.guardian)) throw new Error(`${label} guardian mismatch`);
  if (!equalAddress(jar.recoveryWallet, expected.recoveryWallet)) throw new Error(`${label} recovery wallet mismatch`);
  if (jar.balance !== 0n) throw new Error(`${label} balance is not zero`);
  if (jar.closed) throw new Error(`${label} is unexpectedly closed`);
  if (jar.withdrawalReadyAt !== 0n || jar.frozen) throw new Error(`${label} has unexpected withdrawal security state`);
  if (expected.commitment && jar.metadataCommitment !== expected.commitment) throw new Error(`${label} metadata commitment mismatch`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
