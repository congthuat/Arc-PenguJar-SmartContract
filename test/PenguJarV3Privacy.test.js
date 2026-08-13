const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PenguJarV3 metadata privacy", function () {
  const SAFE = 0n;
  const SHIELDED = 1n;
  const PUBLIC = 0n;
  const PRIVATE = 1n;
  const MIN_DELAY = 60 * 60;
  const usdc = (value) => ethers.parseUnits(value, 6);
  const commitment = (label) => ethers.keccak256(ethers.toUtf8Bytes(label));

  let token;
  let penguJar;
  let owner;
  let contributor;
  let attacker;

  async function now() {
    return (await ethers.provider.getBlock("latest")).timestamp;
  }

  async function setNextTimestamp(timestamp) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(timestamp)]);
  }

  async function mineAt(timestamp) {
    await setNextTimestamp(timestamp);
    await ethers.provider.send("evm_mine");
  }

  async function approve(signer, amount) {
    await token.connect(signer).approve(await penguJar.getAddress(), amount);
  }

  async function createPrivateSafe({
    signer = owner,
    value = commitment("private-safe"),
    unlockTime,
    amount = usdc("10"),
  } = {}) {
    const unlock = unlockTime ?? ((await now()) + 10_000);
    if (amount > 0n) await approve(signer, amount);
    await penguJar.connect(signer).createPrivateJar(value, unlock, amount);
    return {
      jarId: (await penguJar.nextJarId()) - 1n,
      metadataCommitment: value,
      unlockTime: unlock,
      amount,
    };
  }

  async function createPrivateShielded({
    signer = owner,
    value = commitment("private-shielded"),
    unlockTime,
    amount = usdc("10"),
    delay = MIN_DELAY,
  } = {}) {
    const unlock = unlockTime ?? ((await now()) + 10_000);
    if (amount > 0n) await approve(signer, amount);
    await penguJar
      .connect(signer)
      .createPrivateShieldedJar(value, unlock, amount, delay);
    return {
      jarId: (await penguJar.nextJarId()) - 1n,
      metadataCommitment: value,
      unlockTime: unlock,
      amount,
      delay,
    };
  }

  beforeEach(async function () {
    [, owner, contributor, attacker] = await ethers.getSigners();
    token = await ethers.deployContract("MockUSDC");
    penguJar = await ethers.deployContract("PenguJarV3", [await token.getAddress()]);
    for (const signer of [owner, contributor, attacker]) {
      await token.transfer(signer.address, usdc("1000"));
    }
  });

  describe("public compatibility", function () {
    it("createJar remains PUBLIC + SAFE with readable public metadata and zero commitment", async function () {
      const unlockTime = (await now()) + 10_000;
      await expect(
        penguJar.connect(owner).createJar("Public Safe", usdc("100"), unlockTime, 0)
      )
        .to.emit(penguJar, "JarCreated")
        .withArgs(1, owner.address, "Public Safe", usdc("100"), unlockTime)
        .and.to.emit(penguJar, "JarPrivacyConfigured")
        .withArgs(1, PUBLIC, ethers.ZeroHash);

      const jar = await penguJar.getJar(1);
      expect(jar.mode).to.equal(SAFE);
      expect(jar.privacyMode).to.equal(PUBLIC);
      expect(jar.name).to.equal("Public Safe");
      expect(jar.targetAmount).to.equal(usdc("100"));
      expect(jar.metadataCommitment).to.equal(ethers.ZeroHash);
    });

    it("createShieldedJar remains PUBLIC + SHIELDED with unchanged metadata", async function () {
      const unlockTime = (await now()) + 10_000;
      await expect(
        penguJar
          .connect(owner)
          .createShieldedJar("Public Shielded", usdc("250"), unlockTime, 0, MIN_DELAY)
      )
        .to.emit(penguJar, "JarCreated")
        .withArgs(1, owner.address, "Public Shielded", usdc("250"), unlockTime)
        .and.to.emit(penguJar, "JarPrivacyConfigured")
        .withArgs(1, PUBLIC, ethers.ZeroHash);

      const jar = await penguJar.getJar(1);
      expect(jar.mode).to.equal(SHIELDED);
      expect(jar.privacyMode).to.equal(PUBLIC);
      expect(jar.name).to.equal("Public Shielded");
      expect(jar.targetAmount).to.equal(usdc("250"));
      expect(jar.metadataCommitment).to.equal(ethers.ZeroHash);
    });
  });

  describe("private creation and sanitization", function () {
    it("creates PRIVATE + SAFE and emits only sanitized JarCreated metadata", async function () {
      const value = commitment("trip-name-target-and-salt");
      const unlockTime = (await now()) + 10_000;

      await expect(penguJar.connect(owner).createPrivateJar(value, unlockTime, 0))
        .to.emit(penguJar, "JarCreated")
        .withArgs(1, owner.address, "", 0, unlockTime)
        .and.to.emit(penguJar, "JarPrivacyConfigured")
        .withArgs(1, PRIVATE, value);

      const jar = await penguJar.getJar(1);
      expect(jar.mode).to.equal(SAFE);
      expect(jar.privacyMode).to.equal(PRIVATE);
      expect(jar.name).to.equal("");
      expect(jar.targetAmount).to.equal(0);
      expect(jar.metadataCommitment).to.equal(value);
    });

    it("creates PRIVATE + SHIELDED with the commitment and sanitized fields", async function () {
      const value = commitment("shielded-private-metadata-and-salt");
      const unlockTime = (await now()) + 10_000;

      await expect(
        penguJar
          .connect(owner)
          .createPrivateShieldedJar(value, unlockTime, 0, MIN_DELAY)
      )
        .to.emit(penguJar, "JarCreated")
        .withArgs(1, owner.address, "", 0, unlockTime)
        .and.to.emit(penguJar, "JarPrivacyConfigured")
        .withArgs(1, PRIVATE, value);

      const jar = await penguJar.getJar(1);
      expect(jar.mode).to.equal(SHIELDED);
      expect(jar.privacyMode).to.equal(PRIVATE);
      expect(jar.name).to.equal("");
      expect(jar.targetAmount).to.equal(0);
      expect(jar.metadataCommitment).to.equal(value);
      expect(jar.withdrawalDelay).to.equal(MIN_DELAY);
    });

    it("rejects a zero commitment for both private creation paths", async function () {
      const unlockTime = (await now()) + 10_000;
      await expect(penguJar.connect(owner).createPrivateJar(ethers.ZeroHash, unlockTime, 0))
        .to.be.revertedWithCustomError(penguJar, "InvalidMetadataCommitment");
      await expect(
        penguJar
          .connect(owner)
          .createPrivateShieldedJar(ethers.ZeroHash, unlockTime, 0, MIN_DELAY)
      ).to.be.revertedWithCustomError(penguJar, "InvalidMetadataCommitment");
    });

    it("private creation ABI accepts no string, target, URI, notes, or plaintext field", async function () {
      const safeInputs = penguJar.interface.getFunction("createPrivateJar").inputs;
      const shieldedInputs = penguJar.interface.getFunction("createPrivateShieldedJar").inputs;
      expect(safeInputs.map((input) => input.type)).to.deep.equal([
        "bytes32",
        "uint64",
        "uint256",
      ]);
      expect(shieldedInputs.map((input) => input.type)).to.deep.equal([
        "bytes32",
        "uint64",
        "uint256",
        "uint256",
      ]);

      const { jarId, metadataCommitment } = await createPrivateSafe({ amount: 0n });
      const jar = await penguJar.getJar(jarId);
      expect(jar.name).to.equal("");
      expect(jar.targetAmount).to.equal(0);
      expect(jar.metadataCommitment).to.equal(metadataCommitment);
    });
  });

  describe("privacy isolation", function () {
    it("keeps distinct commitments isolated across private jars", async function () {
      const first = await createPrivateSafe({ value: commitment("first") });
      const second = await createPrivateShielded({ value: commitment("second") });
      expect((await penguJar.getJar(first.jarId)).metadataCommitment).to.equal(
        first.metadataCommitment
      );
      expect((await penguJar.getJar(second.jarId)).metadataCommitment).to.equal(
        second.metadataCommitment
      );
      expect(first.metadataCommitment).not.to.equal(second.metadataCommitment);
    });

    it("deposits and contributions never mutate the commitment", async function () {
      const jar = await createPrivateSafe({ amount: 0n });
      const deposit = usdc("4");
      const contribution = usdc("6");
      await approve(owner, deposit);
      await penguJar.connect(owner).depositToJar(jar.jarId, deposit);
      await approve(contributor, contribution);
      await penguJar.connect(contributor).contributeToJar(jar.jarId, contribution);

      const state = await penguJar.getJar(jar.jarId);
      expect(state.metadataCommitment).to.equal(jar.metadataCommitment);
      expect(state.balance).to.equal(deposit + contribution);
    });

    it("requesting and cancelling one jar does not alter either jar's commitment", async function () {
      const unlockTime = (await now()) + 10_000;
      const first = await createPrivateShielded({
        value: commitment("first-cancel"),
        unlockTime,
      });
      const second = await createPrivateSafe({
        value: commitment("second-untouched"),
        unlockTime,
      });
      await mineAt(unlockTime);
      await penguJar.connect(owner).requestWithdrawal(first.jarId);
      await penguJar.connect(owner).cancelWithdrawalRequest(first.jarId);

      expect((await penguJar.getJar(first.jarId)).metadataCommitment).to.equal(
        first.metadataCommitment
      );
      expect((await penguJar.getJar(second.jarId)).metadataCommitment).to.equal(
        second.metadataCommitment
      );
    });
  });

  describe("private financial and withdrawal security", function () {
    it("PRIVATE SAFE accepts contributions and withdraws the full amount at unlock", async function () {
      const initial = usdc("10");
      const contribution = usdc("8");
      const jar = await createPrivateSafe({ amount: initial });
      await approve(contributor, contribution);
      await penguJar.connect(contributor).contributeToJar(jar.jarId, contribution);
      const ownerBefore = await token.balanceOf(owner.address);
      await setNextTimestamp(jar.unlockTime);

      await penguJar.connect(owner).withdrawJar(jar.jarId);

      const state = await penguJar.getJar(jar.jarId);
      expect(await token.balanceOf(owner.address)).to.equal(
        ownerBefore + initial + contribution
      );
      expect(state.closed).to.equal(true);
      expect(state.metadataCommitment).to.equal(jar.metadataCommitment);
    });

    it("PRIVATE SHIELDED requires a request and the full configured delay", async function () {
      const jar = await createPrivateShielded();
      await mineAt(jar.unlockTime);
      await expect(penguJar.connect(owner).withdrawJar(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "WithdrawalRequestMissing")
        .withArgs(jar.jarId);

      const requestTx = await penguJar.connect(owner).requestWithdrawal(jar.jarId);
      const receipt = await requestTx.wait();
      const requestedAt = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
      const readyAt = requestedAt + jar.delay;
      await setNextTimestamp(readyAt - 1);
      await expect(penguJar.connect(owner).withdrawJar(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "SecurityDelayActive")
        .withArgs(jar.jarId, readyAt);
      await setNextTimestamp(readyAt);
      await penguJar.connect(owner).withdrawJar(jar.jarId);

      const state = await penguJar.getJar(jar.jarId);
      expect(state.closed).to.equal(true);
      expect(state.metadataCommitment).to.equal(jar.metadataCommitment);
    });

    it("an unauthorized wallet cannot withdraw a private jar or alter its state", async function () {
      const jar = await createPrivateSafe();
      await mineAt(jar.unlockTime);
      await expect(penguJar.connect(attacker).withdrawJar(jar.jarId))
        .to.be.revertedWithCustomError(penguJar, "NotJarOwner")
        .withArgs(jar.jarId, attacker.address);

      const state = await penguJar.getJar(jar.jarId);
      expect(state.closed).to.equal(false);
      expect(state.balance).to.equal(jar.amount);
      expect(state.metadataCommitment).to.equal(jar.metadataCommitment);
    });

    it("withdrawing one private jar leaves another commitment unchanged", async function () {
      const unlockTime = (await now()) + 10_000;
      const first = await createPrivateSafe({
        value: commitment("withdraw-first"),
        unlockTime,
      });
      const second = await createPrivateSafe({
        value: commitment("retain-second"),
        unlockTime,
      });
      await setNextTimestamp(unlockTime);
      await penguJar.connect(owner).withdrawJar(first.jarId);

      expect((await penguJar.getJar(first.jarId)).metadataCommitment).to.equal(
        first.metadataCommitment
      );
      expect((await penguJar.getJar(second.jarId)).metadataCommitment).to.equal(
        second.metadataCommitment
      );
      expect((await penguJar.getJar(second.jarId)).closed).to.equal(false);
    });
  });
});
