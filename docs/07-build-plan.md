# 07 — Codex Build Plan

## Current state
Legacy prototype works conceptually but supports only one jar per wallet and was configured for Sepolia/MockUSDC.

The preserved `contracts/PenguJar.sol` is a **reference prototype**, not the final V2 contract.

## Phase 0 — Baseline & hygiene — DONE in this package
- Remove secrets/build artifacts from handoff.
- Add Arc Testnet config.
- Add `.env.example`.
- Add product/spec/security docs.
- Add `AGENTS.md` for Codex.
- Preserve legacy contract/test as reference.

## Phase 1 — Contract V2 core
Goal: multiple real jar records with strict lifecycle.

Deliverables:
- `contracts/PenguJarV2.sol`
- OpenZeppelin dependency only if needed for SafeERC20/ReentrancyGuard
- tests for create, owner deposit, multiple jars, unlock, withdraw

Definition of done:
- all Phase 1 tests pass locally
- no shared contribution yet
- no frontend yet

## Phase 2 — Shared contribution + invariants
Deliverables:
- `contributeToJar`
- contribution events
- multi-user/multi-jar tests
- lifecycle edge-case tests
- accounting invariant tests

Definition of done:
- contributor can add but cannot withdraw
- contributions blocked at/after unlock
- jar A/B accounting remains isolated

## Phase 3 — Arc Testnet deployment
Deliverables:
- deploy script using official Arc Testnet USDC ERC-20 interface
- deployment instructions
- verified contract on ArcScan if practical
- saved deployed address in local `.env` only

Never hardcode a private key.

## Phase 4 — Frontend functional flow
Deliverables:
- Next.js + TypeScript app
- wagmi + viem Arc Testnet connection
- dashboard
- create jar
- jar detail
- add/contribute
- withdraw
- transaction states + explorer links

UI at this phase may be visually plain but must be functionally complete.

## Phase 5 — Product UI polish
- mobile-first styling
- empty states
- shareable jar URL
- progress visuals
- contributor warning copy
- error copy in plain language

## Phase 6 — Live test & hardening
Run a real testnet scenario with two wallets:
1. owner creates jar A and jar B
2. owner deposits to jar A
3. wallet B contributes to jar A
4. wallet B fails to withdraw
5. owner fails to withdraw early
6. after unlock owner withdraws
7. jar B remains untouched

Record tx hashes in a separate `docs/testnet-run.md` only after real execution.

## Roadmap gate
Do not start Gift Jar / email wallet / paymaster / CCTP until the Phase 6 scenario is reproducibly working.
