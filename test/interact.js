// ============================================================
// File: test/interact.js
// Mục đích: Nạp USDC vào hũ PenguJar
// ============================================================

const hre = require("hardhat");

// ✅ Đã dán sẵn 2 địa chỉ contract của bạn
const MOCK_USDC_ADDRESS = "0xDA320F5DBfee3Cb251FAC76150AAD79A7f2c3416";
const PENGU_JAR_ADDRESS = "0xd82b786728C9831f8A7FC9484B8Eda11bD3a9d12";

// 🔧 Cấu hình test
const DEPOSIT_AMOUNT_USDC = "10";   // Nạp 10 USDC
const LOCK_DURATION_SECONDS = 60;   // Khóa 60 giây

async function main() {
  console.log("=========================================");
  console.log("🐧 Nạp USDC vào PenguJar (Hũ tiết kiệm)");
  console.log("=========================================\n");

  // PHẦN 1: Lấy ví
  const [signer] = await hre.ethers.getSigners();
  console.log("👤 Ví:", signer.address);

  const ethBal = await hre.ethers.provider.getBalance(signer.address);
  console.log("💎 ETH (để trả gas):", hre.ethers.formatEther(ethBal), "ETH\n");

  // PHẦN 2: Kết nối 2 contract
  const usdc = await hre.ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS);
  const penguJar = await hre.ethers.getContractAt("PenguJar", PENGU_JAR_ADDRESS);
  console.log("🔗 MockUSDC:", MOCK_USDC_ADDRESS);
  console.log("🔗 PenguJar:", PENGU_JAR_ADDRESS, "\n");

  // PHẦN 3: Quy đổi 10 USDC → đơn vị nhỏ nhất (10 * 10^6 vì USDC có 6 decimals)
  const amount = hre.ethers.parseUnits(DEPOSIT_AMOUNT_USDC, 6);

  // Kiểm tra số dư USDC
  let usdcBal = await usdc.balanceOf(signer.address);
  console.log("💵 USDC trong ví:", hre.ethers.formatUnits(usdcBal, 6), "USDC");

  // Nếu chưa đủ → mint thêm (MockUSDC cho phép ai cũng mint)
  if (usdcBal < amount) {
    console.log("⚠️  Chưa đủ USDC, đang mint thêm...");
    const mintTx = await usdc.mint(signer.address, amount);
    await mintTx.wait();
    usdcBal = await usdc.balanceOf(signer.address);
    console.log("✅ USDC sau khi mint:", hre.ethers.formatUnits(usdcBal, 6), "USDC");
  }

  // PHẦN 4: APPROVE — cho phép PenguJar rút USDC từ ví bạn
  console.log("\n🔓 Đang approve cho PenguJar...");
  const approveTx = await usdc.approve(PENGU_JAR_ADDRESS, amount);
  await approveTx.wait();
  console.log("✅ Approve xong. Tx:", approveTx.hash);

  // PHẦN 5: DEPOSIT — nạp 10 USDC vào hũ, khóa 60s
  console.log(`\n📤 Đang nạp ${DEPOSIT_AMOUNT_USDC} USDC, khóa ${LOCK_DURATION_SECONDS}s...`);
  const depositTx = await penguJar.deposit(amount, LOCK_DURATION_SECONDS);
  console.log("⏳ Tx hash:", depositTx.hash);
  console.log("   🔍 https://sepolia.etherscan.io/tx/" + depositTx.hash);

  const receipt = await depositTx.wait();
  console.log("✅ Đã xác nhận tại block:", receipt.blockNumber);

  // PHẦN 6: Xem thông tin hũ vừa tạo
  const info = await penguJar.getVaultInfo(signer.address);
  console.log("\n🏺 Thông tin hũ của bạn:");
  console.log("   • Số USDC khóa :", hre.ethers.formatUnits(info[0], 6), "USDC");
  console.log("   • Mở khóa lúc  :", new Date(Number(info[1]) * 1000).toLocaleString("vi-VN"));
  console.log("   • Còn lại      :", info[2].toString(), "giây");

  console.log("\n=========================================");
  console.log(`🎉 Nạp xong! Đợi ${LOCK_DURATION_SECONDS}s rồi chạy:`);
  console.log("   npx hardhat run test/withdraw.js --network sepolia");
  console.log("=========================================");
}

main().catch((error) => {
  console.error("❌ LỖI:", error);
  process.exitCode = 1;
});