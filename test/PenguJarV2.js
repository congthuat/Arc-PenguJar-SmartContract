const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PenguJarV2", function () {
  const usdc = (value) => ethers.parseUnits(value, 6);

  let token;
  let penguJar;
  let deployer;
  let owner;
  let other;

  async function futureTimestamp(offset = 3600) {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + offset;
  }

  async function createJar({
    signer = owner,
    name = "Da Lat Trip",
    target = usdc("500"),
    unlockTime,
    initialDeposit = 0n,
  } = {}) {
    const unlock = unlockTime ?? (await futureTimestamp());
    if (initialDeposit > 0n) {
      await token.connect(signer).approve(await penguJar.getAddress(), initialDeposit);
    }
    await penguJar.connect(signer).createJar(name, target, unlock, initialDeposit);
    return { jarId: (await penguJar.nextJarId()) - 1n, unlockTime: unlock };
  }

  beforeEach(async function () {
    [deployer, owner, other] = await ethers.getSigners();

    token = await ethers.deployContract("MockUSDC");
    penguJar = await ethers.deployContract("PenguJarV2", [await token.getAddress()]);

    await token.transfer(owner.address, usdc("1000"));
    await token.transfer(other.address, usdc("1000"));
  });

  it("creates an empty jar with immutable terms and records its owner", async function () {
    const unlockTime = await futureTimestamp();

    await expect(
      penguJar.connect(owner).createJar("New Bike", usdc("2000"), unlockTime, 0)
    )
      .to.emit(penguJar, "JarCreated")
      .withArgs(1, owner.address, "New Bike", usdc("2000"), unlockTime);

    const jar = await penguJar.getJar(1);
    expect(jar.owner).to.equal(owner.address);
    expect(jar.balance).to.equal(0);
    expect(jar.targetAmount).to.equal(usdc("2000"));
    expect(jar.unlockTime).to.equal(unlockTime);
    expect(jar.closed).to.equal(false);
    expect(jar.name).to.equal("New Bike");
    expect(await penguJar.getOwnerJarIds(owner.address)).to.deep.equal([1n]);
  });

  it("creates a jar with an optional starting deposit", async function () {
    const amount = usdc("50");
    const unlockTime = await futureTimestamp();
    await token.connect(owner).approve(await penguJar.getAddress(), amount);

    await expect(
      penguJar.connect(owner).createJar("School", usdc("500"), unlockTime, amount)
    )
      .to.emit(penguJar, "JarDeposited")
      .withArgs(1, owner.address, amount, amount);

    expect((await penguJar.getJar(1)).balance).to.equal(amount);
    expect(await token.balanceOf(await penguJar.getAddress())).to.equal(amount);
  });

  it("rejects invalid creation inputs", async function () {
    const unlockTime = await futureTimestamp();
    const latest = await ethers.provider.getBlock("latest");

    await expect(penguJar.connect(owner).createJar("", 1, unlockTime, 0))
      .to.be.revertedWithCustomError(penguJar, "EmptyName");
    await expect(penguJar.connect(owner).createJar("x".repeat(65), 1, unlockTime, 0))
      .to.be.revertedWithCustomError(penguJar, "NameTooLong")
      .withArgs(65);
    await expect(penguJar.connect(owner).createJar("Jar", 0, unlockTime, 0))
      .to.be.revertedWithCustomError(penguJar, "InvalidTargetAmount");
    await expect(penguJar.connect(owner).createJar("Jar", 1, latest.timestamp, 0))
      .to.be.revertedWithCustomError(penguJar, "InvalidUnlockTime");
    await expect(penguJar.connect(owner).createJar("Jar", 1, latest.timestamp - 1, 0))
      .to.be.revertedWithCustomError(penguJar, "InvalidUnlockTime");
  });

  it("supports multiple isolated jars for one owner", async function () {
    const first = await createJar({ name: "Bike" });
    const second = await createJar({ name: "Trip", target: usdc("300") });
    const amount = usdc("25");
    await token.connect(owner).approve(await penguJar.getAddress(), amount);

    await penguJar.connect(owner).depositToJar(first.jarId, amount);

    expect(await penguJar.getOwnerJarIds(owner.address)).to.deep.equal([1n, 2n]);
    expect((await penguJar.getJar(first.jarId)).balance).to.equal(amount);
    expect((await penguJar.getJar(second.jarId)).balance).to.equal(0);
  });

  it("keeps jars and owner indexes independent across wallets", async function () {
    const ownerJar = await createJar({ signer: owner, name: "Owner Jar" });
    const otherJar = await createJar({ signer: other, name: "Other Jar" });
    const ownerAmount = usdc("12");
    const otherAmount = usdc("34");
    await token.connect(owner).approve(await penguJar.getAddress(), ownerAmount);
    await token.connect(other).approve(await penguJar.getAddress(), otherAmount);

    await penguJar.connect(owner).depositToJar(ownerJar.jarId, ownerAmount);
    await penguJar.connect(other).depositToJar(otherJar.jarId, otherAmount);

    expect(await penguJar.getOwnerJarIds(owner.address)).to.deep.equal([ownerJar.jarId]);
    expect(await penguJar.getOwnerJarIds(other.address)).to.deep.equal([otherJar.jarId]);
    expect((await penguJar.getJar(ownerJar.jarId)).owner).to.equal(owner.address);
    expect((await penguJar.getJar(otherJar.jarId)).owner).to.equal(other.address);
    expect((await penguJar.getJar(ownerJar.jarId)).balance).to.equal(ownerAmount);
    expect((await penguJar.getJar(otherJar.jarId)).balance).to.equal(otherAmount);
  });

  it("allows only the owner to add a positive amount before unlock", async function () {
    const { jarId } = await createJar();
    const amount = usdc("20");
    await token.connect(owner).approve(await penguJar.getAddress(), amount);

    await expect(penguJar.connect(owner).depositToJar(jarId, amount))
      .to.emit(penguJar, "JarDeposited")
      .withArgs(jarId, owner.address, amount, amount);
    await expect(penguJar.connect(owner).depositToJar(jarId, 0))
      .to.be.revertedWithCustomError(penguJar, "ZeroAmount");
    await expect(penguJar.connect(other).depositToJar(jarId, amount))
      .to.be.revertedWithCustomError(penguJar, "NotJarOwner");
    await expect(penguJar.connect(owner).depositToJar(999, amount))
      .to.be.revertedWithCustomError(penguJar, "JarNotFound");
  });

  it("blocks deposits and withdrawals at the wrong lifecycle stage", async function () {
    const amount = usdc("40");
    const { jarId, unlockTime } = await createJar({ initialDeposit: amount });

    await expect(penguJar.connect(owner).withdrawJar(jarId))
      .to.be.revertedWithCustomError(penguJar, "JarStillLocked");

    await ethers.provider.send("evm_setNextBlockTimestamp", [unlockTime]);
    await ethers.provider.send("evm_mine");

    await expect(penguJar.connect(owner).depositToJar(jarId, 1))
      .to.be.revertedWithCustomError(penguJar, "JarMatured");
  });

  it("allows only the owner to withdraw the full balance once after unlock", async function () {
    const amount = usdc("75");
    const { jarId, unlockTime } = await createJar({ initialDeposit: amount });

    await expect(penguJar.connect(other).withdrawJar(jarId))
      .to.be.revertedWithCustomError(penguJar, "NotJarOwner");

    await ethers.provider.send("evm_setNextBlockTimestamp", [unlockTime]);
    await ethers.provider.send("evm_mine");
    const balanceBefore = await token.balanceOf(owner.address);

    await expect(penguJar.connect(owner).withdrawJar(jarId))
      .to.emit(penguJar, "JarWithdrawn")
      .withArgs(jarId, owner.address, amount);

    const jar = await penguJar.getJar(jarId);
    expect(jar.balance).to.equal(0);
    expect(jar.closed).to.equal(true);
    expect(await token.balanceOf(owner.address)).to.equal(balanceBefore + amount);
    await expect(penguJar.connect(owner).withdrawJar(jarId))
      .to.be.revertedWithCustomError(penguJar, "JarClosed");
    await expect(penguJar.connect(owner).depositToJar(jarId, 1))
      .to.be.revertedWithCustomError(penguJar, "JarClosed");
  });

  it("keeps aggregate jar accounting consistent through deposits and withdrawal", async function () {
    const unlockTime = await futureTimestamp();
    const firstAmount = usdc("40");
    const topUp = usdc("15");
    const secondAmount = usdc("25");
    const first = await createJar({ name: "First", unlockTime, initialDeposit: firstAmount });
    const second = await createJar({
      signer: other,
      name: "Second",
      unlockTime,
      initialDeposit: secondAmount,
    });
    await token.connect(owner).approve(await penguJar.getAddress(), topUp);
    await penguJar.connect(owner).depositToJar(first.jarId, topUp);

    const firstBalance = (await penguJar.getJar(first.jarId)).balance;
    const secondBalance = (await penguJar.getJar(second.jarId)).balance;
    expect(firstBalance).to.equal(firstAmount + topUp);
    expect(secondBalance).to.equal(secondAmount);
    expect(await token.balanceOf(await penguJar.getAddress())).to.equal(
      firstBalance + secondBalance
    );

    await ethers.provider.send("evm_setNextBlockTimestamp", [unlockTime]);
    await ethers.provider.send("evm_mine");
    await penguJar.connect(owner).withdrawJar(first.jarId);

    expect((await penguJar.getJar(first.jarId)).balance).to.equal(0);
    expect((await penguJar.getJar(second.jarId)).balance).to.equal(secondAmount);
    expect(await token.balanceOf(await penguJar.getAddress())).to.equal(secondAmount);
  });

  it("rejects withdrawal from an empty matured jar", async function () {
    const { jarId, unlockTime } = await createJar();
    await ethers.provider.send("evm_setNextBlockTimestamp", [unlockTime]);
    await ethers.provider.send("evm_mine");

    await expect(penguJar.connect(owner).withdrawJar(jarId))
      .to.be.revertedWithCustomError(penguJar, "EmptyJar");
  });

  it("allows the owner to contribute to their own jar and tracks it separately", async function () {
    const { jarId } = await createJar({ initialDeposit: usdc("10") });
    const contribution = usdc("15");
    await token.connect(owner).approve(await penguJar.getAddress(), contribution);

    await expect(penguJar.connect(owner).contributeToJar(jarId, contribution))
      .to.emit(penguJar, "JarContributed")
      .withArgs(
        jarId,
        owner.address,
        contribution,
        contribution,
        contribution,
        usdc("25")
      );

    expect(await penguJar.getContribution(jarId, owner.address)).to.equal(contribution);
    expect(await penguJar.getTotalContributed(jarId)).to.equal(contribution);
    expect((await penguJar.getJar(jarId)).balance).to.equal(usdc("25"));
    expect((await penguJar.getJar(jarId)).owner).to.equal(owner.address);
  });

  it("tracks repeated contributions from one wallet", async function () {
    const { jarId } = await createJar();
    const first = usdc("7");
    const second = usdc("11");
    await token.connect(other).approve(await penguJar.getAddress(), first + second);

    await penguJar.connect(other).contributeToJar(jarId, first);
    await penguJar.connect(other).contributeToJar(jarId, second);

    expect(await penguJar.getContribution(jarId, other.address)).to.equal(first + second);
    expect(await penguJar.getTotalContributed(jarId)).to.equal(first + second);
    expect((await penguJar.getJar(jarId)).balance).to.equal(first + second);
  });

  it("tracks multiple contributors without changing ownership", async function () {
    const { jarId } = await createJar();
    const ownerContribution = usdc("5");
    const otherContribution = usdc("8");
    const deployerContribution = usdc("13");
    await token.connect(owner).approve(await penguJar.getAddress(), ownerContribution);
    await token.connect(other).approve(await penguJar.getAddress(), otherContribution);
    await token.connect(deployer).approve(await penguJar.getAddress(), deployerContribution);

    await penguJar.connect(owner).contributeToJar(jarId, ownerContribution);
    await penguJar.connect(other).contributeToJar(jarId, otherContribution);
    await penguJar.connect(deployer).contributeToJar(jarId, deployerContribution);

    expect(await penguJar.getContribution(jarId, owner.address)).to.equal(ownerContribution);
    expect(await penguJar.getContribution(jarId, other.address)).to.equal(otherContribution);
    expect(await penguJar.getContribution(jarId, deployer.address)).to.equal(deployerContribution);
    expect(await penguJar.getTotalContributed(jarId)).to.equal(
      ownerContribution + otherContribution + deployerContribution
    );
    const jar = await penguJar.getJar(jarId);
    expect(jar.owner).to.equal(owner.address);
    expect(jar.balance).to.equal(ownerContribution + otherContribution + deployerContribution);
  });

  it("rejects invalid contributions without changing accounting", async function () {
    const { jarId } = await createJar();

    await expect(penguJar.connect(other).contributeToJar(jarId, 0))
      .to.be.revertedWithCustomError(penguJar, "ZeroAmount");
    await expect(penguJar.connect(other).contributeToJar(999, 1))
      .to.be.revertedWithCustomError(penguJar, "JarNotFound");
    await expect(penguJar.connect(other).contributeToJar(jarId, usdc("1")))
      .to.be.revertedWith("MockUSDC: Allowance exceeded");
    const moreThanBalance = usdc("1001");
    await token.connect(other).approve(await penguJar.getAddress(), moreThanBalance);
    await expect(penguJar.connect(other).contributeToJar(jarId, moreThanBalance))
      .to.be.revertedWith("Khong du so du USDC");

    expect(await penguJar.getContribution(jarId, other.address)).to.equal(0);
    expect(await penguJar.getTotalContributed(jarId)).to.equal(0);
    expect((await penguJar.getJar(jarId)).balance).to.equal(0);
    expect(await token.balanceOf(await penguJar.getAddress())).to.equal(0);
  });

  it("blocks contributions at unlock and after the jar is closed", async function () {
    const amount = usdc("20");
    const { jarId, unlockTime } = await createJar({ initialDeposit: amount });
    await token.connect(other).approve(await penguJar.getAddress(), amount);
    await ethers.provider.send("evm_setNextBlockTimestamp", [unlockTime]);
    await ethers.provider.send("evm_mine");

    await expect(penguJar.connect(other).contributeToJar(jarId, amount))
      .to.be.revertedWithCustomError(penguJar, "JarMatured");
    await penguJar.connect(owner).withdrawJar(jarId);
    await expect(penguJar.connect(other).contributeToJar(jarId, amount))
      .to.be.revertedWithCustomError(penguJar, "JarClosed");
  });

  it("prevents contributors and unrelated wallets from withdrawing", async function () {
    const { jarId, unlockTime } = await createJar();
    const contribution = usdc("30");
    await token.connect(other).approve(await penguJar.getAddress(), contribution);
    await penguJar.connect(other).contributeToJar(jarId, contribution);

    await expect(penguJar.connect(owner).withdrawJar(jarId))
      .to.be.revertedWithCustomError(penguJar, "JarStillLocked");
    await ethers.provider.send("evm_setNextBlockTimestamp", [unlockTime]);
    await ethers.provider.send("evm_mine");
    await expect(penguJar.connect(other).withdrawJar(jarId))
      .to.be.revertedWithCustomError(penguJar, "NotJarOwner");
    await expect(penguJar.connect(deployer).withdrawJar(jarId))
      .to.be.revertedWithCustomError(penguJar, "NotJarOwner");
  });

  it("lets the owner withdraw the full combined owner and contributor balance", async function () {
    const initialDeposit = usdc("20");
    const ownerDeposit = usdc("10");
    const contribution = usdc("35");
    const { jarId, unlockTime } = await createJar({ initialDeposit });
    await token.connect(owner).approve(await penguJar.getAddress(), ownerDeposit);
    await penguJar.connect(owner).depositToJar(jarId, ownerDeposit);
    await token.connect(other).approve(await penguJar.getAddress(), contribution);
    await penguJar.connect(other).contributeToJar(jarId, contribution);
    const combined = initialDeposit + ownerDeposit + contribution;

    await ethers.provider.send("evm_setNextBlockTimestamp", [unlockTime]);
    await ethers.provider.send("evm_mine");
    const ownerBalanceBefore = await token.balanceOf(owner.address);
    await penguJar.connect(owner).withdrawJar(jarId);

    expect(await token.balanceOf(owner.address)).to.equal(ownerBalanceBefore + combined);
    expect(await token.balanceOf(await penguJar.getAddress())).to.equal(0);
    expect((await penguJar.getJar(jarId)).balance).to.equal(0);
    expect((await penguJar.getJar(jarId)).closed).to.equal(true);
    expect(await penguJar.getContribution(jarId, other.address)).to.equal(contribution);
    expect(await penguJar.getTotalContributed(jarId)).to.equal(contribution);
  });

  it("keeps multiple shared jars and contract token accounting isolated", async function () {
    const first = await createJar({ name: "First Shared Jar" });
    const second = await createJar({ name: "Second Shared Jar" });
    const otherFirst = usdc("9");
    const otherSecond = usdc("14");
    const deployerSecond = usdc("6");
    await token.connect(other).approve(
      await penguJar.getAddress(),
      otherFirst + otherSecond
    );
    await token.connect(deployer).approve(await penguJar.getAddress(), deployerSecond);

    await penguJar.connect(other).contributeToJar(first.jarId, otherFirst);
    await penguJar.connect(other).contributeToJar(second.jarId, otherSecond);
    await penguJar.connect(deployer).contributeToJar(second.jarId, deployerSecond);

    expect((await penguJar.getJar(first.jarId)).balance).to.equal(otherFirst);
    expect((await penguJar.getJar(second.jarId)).balance).to.equal(
      otherSecond + deployerSecond
    );
    expect(await penguJar.getContribution(first.jarId, other.address)).to.equal(otherFirst);
    expect(await penguJar.getContribution(second.jarId, other.address)).to.equal(otherSecond);
    expect(await penguJar.getContribution(first.jarId, deployer.address)).to.equal(0);
    expect(await penguJar.getContribution(second.jarId, deployer.address)).to.equal(
      deployerSecond
    );
    expect(await penguJar.getTotalContributed(first.jarId)).to.equal(otherFirst);
    expect(await penguJar.getTotalContributed(second.jarId)).to.equal(
      otherSecond + deployerSecond
    );
    expect(await token.balanceOf(await penguJar.getAddress())).to.equal(
      otherFirst + otherSecond + deployerSecond
    );
  });
});
