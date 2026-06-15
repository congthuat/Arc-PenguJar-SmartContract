// File: test/withdraw.js
const hre = require("hardhat");

// ✅ Đã dán sẵn địa chỉ PenguJar của bạn
const PENGU_JAR_ADDRESS = "0xd82b786728C9831f8A7FC9484B8Eda11bD3a9d12";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const penguJar = await hre.ethers.getContractAt("PenguJar", PENGU_JAR_ADDRESS);

  const info = await penguJar.getVaultInfo(signer.address);
  const [amount, unlockTime, timeLeft] = info;

  console.log("🏺 Hũ hiện tại:");
  console.log("   USDC:", hre.ethers.formatUnits(amount, 6));
  console.log("   Còn :", timeLeft.toString(), "giây");

  if (amount === 0n) {
    console.log("⚠️  Hũ trống, không có gì để rút.");
    return;
  }
  if (timeLeft > 0n) {
    console.log(`⏰ Chưa đến giờ. Đợi thêm ${timeLeft}s rồi chạy lại.`);
    return;
  }

  console.log("\n🔓 Đến giờ rồi! Đang rút...");
  const tx = await penguJar.withdraw();
  console.log("⏳ Tx:", tx.hash);
  console.log("   🔍 https://sepolia.etherscan.io/tx/" + tx.hash);
  await tx.wait();
  console.log("✅ Đã rút USDC về ví!");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });