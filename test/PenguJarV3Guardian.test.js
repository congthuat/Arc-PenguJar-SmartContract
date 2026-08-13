const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PenguJarV3 Guardian adversarial security", function () {
  const SAFE = 0n;
  const SHIELDED = 1n;
  const PUBLIC = 0n;
  const PRIVATE = 1n;
  const DELAY = 60 * 60;
  const SEVEN_DAYS = 7 * 24 * 60 * 60;
  const usdc = (value) => ethers.parseUnits(value, 6);
  const commitment = (value) => ethers.keccak256(ethers.toUtf8Bytes(value));

  let token;
  let penguJar;
  let owner;
  let guardian;
  let newGuardian;
  let recoveryWallet;
  let newOwner;
  let attacker;

  async function now() {
    return (await ethers.provider.getBlock("latest")).timestamp;
  }

  async function setNext(timestamp) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(timestamp)]);
  }

  async function mineAt(timestamp) {
    await setNext(timestamp);
    await ethers.provider.send("evm_mine");
  }

  async function createGuardianJar({
    signer = owner,
    guardianAddress = guardian.address,
    recoveryAddress = recoveryWallet.address,
    name = "Guardian Jar",
    unlockTime,
    amount = usdc("20"),
    delay = DELAY,
  } = {}) {
    const unlock = unlockTime ?? (await now()) + 10_000;
    if (amount > 0n) {
      await token.connect(signer).approve(await penguJar.getAddress(), amount);
    }
    await penguJar
      .connect(signer)
      .createGuardianShieldedJar(name, usdc("100"), unlock, amount, delay, guardianAddress, recoveryAddress);
    return { jarId: (await penguJar.nextJarId()) - 1n, unlockTime: unlock, amount, delay };
  }

  async function createPrivateGuardianJar({
    value = commitment("private guardian"),
    unlockTime,
    amount = usdc("20"),
  } = {}) {
    const unlock = unlockTime ?? (await now()) + 10_000;
    if (amount > 0n) await token.connect(owner).approve(await penguJar.getAddress(), amount);
    await penguJar
      .connect(owner)
      .createPrivateGuardianShieldedJar(value, unlock, amount, DELAY, guardian.address, recoveryWallet.address);
    return {
      jarId: (await penguJar.nextJarId()) - 1n,
      unlockTime: unlock,
      amount,
      metadataCommitment: value,
    };
  }

  async function requestAtUnlock(jar) {
    if ((await now()) < jar.unlockTime) await setNext(jar.unlockTime);
    const tx = await penguJar.connect(owner).requestWithdrawal(jar.jarId);
    const receipt = await tx.wait();
    const requestedAt = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
    return { requestedAt, readyAt: Number((await penguJar.getJar(jar.jarId)).withdrawalReadyAt) };
  }

  async function freeze(jar) {
    const tx = await penguJar.connect(guardian).freezeWithdrawal(jar.jarId);
    const receipt = await tx.wait();
    const frozenAt = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
    return { frozenAt, recoveryReadyAt: Number((await penguJar.getJar(jar.jarId)).freezeRecoveryReadyAt) };
  }

  beforeEach(async function () {
    [, owner, guardian, newGuardian, recoveryWallet, newOwner, attacker] = await ethers.getSigners();
    token = await ethers.deployContract("MockUSDC");
    penguJar = await ethers.deployContract("PenguJarV3", [await token.getAddress()]);
    await token.transfer(owner.address, usdc("1000"));
    await token.transfer(attacker.address, usdc("1000"));
  });

  describe("guardian creation", function () {
    it("stores guardian on PUBLIC and PRIVATE SHIELDED jars without changing metadata", async function () {
      const publicJar = await createGuardianJar();
      const privateJar = await createPrivateGuardianJar();
      const publicState = await penguJar.getJar(publicJar.jarId);
      const privateState = await penguJar.getJar(privateJar.jarId);

      expect(publicState.guardian).to.equal(guardian.address);
      expect(publicState.mode).to.equal(SHIELDED);
      expect(publicState.privacyMode).to.equal(PUBLIC);
      expect(publicState.name).to.equal("Guardian Jar");
      expect(publicState.targetAmount).to.equal(usdc("100"));
      expect(privateState.guardian).to.equal(guardian.address);
      expect(privateState.mode).to.equal(SHIELDED);
      expect(privateState.privacyMode).to.equal(PRIVATE);
      expect(privateState.name).to.equal("");
      expect(privateState.targetAmount).to.equal(0);
      expect(privateState.metadataCommitment).to.equal(privateJar.metadataCommitment);
    });

    it("rejects zero guardian and owner as guardian on both creation paths", async function () {
      const unlockTime = (await now()) + 10_000;
      for (const invalid of [ethers.ZeroAddress, owner.address]) {
        await expect(
          penguJar.connect(owner).createGuardianShieldedJar("Jar", 1, unlockTime, 0, DELAY, invalid, recoveryWallet.address)
        ).to.be.revertedWithCustomError(penguJar, "InvalidGuardian").withArgs(invalid);
        await expect(
          penguJar.connect(owner).createPrivateGuardianShieldedJar(commitment("x"), unlockTime, 0, DELAY, invalid, recoveryWallet.address)
        ).to.be.revertedWithCustomError(penguJar, "InvalidGuardian").withArgs(invalid);
      }
    });

    it("leaves existing SAFE and normal SHIELDED jars guardian-free", async function () {
      const unlockTime = (await now()) + 10_000;
      await penguJar.connect(owner).createJar("Safe", 1, unlockTime, 0);
      await penguJar.connect(owner).createShieldedJar("Shielded", 1, unlockTime, 0, DELAY);
      const safe = await penguJar.getJar(1);
      const shielded = await penguJar.getJar(2);
      expect(safe.mode).to.equal(SAFE);
      expect(safe.guardian).to.equal(ethers.ZeroAddress);
      expect(safe.frozen).to.equal(false);
      expect(shielded.mode).to.equal(SHIELDED);
      expect(shielded.guardian).to.equal(ethers.ZeroAddress);
    });
  });

  describe("freeze authorization and state", function () {
    it("allows only the configured guardian and only with an active request", async function () {
      const jar = await createGuardianJar();
      await mineAt(jar.unlockTime);
      await expect(penguJar.connect(guardian).freezeWithdrawal(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "WithdrawalRequestMissing")
        .withArgs(jar.jarId);
      for (const signer of [attacker, owner]) {
        await expect(penguJar.connect(signer).freezeWithdrawal(jar.jarId))
          .to.be.revertedWithCustomError(penguJar, "NotJarGuardian")
          .withArgs(jar.jarId, signer.address);
      }
    });

    it("freezes, cancels the request, and sets the exact seven-day recovery boundary", async function () {
      const jar = await createGuardianJar();
      await requestAtUnlock(jar);
      const nextTimestamp = (await now()) + 1;
      await setNext(nextTimestamp);
      await expect(penguJar.connect(guardian).freezeWithdrawal(jar.jarId))
        .to.emit(penguJar, "WithdrawalFrozen")
        .withArgs(jar.jarId, guardian.address, nextTimestamp + SEVEN_DAYS);

      const state = await penguJar.getJar(jar.jarId);
      expect(state.frozen).to.equal(true);
      expect(state.withdrawalReadyAt).to.equal(0);
      expect(state.freezeRecoveryReadyAt).to.equal(nextTimestamp + SEVEN_DAYS);
      await expect(penguJar.connect(guardian).freezeWithdrawal(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "JarFrozen")
        .withArgs(jar.jarId);
    });

    it("cannot freeze a closed jar", async function () {
      const jar = await createGuardianJar();
      const request = await requestAtUnlock(jar);
      await setNext(request.readyAt);
      await penguJar.connect(owner).withdrawJar(jar.jarId);
      await expect(penguJar.connect(guardian).freezeWithdrawal(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "JarClosed")
        .withArgs(jar.jarId);
    });
  });

  describe("frozen withdrawal and fund protection", function () {
    it("blocks request and withdrawal forever until owner recovery; old request never revives", async function () {
      const jar = await createGuardianJar();
      const original = await requestAtUnlock(jar);
      const frozen = await freeze(jar);

      for (const timestamp of [original.readyAt, frozen.recoveryReadyAt + 365 * 24 * 60 * 60]) {
        await mineAt(timestamp);
        await expect(penguJar.connect(owner).requestWithdrawal(jar.jarId))
          .to.be.revertedWithCustomError(penguJar, "JarFrozen").withArgs(jar.jarId);
        await expect(penguJar.connect(owner).withdrawJar(jar.jarId))
          .to.be.revertedWithCustomError(penguJar, "JarFrozen").withArgs(jar.jarId);
      }
      expect((await penguJar.getJar(jar.jarId)).withdrawalReadyAt).to.equal(0);
    });

    it("freeze changes no balances, metadata, owner, terms, or token custody", async function () {
      const jar = await createPrivateGuardianJar();
      await requestAtUnlock(jar);
      const stateBefore = await penguJar.getJar(jar.jarId);
      const contractBefore = await token.balanceOf(await penguJar.getAddress());
      const guardianBefore = await token.balanceOf(guardian.address);
      await freeze(jar);
      const stateAfter = await penguJar.getJar(jar.jarId);

      expect(stateAfter.balance).to.equal(stateBefore.balance);
      expect(stateAfter.owner).to.equal(stateBefore.owner);
      expect(stateAfter.unlockTime).to.equal(stateBefore.unlockTime);
      expect(stateAfter.withdrawalDelay).to.equal(stateBefore.withdrawalDelay);
      expect(stateAfter.metadataCommitment).to.equal(stateBefore.metadataCommitment);
      expect(await token.balanceOf(await penguJar.getAddress())).to.equal(contractBefore);
      expect(await token.balanceOf(guardian.address)).to.equal(guardianBefore);
    });
  });

  describe("owner-only recovery", function () {
    it("blocks owner one second early and blocks guardian/random wallets", async function () {
      const jar = await createGuardianJar();
      await requestAtUnlock(jar);
      const frozen = await freeze(jar);
      for (const signer of [guardian, attacker]) {
        await expect(penguJar.connect(signer).unfreezeJar(jar.jarId))
          .to.be.revertedWithCustomError(penguJar, "NotJarOwner")
          .withArgs(jar.jarId, signer.address);
      }
      await setNext(frozen.recoveryReadyAt - 1);
      await expect(penguJar.connect(owner).unfreezeJar(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "FreezeRecoveryActive")
        .withArgs(jar.jarId, frozen.recoveryReadyAt);
    });

    it("unfreezes exactly at recovery, clears recovery state, and requires a fresh full delay", async function () {
      const jar = await createGuardianJar();
      await requestAtUnlock(jar);
      const frozen = await freeze(jar);
      await setNext(frozen.recoveryReadyAt);
      await expect(penguJar.connect(owner).unfreezeJar(jar.jarId))
        .to.emit(penguJar, "JarUnfrozen").withArgs(jar.jarId, owner.address);
      let state = await penguJar.getJar(jar.jarId);
      expect(state.frozen).to.equal(false);
      expect(state.freezeRecoveryReadyAt).to.equal(0);
      await expect(penguJar.connect(owner).withdrawJar(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "WithdrawalRequestMissing");

      const tx = await penguJar.connect(owner).requestWithdrawal(jar.jarId);
      const receipt = await tx.wait();
      const requestedAt = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
      state = await penguJar.getJar(jar.jarId);
      expect(state.withdrawalReadyAt).to.equal(requestedAt + jar.delay);
      await setNext(requestedAt + jar.delay - 1);
      await expect(penguJar.connect(owner).withdrawJar(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "SecurityDelayActive")
        .withArgs(jar.jarId, requestedAt + jar.delay);
      const ownerBefore = await token.balanceOf(owner.address);
      const guardianBefore = await token.balanceOf(guardian.address);
      await setNext(requestedAt + jar.delay);
      await penguJar.connect(owner).withdrawJar(jar.jarId);
      expect(await token.balanceOf(owner.address)).to.equal(ownerBefore + jar.amount);
      expect(await token.balanceOf(guardian.address)).to.equal(guardianBefore);
    });
  });

  describe("guardian changes", function () {
    it("validates owner, guardian address, uniqueness, and one pending change", async function () {
      const jar = await createGuardianJar();
      await expect(penguJar.connect(attacker).requestGuardianChange(jar.jarId, newGuardian.address))
        .to.be.revertedWithCustomError(penguJar, "NotJarOwner");
      await expect(penguJar.connect(owner).requestGuardianChange(jar.jarId, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(penguJar, "InvalidGuardian");
      await expect(penguJar.connect(owner).requestGuardianChange(jar.jarId, owner.address))
        .to.be.revertedWithCustomError(penguJar, "InvalidGuardian");
      await expect(penguJar.connect(owner).requestGuardianChange(jar.jarId, recoveryWallet.address))
        .to.be.revertedWithCustomError(penguJar, "InvalidGuardian");
      await expect(penguJar.connect(owner).requestGuardianChange(jar.jarId, guardian.address))
        .to.be.revertedWithCustomError(penguJar, "GuardianUnchanged");
      await penguJar.connect(owner).requestGuardianChange(jar.jarId, newGuardian.address);
      await expect(penguJar.connect(owner).requestGuardianChange(jar.jarId, attacker.address))
        .to.be.revertedWithCustomError(penguJar, "GuardianChangeAlreadyPending");
    });

    it("cannot execute immediately or one second early, then executes exactly at seven days", async function () {
      const jar = await createGuardianJar();
      const tx = await penguJar.connect(owner).requestGuardianChange(jar.jarId, newGuardian.address);
      const receipt = await tx.wait();
      const requestedAt = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
      const readyAt = requestedAt + SEVEN_DAYS;
      await penguJar.connect(recoveryWallet).approveGuardianChange(jar.jarId);
      await expect(penguJar.connect(owner).executeGuardianChange(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "GuardianChangeDelayActive")
        .withArgs(jar.jarId, readyAt);
      await setNext(readyAt - 1);
      await expect(penguJar.connect(owner).executeGuardianChange(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "GuardianChangeDelayActive");
      await setNext(readyAt);
      await expect(penguJar.connect(owner).executeGuardianChange(jar.jarId))
        .to.emit(penguJar, "GuardianChanged")
        .withArgs(jar.jarId, guardian.address, newGuardian.address);
      const state = await penguJar.getJar(jar.jarId);
      expect(state.guardian).to.equal(newGuardian.address);
      expect(state.pendingGuardian).to.equal(ethers.ZeroAddress);
      expect(state.guardianChangeReadyAt).to.equal(0);
    });

    it("old guardian loses authority and new guardian gains freeze authority", async function () {
      const jar = await createGuardianJar();
      await penguJar.connect(owner).requestGuardianChange(jar.jarId, newGuardian.address);
      await penguJar.connect(recoveryWallet).approveGuardianChange(jar.jarId);
      const readyAt = Number((await penguJar.getJar(jar.jarId)).guardianChangeReadyAt);
      await setNext(readyAt);
      await penguJar.connect(owner).executeGuardianChange(jar.jarId);
      await requestAtUnlock(jar);
      await expect(penguJar.connect(guardian).freezeWithdrawal(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "NotJarGuardian")
        .withArgs(jar.jarId, guardian.address);
      await expect(penguJar.connect(newGuardian).freezeWithdrawal(jar.jarId))
        .to.emit(penguJar, "WithdrawalFrozen");
    });

    it("owner cancels and clears a pending change which can no longer execute", async function () {
      const jar = await createGuardianJar();
      await penguJar.connect(owner).requestGuardianChange(jar.jarId, newGuardian.address);
      await expect(penguJar.connect(owner).cancelGuardianChange(jar.jarId))
        .to.emit(penguJar, "GuardianChangeCancelled")
        .withArgs(jar.jarId, newGuardian.address);
      const state = await penguJar.getJar(jar.jarId);
      expect(state.pendingGuardian).to.equal(ethers.ZeroAddress);
      expect(state.guardianChangeReadyAt).to.equal(0);
      await expect(penguJar.connect(owner).executeGuardianChange(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "GuardianChangeMissing");
    });

    it("cannot request or execute while frozen and cannot execute with active withdrawal", async function () {
      const jar = await createGuardianJar();
      await requestAtUnlock(jar);
      await penguJar.connect(owner).requestGuardianChange(jar.jarId, newGuardian.address);
      await expect(penguJar.connect(owner).executeGuardianChange(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "WithdrawalRequestAlreadyActive");
      await freeze(jar);
      await expect(penguJar.connect(owner).requestGuardianChange(jar.jarId, newGuardian.address))
        .to.be.revertedWithCustomError(penguJar, "JarFrozen");
      await expect(penguJar.connect(owner).executeGuardianChange(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "JarFrozen");
    });
  });

  describe("freeze defeats malicious replacement", function () {
    it("current guardian cancels both withdrawal and pending replacement", async function () {
      const jar = await createGuardianJar();
      await mineAt(jar.unlockTime);
      await penguJar.connect(owner).requestGuardianChange(jar.jarId, attacker.address);
      await penguJar.connect(owner).requestWithdrawal(jar.jarId);
      await penguJar.connect(guardian).freezeWithdrawal(jar.jarId);
      const state = await penguJar.getJar(jar.jarId);
      expect(state.withdrawalReadyAt).to.equal(0);
      expect(state.pendingGuardian).to.equal(ethers.ZeroAddress);
      expect(state.guardianChangeReadyAt).to.equal(0);
      await mineAt((await now()) + SEVEN_DAYS * 2);
      await expect(penguJar.connect(owner).executeGuardianChange(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "JarFrozen");
    });
  });

  describe("recovery-approved guardian replacement", function () {
    it("blocks the exact compromised-owner replacement attack without recovery approval", async function () {
      const jar = await createGuardianJar();
      await penguJar.connect(owner).requestGuardianChange(jar.jarId, attacker.address);
      const readyAt = Number((await penguJar.getJar(jar.jarId)).guardianChangeReadyAt);
      await mineAt(readyAt + 1);

      await expect(penguJar.connect(owner).executeGuardianChange(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "GuardianChangeNotApproved")
        .withArgs(jar.jarId);
      expect((await penguJar.getJar(jar.jarId)).guardian).to.equal(guardian.address);
    });

    it("rejects fake approval and permits the configured recovery wallet", async function () {
      const jar = await createGuardianJar();
      await penguJar.connect(owner).requestGuardianChange(jar.jarId, newGuardian.address);
      for (const signer of [owner, attacker, guardian]) {
        await expect(penguJar.connect(signer).approveGuardianChange(jar.jarId))
          .to.be.revertedWithCustomError(penguJar, "NotRecoveryWallet")
          .withArgs(jar.jarId, signer.address);
      }
      await expect(penguJar.connect(recoveryWallet).approveGuardianChange(jar.jarId))
        .to.emit(penguJar, "GuardianChangeApproved")
        .withArgs(jar.jarId, recoveryWallet.address);
      expect((await penguJar.getJar(jar.jarId)).guardianChangeRecoveryApproved).to.equal(true);
    });

    it("freeze cancels pending guardian replacement and its recovery approval", async function () {
      const jar = await createGuardianJar();
      await mineAt(jar.unlockTime);
      await penguJar.connect(owner).requestGuardianChange(jar.jarId, attacker.address);
      await penguJar.connect(recoveryWallet).approveGuardianChange(jar.jarId);
      await penguJar.connect(owner).requestWithdrawal(jar.jarId);
      await penguJar.connect(guardian).freezeWithdrawal(jar.jarId);
      const state = await penguJar.getJar(jar.jarId);
      expect(state.pendingGuardian).to.equal(ethers.ZeroAddress);
      expect(state.guardianChangeReadyAt).to.equal(0);
      expect(state.guardianChangeRecoveryApproved).to.equal(false);
    });

    it("cancel clears recovery approval as well as pending guardian state", async function () {
      const jar = await createGuardianJar();
      await penguJar.connect(owner).requestGuardianChange(jar.jarId, newGuardian.address);
      await penguJar.connect(recoveryWallet).approveGuardianChange(jar.jarId);
      await penguJar.connect(owner).cancelGuardianChange(jar.jarId);
      const state = await penguJar.getJar(jar.jarId);
      expect(state.pendingGuardian).to.equal(ethers.ZeroAddress);
      expect(state.guardianChangeReadyAt).to.equal(0);
      expect(state.guardianChangeRecoveryApproved).to.equal(false);
    });
  });

  describe("frozen owner recovery", function () {
    async function frozenJar() {
      const jar = await createGuardianJar();
      await requestAtUnlock(jar);
      await freeze(jar);
      return jar;
    }

    it("allows only recovery wallet to propose and only while frozen", async function () {
      const active = await createGuardianJar();
      await expect(penguJar.connect(recoveryWallet).requestOwnerRecovery(active.jarId, newOwner.address))
        .to.be.revertedWithCustomError(penguJar, "JarNotFrozen");
      const jar = await frozenJar();
      for (const signer of [owner, attacker, guardian]) {
        await expect(penguJar.connect(signer).requestOwnerRecovery(jar.jarId, newOwner.address))
          .to.be.revertedWithCustomError(penguJar, "NotRecoveryWallet")
          .withArgs(jar.jarId, signer.address);
      }
    });

    it("validates recovered owner and permits only one pending recovery", async function () {
      const jar = await frozenJar();
      for (const invalid of [ethers.ZeroAddress, owner.address, guardian.address, recoveryWallet.address]) {
        await expect(penguJar.connect(recoveryWallet).requestOwnerRecovery(jar.jarId, invalid))
          .to.be.revertedWithCustomError(penguJar, "InvalidRecoveredOwner")
          .withArgs(invalid);
      }
      await expect(penguJar.connect(recoveryWallet).requestOwnerRecovery(jar.jarId, newOwner.address))
        .to.emit(penguJar, "OwnerRecoveryRequested");
      await expect(penguJar.connect(recoveryWallet).requestOwnerRecovery(jar.jarId, attacker.address))
        .to.be.revertedWithCustomError(penguJar, "OwnerRecoveryAlreadyPending");
      await mineAt(Number((await penguJar.getJar(jar.jarId)).freezeRecoveryReadyAt));
      await expect(penguJar.connect(owner).unfreezeJar(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "OwnerRecoveryAlreadyPending")
        .withArgs(jar.jarId);
    });

    it("requires guardian approval and proposed-new-owner execution at the exact boundary", async function () {
      const jar = await frozenJar();
      const tx = await penguJar.connect(recoveryWallet).requestOwnerRecovery(jar.jarId, newOwner.address);
      const receipt = await tx.wait();
      const requestedAt = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
      const readyAt = requestedAt + SEVEN_DAYS;

      await mineAt(readyAt);
      await expect(penguJar.connect(newOwner).executeOwnerRecovery(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "OwnerRecoveryNotApproved");
      await expect(penguJar.connect(attacker).approveOwnerRecovery(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "NotJarGuardian");
      await penguJar.connect(guardian).approveOwnerRecovery(jar.jarId);
      for (const signer of [recoveryWallet, guardian]) {
        await expect(penguJar.connect(signer).executeOwnerRecovery(jar.jarId))
          .to.be.revertedWithCustomError(penguJar, "NotPendingOwner")
          .withArgs(jar.jarId, signer.address);
      }

      const secondJar = await frozenJar();
      await penguJar.connect(recoveryWallet).requestOwnerRecovery(secondJar.jarId, newOwner.address);
      await penguJar.connect(guardian).approveOwnerRecovery(secondJar.jarId);
      const secondReadyAt = Number((await penguJar.getJar(secondJar.jarId)).ownerRecoveryReadyAt);
      await setNext(secondReadyAt - 1);
      await expect(penguJar.connect(newOwner).executeOwnerRecovery(secondJar.jarId))
        .to.be.revertedWithCustomError(penguJar, "OwnerRecoveryDelayActive")
        .withArgs(secondJar.jarId, secondReadyAt);
      await setNext(secondReadyAt);
      await expect(penguJar.connect(newOwner).executeOwnerRecovery(secondJar.jarId))
        .to.emit(penguJar, "OwnerRecovered")
        .withArgs(secondJar.jarId, owner.address, newOwner.address);
    });

    it("changes authorization only, preserves custody, and requires a fresh full withdrawal delay", async function () {
      const jar = await frozenJar();
      const stateBefore = await penguJar.getJar(jar.jarId);
      const contractBefore = await token.balanceOf(await penguJar.getAddress());
      const guardianBefore = await token.balanceOf(guardian.address);
      const recoveryBefore = await token.balanceOf(recoveryWallet.address);
      const newOwnerBefore = await token.balanceOf(newOwner.address);
      await penguJar.connect(recoveryWallet).requestOwnerRecovery(jar.jarId, newOwner.address);
      await penguJar.connect(guardian).approveOwnerRecovery(jar.jarId);
      const readyAt = Number((await penguJar.getJar(jar.jarId)).ownerRecoveryReadyAt);
      await setNext(readyAt);
      await penguJar.connect(newOwner).executeOwnerRecovery(jar.jarId);

      let state = await penguJar.getJar(jar.jarId);
      expect(state.owner).to.equal(newOwner.address);
      expect(state.balance).to.equal(stateBefore.balance);
      expect(state.withdrawalReadyAt).to.equal(0);
      expect(state.frozen).to.equal(false);
      expect(await token.balanceOf(await penguJar.getAddress())).to.equal(contractBefore);
      expect(await token.balanceOf(guardian.address)).to.equal(guardianBefore);
      expect(await token.balanceOf(recoveryWallet.address)).to.equal(recoveryBefore);
      expect(await token.balanceOf(newOwner.address)).to.equal(newOwnerBefore);
      expect(await penguJar.getOwnerJarIds(newOwner.address)).to.include(jar.jarId);

      for (const action of ["requestWithdrawal", "withdrawJar"]) {
        await expect(penguJar.connect(owner)[action](jar.jarId))
          .to.be.revertedWithCustomError(penguJar, "NotJarOwner")
          .withArgs(jar.jarId, owner.address);
      }
      await expect(penguJar.connect(newOwner).withdrawJar(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "WithdrawalRequestMissing");
      const requestTx = await penguJar.connect(newOwner).requestWithdrawal(jar.jarId);
      const requestReceipt = await requestTx.wait();
      const requestedAt = (await ethers.provider.getBlock(requestReceipt.blockNumber)).timestamp;
      state = await penguJar.getJar(jar.jarId);
      expect(state.withdrawalReadyAt).to.equal(requestedAt + jar.delay);
      await setNext(requestedAt + jar.delay - 1);
      await expect(penguJar.connect(newOwner).withdrawJar(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "SecurityDelayActive");
      await setNext(requestedAt + jar.delay);
      await penguJar.connect(newOwner).withdrawJar(jar.jarId);
      expect(await token.balanceOf(newOwner.address)).to.equal(newOwnerBefore + jar.amount);
      expect(await token.balanceOf(guardian.address)).to.equal(guardianBefore);
      expect(await token.balanceOf(recoveryWallet.address)).to.equal(recoveryBefore);
    });
  });

  describe("cross-jar isolation and invariants", function () {
    it("guardian authority, freeze, recovery, and change state are isolated per jar", async function () {
      const unlockTime = (await now()) + 10_000;
      const jarA = await createGuardianJar({ name: "A", unlockTime });
      const jarB = await createGuardianJar({ name: "B", unlockTime, guardianAddress: newGuardian.address });
      await mineAt(unlockTime);
      await penguJar.connect(owner).requestWithdrawal(jarA.jarId);
      await penguJar.connect(owner).requestWithdrawal(jarB.jarId);
      await expect(penguJar.connect(guardian).freezeWithdrawal(jarB.jarId))
        .to.be.revertedWithCustomError(penguJar, "NotJarGuardian");
      await penguJar.connect(guardian).freezeWithdrawal(jarA.jarId);
      await penguJar.connect(owner).requestGuardianChange(jarB.jarId, attacker.address);
      const a = await penguJar.getJar(jarA.jarId);
      const b = await penguJar.getJar(jarB.jarId);
      expect(a.frozen).to.equal(true);
      expect(a.freezeRecoveryReadyAt).to.be.greaterThan(0);
      expect(a.pendingGuardian).to.equal(ethers.ZeroAddress);
      expect(b.frozen).to.equal(false);
      expect(b.withdrawalReadyAt).to.be.greaterThan(0);
      expect(b.pendingGuardian).to.equal(attacker.address);
      expect(b.guardian).to.equal(newGuardian.address);
    });

    it("all guardian operations preserve funds, public metadata, private commitment, and owner", async function () {
      const unlockTime = (await now()) + 10_000;
      const publicJar = await createGuardianJar({ unlockTime });
      const privateJar = await createPrivateGuardianJar({ unlockTime });
      const contractBefore = await token.balanceOf(await penguJar.getAddress());
      const guardianBefore = await token.balanceOf(guardian.address);
      const publicBefore = await penguJar.getJar(publicJar.jarId);
      const privateBefore = await penguJar.getJar(privateJar.jarId);
      await mineAt(unlockTime);
      await penguJar.connect(owner).requestWithdrawal(publicJar.jarId);
      await penguJar.connect(owner).requestWithdrawal(privateJar.jarId);
      await penguJar.connect(owner).requestGuardianChange(publicJar.jarId, newGuardian.address);
      await penguJar.connect(guardian).freezeWithdrawal(publicJar.jarId);
      await penguJar.connect(guardian).freezeWithdrawal(privateJar.jarId);
      const recovery = Number((await penguJar.getJar(publicJar.jarId)).freezeRecoveryReadyAt);
      await setNext(recovery);
      await penguJar.connect(owner).unfreezeJar(publicJar.jarId);

      const publicAfter = await penguJar.getJar(publicJar.jarId);
      const privateAfter = await penguJar.getJar(privateJar.jarId);
      expect(publicAfter.balance).to.equal(publicBefore.balance);
      expect(privateAfter.balance).to.equal(privateBefore.balance);
      expect(publicAfter.name).to.equal(publicBefore.name);
      expect(publicAfter.targetAmount).to.equal(publicBefore.targetAmount);
      expect(privateAfter.metadataCommitment).to.equal(privateBefore.metadataCommitment);
      expect(publicAfter.owner).to.equal(owner.address);
      expect(privateAfter.owner).to.equal(owner.address);
      expect(await token.balanceOf(await penguJar.getAddress())).to.equal(contractBefore);
      expect(await token.balanceOf(guardian.address)).to.equal(guardianBefore);
    });
  });
});
