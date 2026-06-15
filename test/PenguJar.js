const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🏺 Thử nghiệm Hũ Tiết Kiệm PenguJar", function () {
  let mockUSDC, penguJar;
  let owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // 1. Triển khai token USDC giả lập
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    if (mockUSDC.deployed) await mockUSDC.deployed();

    // 2. Triển khai contract PenguJar với địa chỉ USDC giả lập vừa tạo
    const PenguJar = await ethers.getContractFactory("PenguJar");
    const mockUSDCAddress = mockUSDC.address || mockUSDC.target;
    penguJar = await PenguJar.deploy(mockUSDCAddress);
    if (penguJar.deployed) await penguJar.deployed();

    // 3. Tặng cho ví User 100 USDC fake để làm test nạp hũ
    const amountToUser = ethers.utils?.parseUnits ? ethers.utils.parseUnits("100", 6) : ethers.parseUnits("100", 6);
    await mockUSDC.transfer(user.address, amountToUser);
  });

  it("Nạp tiền vào hũ thành công và hệ thống khóa đúng thời gian", async function () {
    const depositAmount = ethers.utils?.parseUnits ? ethers.utils.parseUnits("50", 6) : ethers.parseUnits("50", 6);
    const lockDuration = 60; // Thử nghiệm khóa 1 phút (60 giây)
    const penguJarAddress = penguJar.address || penguJar.target;

    // Bước A: User phải cho phép (Approve) PenguJar rút tiền từ ví của mình
    await mockUSDC.connect(user).approve(penguJarAddress, depositAmount);

    // Bước B: User tiến hành nạp 50 USDC vào hũ tiết kiệm với thời gian khóa 1 phút
    await penguJar.connect(user).deposit(depositAmount, lockDuration);

    // Bước C: Lấy thông tin hũ từ Contract lên để kiểm tra xem chuẩn chưa
    const [amount, unlockTime, timeLeft] = await penguJar.getVaultInfo(user.address);

    expect(amount).to.equal(depositAmount); // Số tiền trong hũ phải đúng bằng 50 USDC
    expect(timeLeft).to.be.above(0);       // Thời gian đếm ngược phải lớn hơn 0
    console.log(`\n✅ Thành công: Đã khóa ${ethers.utils?.formatUnits ? ethers.utils.formatUnits(amount, 6) : ethers.formatUnits(amount, 6)} USDC vào hũ PenguJar!`);
  });
});