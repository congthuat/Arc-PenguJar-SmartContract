const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PenguJarV3 adversarial security", function () {
  const SAFE = 0n;
  const SHIELDED = 1n;
  const MIN_DELAY = 60 * 60;
  const MAX_DELAY = 30 * 24 * 60 * 60;
  const usdc = (value) => ethers.parseUnits(value, 6);

  let token;
  let penguJar;
  let deployer;
  let owner;
  let other;
  let attacker;

  async function latestTimestamp() {
    return (await ethers.provider.getBlock("latest")).timestamp;
  }

  async function setNextTimestamp(timestamp) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(timestamp)]);
  }

  async function mineAt(timestamp) {
    await setNextTimestamp(timestamp);
    await ethers.provider.send("evm_mine");
  }

  async function createSafe({
    signer = owner,
    name = "Safe Jar",
    unlockTime,
    amount = usdc("10"),
  } = {}) {
    const unlock = unlockTime ?? ((await latestTimestamp()) + 10_000);
    if (amount > 0n) {
      await token.connect(signer).approve(await penguJar.getAddress(), amount);
    }
    await penguJar.connect(signer).createJar(name, usdc("100"), unlock, amount);
    return { jarId: (await penguJar.nextJarId()) - 1n, unlockTime: unlock, amount };
  }

  async function createShielded({
    signer = owner,
    name = "Shielded Jar",
    unlockTime,
    amount = usdc("10"),
    delay = MIN_DELAY,
  } = {}) {
    const unlock = unlockTime ?? ((await latestTimestamp()) + 10_000);
    if (amount > 0n) {
      await token.connect(signer).approve(await penguJar.getAddress(), amount);
    }
    await penguJar
      .connect(signer)
      .createShieldedJar(name, usdc("100"), unlock, amount, delay);
    return {
      jarId: (await penguJar.nextJarId()) - 1n,
      unlockTime: unlock,
      amount,
      delay,
    };
  }

  async function requestAtUnlock(jarId, unlockTime, signer = owner) {
    await setNextTimestamp(unlockTime);
    const tx = await penguJar.connect(signer).requestWithdrawal(jarId);
    const receipt = await tx.wait();
    const requestedAt = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
    return { requestedAt, readyAt: Number((await penguJar.getJar(jarId)).withdrawalReadyAt) };
  }

  beforeEach(async function () {
    [deployer, owner, other, attacker] = await ethers.getSigners();
    token = await ethers.deployContract("MockUSDC");
    penguJar = await ethers.deployContract("PenguJarV3", [await token.getAddress()]);

    for (const signer of [owner, other, attacker]) {
      await token.transfer(signer.address, usdc("1000"));
    }
  });

  describe("creation and security configuration", function () {
    it("creates SAFE mode through the compatible createJar API and emits delay zero", async function () {
      const unlockTime = (await latestTimestamp()) + 10_000;

      await expect(
        penguJar.connect(owner).createJar("Safe", usdc("100"), unlockTime, 0)
      )
        .to.emit(penguJar, "JarSecurityConfigured")
        .withArgs(1, SAFE, 0);

      const jar = await penguJar.getJar(1);
      expect(jar.mode).to.equal(SAFE);
      expect(jar.withdrawalDelay).to.equal(0);
      expect(jar.withdrawalReadyAt).to.equal(0);
    });

    it("creates SHIELDED mode and emits its configured delay", async function () {
      const unlockTime = (await latestTimestamp()) + 10_000;

      await expect(
        penguJar
          .connect(owner)
          .createShieldedJar("Shielded", usdc("100"), unlockTime, 0, MIN_DELAY)
      )
        .to.emit(penguJar, "JarSecurityConfigured")
        .withArgs(1, SHIELDED, MIN_DELAY);

      const jar = await penguJar.getJar(1);
      expect(jar.mode).to.equal(SHIELDED);
      expect(jar.withdrawalDelay).to.equal(MIN_DELAY);
      expect(jar.withdrawalReadyAt).to.equal(0);
    });

    it("rejects delays below one hour with the supplied bounds", async function () {
      const unlockTime = (await latestTimestamp()) + 10_000;
      await expect(
        penguJar
          .connect(owner)
          .createShieldedJar("Too short", 1, unlockTime, 0, MIN_DELAY - 1)
      )
        .to.be.revertedWithCustomError(penguJar, "InvalidWithdrawalDelay")
        .withArgs(MIN_DELAY - 1, MIN_DELAY, MAX_DELAY);
    });

    it("rejects delays above thirty days with the supplied bounds", async function () {
      const unlockTime = (await latestTimestamp()) + 10_000;
      await expect(
        penguJar
          .connect(owner)
          .createShieldedJar("Too long", 1, unlockTime, 0, MAX_DELAY + 1)
      )
        .to.be.revertedWithCustomError(penguJar, "InvalidWithdrawalDelay")
        .withArgs(MAX_DELAY + 1, MIN_DELAY, MAX_DELAY);
    });

    it("accepts exactly the one-hour minimum", async function () {
      const { jarId } = await createShielded({ amount: 0n, delay: MIN_DELAY });
      expect((await penguJar.getJar(jarId)).withdrawalDelay).to.equal(MIN_DELAY);
    });

    it("accepts exactly the thirty-day maximum", async function () {
      const { jarId } = await createShielded({ amount: 0n, delay: MAX_DELAY });
      expect((await penguJar.getJar(jarId)).withdrawalDelay).to.equal(MAX_DELAY);
    });
  });

  describe("SAFE withdrawal protection", function () {
    it("blocks the owner before unlock without changing funds or jar state", async function () {
      const { jarId, unlockTime, amount } = await createSafe();
      const contractBefore = await token.balanceOf(await penguJar.getAddress());

      await expect(penguJar.connect(owner).withdrawJar(jarId))
        .to.be.revertedWithCustomError(penguJar, "JarStillLocked")
        .withArgs(jarId, unlockTime);

      const jar = await penguJar.getJar(jarId);
      expect(jar.balance).to.equal(amount);
      expect(jar.closed).to.equal(false);
      expect(jar.withdrawalReadyAt).to.equal(0);
      expect(await token.balanceOf(await penguJar.getAddress())).to.equal(contractBefore);
    });

    it("withdraws exactly at unlock without a withdrawal request", async function () {
      const { jarId, unlockTime, amount } = await createSafe();
      const ownerBefore = await token.balanceOf(owner.address);
      await setNextTimestamp(unlockTime);

      await expect(penguJar.connect(owner).withdrawJar(jarId))
        .to.emit(penguJar, "JarWithdrawn")
        .withArgs(jarId, owner.address, amount);

      expect(await token.balanceOf(owner.address)).to.equal(ownerBefore + amount);
      expect((await penguJar.getJar(jarId)).closed).to.equal(true);
    });

    it("rejects requestWithdrawal for SAFE mode", async function () {
      const { jarId, unlockTime } = await createSafe();
      await mineAt(unlockTime);
      await expect(penguJar.connect(owner).requestWithdrawal(jarId))
        .to.be.revertedWithCustomError(penguJar, "InvalidJarMode")
        .withArgs(jarId, SHIELDED);
    });

    it("rejects a non-owner and preserves SAFE state", async function () {
      const { jarId, unlockTime, amount } = await createSafe();
      await mineAt(unlockTime);

      await expect(penguJar.connect(attacker).withdrawJar(jarId))
        .to.be.revertedWithCustomError(penguJar, "NotJarOwner")
        .withArgs(jarId, attacker.address);

      const jar = await penguJar.getJar(jarId);
      expect(jar.balance).to.equal(amount);
      expect(jar.closed).to.equal(false);
      expect(jar.withdrawalReadyAt).to.equal(0);
    });

    it("cannot withdraw a SAFE jar twice", async function () {
      const { jarId, unlockTime } = await createSafe();
      await setNextTimestamp(unlockTime);
      await penguJar.connect(owner).withdrawJar(jarId);
      await expect(penguJar.connect(owner).withdrawJar(jarId))
        .to.be.revertedWithCustomError(penguJar, "JarClosed")
        .withArgs(jarId);
    });
  });

  describe("SHIELDED request protection", function () {
    it("blocks owner requests before unlock and preserves request state", async function () {
      const { jarId, unlockTime } = await createShielded();
      await expect(penguJar.connect(owner).requestWithdrawal(jarId))
        .to.be.revertedWithCustomError(penguJar, "JarStillLocked")
        .withArgs(jarId, unlockTime);
      expect((await penguJar.getJar(jarId)).withdrawalReadyAt).to.equal(0);
    });

    it("blocks non-owner requests without modifying state", async function () {
      const { jarId, unlockTime, amount } = await createShielded();
      await mineAt(unlockTime);
      await expect(penguJar.connect(attacker).requestWithdrawal(jarId))
        .to.be.revertedWithCustomError(penguJar, "NotJarOwner")
        .withArgs(jarId, attacker.address);
      const jar = await penguJar.getJar(jarId);
      expect(jar.balance).to.equal(amount);
      expect(jar.closed).to.equal(false);
      expect(jar.withdrawalReadyAt).to.equal(0);
    });

    it("starts the full delay at unlock and rejects a second active request", async function () {
      const { jarId, unlockTime, delay } = await createShielded();
      await setNextTimestamp(unlockTime);
      await expect(penguJar.connect(owner).requestWithdrawal(jarId))
        .to.emit(penguJar, "WithdrawalRequested")
        .withArgs(jarId, owner.address, unlockTime, unlockTime + delay);
      expect((await penguJar.getJar(jarId)).withdrawalReadyAt).to.equal(unlockTime + delay);

      await expect(penguJar.connect(owner).requestWithdrawal(jarId))
        .to.be.revertedWithCustomError(penguJar, "WithdrawalRequestAlreadyActive")
        .withArgs(jarId);
    });

    it("blocks non-owner cancellation without modifying the active request", async function () {
      const { jarId, unlockTime, amount } = await createShielded();
      const { readyAt } = await requestAtUnlock(jarId, unlockTime);

      await expect(penguJar.connect(attacker).cancelWithdrawalRequest(jarId))
        .to.be.revertedWithCustomError(penguJar, "NotJarOwner")
        .withArgs(jarId, attacker.address);

      const jar = await penguJar.getJar(jarId);
      expect(jar.withdrawalReadyAt).to.equal(readyAt);
      expect(jar.balance).to.equal(amount);
      expect(jar.closed).to.equal(false);
    });

    it("lets the owner cancel, clears state, and prevents withdrawal", async function () {
      const { jarId, unlockTime } = await createShielded();
      const { readyAt } = await requestAtUnlock(jarId, unlockTime);
      await mineAt(readyAt);

      await expect(penguJar.connect(owner).cancelWithdrawalRequest(jarId))
        .to.emit(penguJar, "WithdrawalRequestCancelled")
        .withArgs(jarId, owner.address);
      expect((await penguJar.getJar(jarId)).withdrawalReadyAt).to.equal(0);
      await expect(penguJar.connect(owner).withdrawJar(jarId))
        .to.be.revertedWithCustomError(penguJar, "WithdrawalRequestMissing")
        .withArgs(jarId);
    });

    it("requires a fresh full delay after cancellation", async function () {
      const { jarId, unlockTime, delay } = await createShielded();
      await requestAtUnlock(jarId, unlockTime);
      await penguJar.connect(owner).cancelWithdrawalRequest(jarId);

      const tx = await penguJar.connect(owner).requestWithdrawal(jarId);
      const receipt = await tx.wait();
      const newRequestedAt = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
      const newReadyAt = Number((await penguJar.getJar(jarId)).withdrawalReadyAt);
      expect(newReadyAt).to.equal(newRequestedAt + delay);

      await setNextTimestamp(newReadyAt - 1);
      await expect(penguJar.connect(owner).withdrawJar(jarId))
        .to.be.revertedWithCustomError(penguJar, "SecurityDelayActive")
        .withArgs(jarId, newReadyAt);
    });
  });

  describe("SHIELDED withdrawal protection", function () {
    it("cannot withdraw without an active request", async function () {
      const { jarId, unlockTime } = await createShielded();
      await mineAt(unlockTime);
      await expect(penguJar.connect(owner).withdrawJar(jarId))
        .to.be.revertedWithCustomError(penguJar, "WithdrawalRequestMissing")
        .withArgs(jarId);
    });

    it("fails one second before ready without changing balances", async function () {
      const { jarId, unlockTime, amount } = await createShielded();
      const { readyAt } = await requestAtUnlock(jarId, unlockTime);
      const contractBefore = await token.balanceOf(await penguJar.getAddress());
      await setNextTimestamp(readyAt - 1);

      await expect(penguJar.connect(owner).withdrawJar(jarId))
        .to.be.revertedWithCustomError(penguJar, "SecurityDelayActive")
        .withArgs(jarId, readyAt);

      const jar = await penguJar.getJar(jarId);
      expect(jar.balance).to.equal(amount);
      expect(jar.closed).to.equal(false);
      expect(jar.withdrawalReadyAt).to.equal(readyAt);
      expect(await token.balanceOf(await penguJar.getAddress())).to.equal(contractBefore);
    });

    it("withdraws exactly at ready, transfers all funds, closes, and clears request", async function () {
      const initial = usdc("20");
      const contribution = usdc("7");
      const { jarId, unlockTime } = await createShielded({ amount: initial });
      await token.connect(other).approve(await penguJar.getAddress(), contribution);
      await penguJar.connect(other).contributeToJar(jarId, contribution);
      const total = initial + contribution;
      const { readyAt } = await requestAtUnlock(jarId, unlockTime);
      const ownerBefore = await token.balanceOf(owner.address);
      const contractBefore = await token.balanceOf(await penguJar.getAddress());
      await setNextTimestamp(readyAt);

      await expect(penguJar.connect(owner).withdrawJar(jarId))
        .to.emit(penguJar, "JarWithdrawn")
        .withArgs(jarId, owner.address, total);

      const jar = await penguJar.getJar(jarId);
      expect(await token.balanceOf(owner.address)).to.equal(ownerBefore + total);
      expect(await token.balanceOf(await penguJar.getAddress())).to.equal(contractBefore - total);
      expect(jar.balance).to.equal(0);
      expect(jar.closed).to.equal(true);
      expect(jar.withdrawalReadyAt).to.equal(0);
      expect(await penguJar.getContribution(jarId, other.address)).to.equal(contribution);
    });

    it("blocks non-owner withdrawal even after the delay without modifying state", async function () {
      const { jarId, unlockTime, amount } = await createShielded();
      const { readyAt } = await requestAtUnlock(jarId, unlockTime);
      await mineAt(readyAt);

      await expect(penguJar.connect(attacker).withdrawJar(jarId))
        .to.be.revertedWithCustomError(penguJar, "NotJarOwner")
        .withArgs(jarId, attacker.address);

      const jar = await penguJar.getJar(jarId);
      expect(jar.balance).to.equal(amount);
      expect(jar.closed).to.equal(false);
      expect(jar.withdrawalReadyAt).to.equal(readyAt);
    });

    it("cannot reuse an old request or withdraw a SHIELDED jar twice", async function () {
      const { jarId, unlockTime } = await createShielded();
      const { readyAt } = await requestAtUnlock(jarId, unlockTime);
      await setNextTimestamp(readyAt);
      await penguJar.connect(owner).withdrawJar(jarId);

      await expect(penguJar.connect(owner).requestWithdrawal(jarId))
        .to.be.revertedWithCustomError(penguJar, "JarClosed")
        .withArgs(jarId);
      await expect(penguJar.connect(owner).withdrawJar(jarId))
        .to.be.revertedWithCustomError(penguJar, "JarClosed")
        .withArgs(jarId);
    });
  });

  describe("cross-jar isolation and bypass attempts", function () {
    it("a request for jar A never authorizes jar B", async function () {
      const sharedUnlock = (await latestTimestamp()) + 10_000;
      const jarA = await createShielded({ name: "A", unlockTime: sharedUnlock });
      const jarB = await createShielded({ name: "B", unlockTime: sharedUnlock });
      const { readyAt } = await requestAtUnlock(jarA.jarId, sharedUnlock);
      await mineAt(readyAt);

      await expect(penguJar.connect(owner).withdrawJar(jarB.jarId))
        .to.be.revertedWithCustomError(penguJar, "WithdrawalRequestMissing")
        .withArgs(jarB.jarId);
      expect((await penguJar.getJar(jarA.jarId)).withdrawalReadyAt).to.equal(readyAt);
      expect((await penguJar.getJar(jarB.jarId)).withdrawalReadyAt).to.equal(0);
    });

    it("Owner A cannot request, cancel, or withdraw Owner B's jar", async function () {
      const jarB = await createShielded({ signer: other });
      await mineAt(jarB.unlockTime);

      for (const action of ["requestWithdrawal", "cancelWithdrawalRequest", "withdrawJar"]) {
        await expect(penguJar.connect(owner)[action](jarB.jarId))
          .to.be.revertedWithCustomError(penguJar, "NotJarOwner")
          .withArgs(jarB.jarId, owner.address);
      }
      const jar = await penguJar.getJar(jarB.jarId);
      expect(jar.balance).to.equal(jarB.amount);
      expect(jar.withdrawalReadyAt).to.equal(0);
      expect(jar.closed).to.equal(false);
    });

    it("keeps SAFE and SHIELDED state independent for the same owner", async function () {
      const unlockTime = (await latestTimestamp()) + 10_000;
      const safe = await createSafe({ unlockTime });
      const shielded = await createShielded({ unlockTime });
      await requestAtUnlock(shielded.jarId, unlockTime);

      await penguJar.connect(owner).withdrawJar(safe.jarId);
      const safeState = await penguJar.getJar(safe.jarId);
      const shieldedState = await penguJar.getJar(shielded.jarId);
      expect(safeState.closed).to.equal(true);
      expect(safeState.withdrawalReadyAt).to.equal(0);
      expect(shieldedState.closed).to.equal(false);
      expect(shieldedState.balance).to.equal(shielded.amount);
      expect(shieldedState.withdrawalReadyAt).to.be.greaterThan(0);
    });

    it("cancelling jar A does not affect jar B", async function () {
      const unlockTime = (await latestTimestamp()) + 10_000;
      const jarA = await createShielded({ name: "A", unlockTime });
      const jarB = await createShielded({ name: "B", unlockTime });
      await requestAtUnlock(jarA.jarId, unlockTime);
      const txB = await penguJar.connect(owner).requestWithdrawal(jarB.jarId);
      await txB.wait();
      const readyB = (await penguJar.getJar(jarB.jarId)).withdrawalReadyAt;

      await penguJar.connect(owner).cancelWithdrawalRequest(jarA.jarId);
      expect((await penguJar.getJar(jarA.jarId)).withdrawalReadyAt).to.equal(0);
      expect((await penguJar.getJar(jarB.jarId)).withdrawalReadyAt).to.equal(readyB);
    });

    it("time elapsed for jar A cannot bypass jar B's later configured delay", async function () {
      const unlockTime = (await latestTimestamp()) + 10_000;
      const jarA = await createShielded({ name: "A", unlockTime, delay: MIN_DELAY });
      const jarB = await createShielded({ name: "B", unlockTime, delay: MAX_DELAY });
      const requestA = await requestAtUnlock(jarA.jarId, unlockTime);
      await penguJar.connect(owner).requestWithdrawal(jarB.jarId);
      const readyB = Number((await penguJar.getJar(jarB.jarId)).withdrawalReadyAt);
      await mineAt(requestA.readyAt);

      await penguJar.connect(owner).withdrawJar(jarA.jarId);
      await expect(penguJar.connect(owner).withdrawJar(jarB.jarId))
        .to.be.revertedWithCustomError(penguJar, "SecurityDelayActive")
        .withArgs(jarB.jarId, readyB);
      expect((await penguJar.getJar(jarB.jarId)).closed).to.equal(false);
    });
  });
});
