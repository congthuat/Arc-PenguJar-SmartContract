# 08 — Legacy Prototype Audit

## What already works
The old `PenguJar.sol` has a clean basic idea:
- user deposits ERC-20 USDC
- unlock timestamp is recorded
- withdrawal is blocked before unlock
- state is deleted before external transfer
- read helper returns amount/unlock/time-left

The existing legacy test was re-run against the included compiled artifacts in the original ZIP with `--no-compile` and passed: **1 passing**.

## What blocks it from being the new product
1. `mapping(address => Jar)` allows only one active jar per wallet.
2. Deposit forbids another jar until old one is withdrawn.
3. No top-up function.
4. No shared contribution semantics.
5. No jar name or target amount.
6. Old network config was Sepolia, not Arc Testnet.
7. Deployment scripts use MockUSDC instead of Arc Testnet USDC.
8. Interaction scripts contain Sepolia explorer links and hard-coded legacy contract addresses.
9. README described a generic learning project instead of PenguJar.
10. Existing test coverage only checks one successful deposit path.

## Migration policy
Do not mutate legacy `PenguJar.sol` step by step until behavior becomes hard to review.

Preferred path:
- keep it as reference
- implement `PenguJarV2.sol` from the approved spec
- prove V2 with comprehensive tests
- deploy V2 separately on Arc Testnet

This produces a clear before/after story and reduces accidental compatibility baggage.
