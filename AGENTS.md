# PenguJar — Codex Working Agreement

## Mission
Build PenguJar as a small, trustworthy Arc-native savings dApp, not as a generic DeFi demo.

Product sentence:
> PenguJar lets people create USDC savings jars with a goal and an unlock date, add money over time, and optionally let friends contribute to the same jar.

## Source of truth
Read these files before changing implementation:
1. `docs/01-ideation.md`
2. `docs/02-prd.md`
3. `docs/03-product-decisions.md`
4. `docs/04-wireframe.md`
5. `docs/05-architecture.md`
6. `docs/06-security.md`
7. `docs/07-build-plan.md`

If code conflicts with docs, stop and surface the conflict before silently inventing product behavior.

## Scope guardrails
MVP includes ONLY:
- multiple jars per owner
- jar name, target amount, unlock time
- owner deposits/additional deposits
- public shared contributions by wallet address
- owner withdrawal only after unlock
- Arc Testnet USDC via its standard ERC-20 interface
- a simple wallet-based frontend

DO NOT add in MVP:
- project token
- staking or yield
- swaps / DEX
- lending
- CCTP / cross-chain bridge
- email wallets / passkeys
- paymaster / sponsored gas
- AI agents
- admin custody or an owner backdoor
- upgradeable proxy contracts

Those are roadmap items only unless the user explicitly promotes one into scope.

## Arc rules
- Arc Testnet chain ID: `5042002`.
- Primary RPC: `https://rpc.testnet.arc.io`.
- Testnet explorer: `https://testnet.arcscan.app`.
- USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`.
- Treat ERC-20 USDC amounts as 6-decimal values.
- Arc native gas accounting uses 18 decimals. Never mix raw native gas units with raw ERC-20 USDC units.
- For application balances/transfers, use the standard ERC-20 interface.

Before using any additional Arc-specific contract, SDK or address, verify it against current official Arc docs.

## Contract engineering rules
- Solidity target: `0.8.24` unless a deliberate migration is documented.
- Checks-effects-interactions on withdrawals.
- Use custom errors for new V2 logic where practical.
- Emit an event for every state-changing user action.
- Never permit changing `unlockTime` after the jar receives its first deposit.
- Never permit contributions after a jar is withdrawn/closed.
- Only the jar owner may withdraw.
- A contributor never gains withdrawal rights by contributing.
- Reject zero-amount deposits.
- Reject invalid/unreasonable unlock timestamps defined by the spec.
- Do not add a privileged admin escape hatch that can seize user funds.
- Use OpenZeppelin `SafeERC20` for token transfers in the V2 contract.
- Add reentrancy protection to withdrawal paths even when CEI is followed.

## Testing rules
For every contract behavior added, add tests for:
- happy path
- authorization failure
- time-lock failure
- zero amount / invalid input
- lifecycle edge cases
- accounting invariants

Before declaring a contract phase done:
1. `npm run compile`
2. `npm test`
3. report exact pass/fail counts

Never say tests passed if they were not run.

## Frontend rules
When frontend work begins:
- prefer Next.js + TypeScript
- use `wagmi` + `viem`
- use `arcTestnet` from `viem/chains` instead of redefining the chain unless a library requires otherwise
- do not show technical crypto jargon where plain language works
- amounts displayed as USDC, not raw units
- surface transaction pending/success/error states clearly
- mobile-first layout

## Working style for Codex
- Work one phase at a time from `docs/07-build-plan.md`.
- Before each phase, state which files will change.
- Keep diffs focused; do not rewrite unrelated files.
- Do not install production dependencies without explaining why they are needed.
- If external docs are needed, prefer official primary sources.
- After each phase, summarize: changed files, tests run, unresolved risks, next phase.

## Security / secrets
- Never print, expose, or commit `.env` values or private keys.
- Never copy a user private key into source code, README, tests, screenshots, logs, or prompts.
- `.env.example` may contain only placeholders and public network values.

## Code review rules
Flag as BLOCKING if a change:
- enables early withdrawal
- allows anyone except jar owner to withdraw
- mixes Arc native 18-decimal gas units with ERC-20 6-decimal USDC units
- lets accounting totals diverge from token balances without an explicit recovery design
- introduces an owner/admin sweep of user funds
- uses a stale/unverified Arc address
- adds roadmap features without scope approval
