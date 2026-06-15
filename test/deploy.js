const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("--------------------------------------------------");
  console.log("Đang deploy bằng tài khoản:", deployer.address);

  // 1. Deploy MockUSDC trước để lấy địa chỉ token
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log("🚀 MockUSDC đã deploy tại địa chỉ:", usdcAddress);

  // 2. Deploy PenguJar và truyền địa chỉ MockUSDC vào bản thiết kế (constructor)
  const PenguJar = await ethers.getContractFactory("PenguJar");
  const penguJar = await PenguJar.deploy(usdcAddress);
  await penguJar.waitForDeployment();
  console.log("🚀 PenguJar (Hũ tiết kiệm) đã deploy tại địa chỉ:", await penguJar.getAddress());
  console.log("--------------------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });