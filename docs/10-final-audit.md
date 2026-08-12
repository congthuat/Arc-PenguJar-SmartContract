# PenguJar Final Core Audit

Audit date: 2026-08-12  
Scope: deployed PenguJarV2 core contract, Arc Testnet state, and the Phase 4 frontend  
Mode: read-only; no blockchain transaction was signed or broadcast

## Executive summary

The approved PenguJar core is internally consistent and ready to freeze as the current testnet release. The deployed contract bytecode exists on Arc Testnet, its configured token is the official Arc Testnet USDC interface, and all live jar liabilities reconcile exactly to the contract's USDC balance at the audited block. The frontend preserves the contract's owner-only and time-locked withdrawal model, uses the connected wallet for writes, waits for successful receipts, and refreshes state from Arc after confirmation.

No blocker or high-severity finding was identified. No contract, frontend, dependency, or test code was changed during this audit.

## Deployment identity

| Item | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| PenguJarV2 | `0xE77129Baa1614bB242d1703C40a568249a53BF44` |
| Arc USDC | `0x3600000000000000000000000000000000000000` |
| Deployment transaction | `0xf6a4dfea696f32c53f0ae81b4fa437ea69b61641a21366553d05e5e4566af94d` |
| Deployment block | `56583471` |
| Deployment time | `2026-08-12T08:19:44Z` |
| Source status | Verified on ArcScan in Phase 3D |

Read-only deployment checks confirmed:

- the RPC reports chain ID `5042002`;
- non-empty bytecode exists at the PenguJarV2 address;
- `usdc()` returns `0x3600000000000000000000000000000000000000`;
- the deployed source and ABI were published and checked in Phase 3D.

## Core feature and real onchain test status

| Core flow | Status |
| --- | --- |
| Create Jar from the frontend | PASS — real Arc Testnet transaction previously confirmed |
| Owner Deposit | PASS — real Arc Testnet transaction previously confirmed |
| Shared Contribution | PASS — real Arc Testnet transaction previously confirmed |
| Time lock | PASS — pre-unlock rejection and post-unlock eligibility confirmed |
| Owner Withdrawal | PASS — real Arc Testnet transaction previously confirmed |
| Close after withdrawal | PASS — jar #3 is closed with zero live balance |
| OKX Wallet and Arc switching | PASS |
| 24-hour local date/time entry and display | PASS |

No real transaction was sent as part of this audit; the rows above combine previously approved testnet activity with current read-only state/event verification.

## Onchain state audit

The state snapshot was read at Arc block `56602972`, timestamp `1786532850` (`2026-08-12T11:07:30Z`). `nextJarId()` returned `4`, so the complete deployed range was jar IDs 1 through 3.

| Jar | Owner | Name | Balance | Target | Unlock time | Closed | Shared contributions |
| --- | --- | --- | ---: | ---: | --- | --- | ---: |
| #1 | `0x1951f95962442B6B6bE2671E4D39bC88FF6CBe71` | PenguJar Smoke Test | 0.100000 USDC | 1.000000 USDC | `1786523874` (`2026-08-12T08:37:54Z`) | No | 0.100000 USDC |
| #2 | `0x16299B74c616994EAEcb9b20E37d369D5d62586B` | CongThuat | 0.009000 USDC | 0.010000 USDC | `1788012360` (`2026-08-29T14:06:00Z`) | No | 0.002000 USDC |
| #3 | `0x16299B74c616994EAEcb9b20E37d369D5d62586B` | Withdraw Test | 0 USDC | 0.002000 USDC | `1786532400` (`2026-08-12T11:00:00Z`) | Yes | 0 USDC |

At the snapshot timestamp, jars #1 and #3 had reached their unlock times; jar #3 was already withdrawn and closed. Jar #2 remained locked.

### Event reconciliation

The complete event history from deployment through the snapshot was reviewed:

| Event | Jar | Amount | Resulting balance | Transaction |
| --- | ---: | ---: | ---: | --- |
| `JarCreated` | #1 | 0 | 0 | `0x149af3ce6a888284aa73c4a64c28edf4a781f93e733e877aa250b04ceafccc6c` |
| `JarContributed` | #1 | 0.100000 | 0.100000 | `0xa670c5120f9cb45a584de2e7d9b41e58edbbaaa8f054be55f1e46c1b8e5f3f98` |
| `JarCreated` | #2 | 0 | 0 | `0xb74fcb09610e2a9a6e32c9a03a6d311071f95a6a0f6c5166535e7e7c16d2f94e` |
| `JarDeposited` | #2 | 0.005000 | 0.005000 | `0x164a043220014d480d5e085bed0b6bdffdfc61c0e524a7c5562f5dcd7aef8f56` |
| `JarDeposited` | #2 | 0.002000 | 0.007000 | `0x1a3dab8b5272eb15a596d302f0fc6fdddc6cc389b41c3a1651b2426118a21bde` |
| `JarContributed` | #2 | 0.002000 | 0.009000 | `0xc8ff5608ac170a4f9143e0c2f1b8b8bc8e5dcd0bc6afffc59c2e39267ba41972` |
| `JarCreated` | #3 | 0 | 0 | `0xb2b1d6659a4dde19c8b5fc1bbe01f40551869997fb5b7af7f262c2347ad71881` |
| `JarDeposited` | #3 | 0.001000 | 0.001000 | `0xd1e5ea2b4b0d088b646cf56c90bdb959e53c5f1992283b2b20d0590ffb4ccf51` |
| `JarWithdrawn` | #3 | 0.001000 | 0 | `0xa15cdd915325d9d82960f7448af9aaaed872866290798085bdb1ee02ceb30555` |

Jar #1's smoke-test funding was intentionally made through `contributeToJar`, so it appears in shared-contribution accounting. Jar #2 has 0.007000 USDC of owner deposits plus 0.002000 USDC of shared contributions. Jar #3's live balance is zero after its full owner withdrawal.

### USDC reconciliation

All quantities below use the token's 6-decimal application-level accounting.

| Reconciliation item | Raw units | USDC |
| --- | ---: | ---: |
| Sum of all live jar balances | `109000` | 0.109000 |
| USDC balance held by PenguJarV2 | `109000` | 0.109000 |
| Surplus / deficit | `0` | 0 |

Result: **PASS**. No cross-jar leakage, unassigned surplus, or liability deficit was present at the audited block.

## Contract security review

### Access control and lifecycle

- Jar creation records the caller as the immutable owner.
- Owner deposits require an existing, open, still-locked jar and the caller must be its owner.
- Shared contributions require an existing, open, still-locked jar but never change ownership or grant withdrawal rights.
- Withdrawal requires the caller to be the jar owner, the unlock timestamp to have been reached, the jar to be open, and the live balance to be nonzero.
- A successful withdrawal transfers the complete live jar balance, sets the balance to zero, and permanently closes that jar.
- There is no administrator, emergency withdrawal, arbitrary recipient, upgrade hook, contributor withdrawal, reward, yield, or roadmap privilege.

### Reentrancy and external calls

The token-moving entry points use `nonReentrant` and OpenZeppelin `SafeERC20`. Withdrawal follows checks-effects-interactions: it snapshots the amount, clears the live balance, closes the jar, then transfers USDC. A failed token call reverts the entire state transition.

### Accounting and indexing

- Each jar owns an independent balance field.
- Owner deposits affect the live jar balance but intentionally do not affect shared-contribution counters.
- `contributeToJar` increases the live jar balance, the contributor's per-jar counter, and the jar's aggregate shared-contribution counter by the same amount.
- Withdrawal clears only the live balance. Historical contribution counters remain queryable by design.
- Owner-to-jar indexes are appended only when that owner creates the jar. Contributions do not alter them.

No state/accounting inconsistency or array/index error was found.

### Severity classification

| Severity | Findings |
| --- | --- |
| Critical | None |
| High | None |
| Medium | None |
| Low | None |
| Informational | Direct-transfer limitation, historical contribution semantics, unbounded owner enumeration, local-clock presentation, and official-USDC compatibility assumption; detailed below |

## Frontend security and behavior review

- Browser-visible configuration contains only public values: the Arc RPC URL, PenguJarV2 address, and USDC address. `PRIVATE_KEY` is not read anywhere in frontend source and is not exposed through a `NEXT_PUBLIC_` variable.
- Root `.env` is ignored, while the frontend ignores `.env*` and only permits its placeholder `.env.example`.
- OKX and injected wallets are discovered as distinct connectors. Wallet connection requests accounts only; transactions are initiated only from explicit review/confirmation actions.
- Arc eligibility uses the actual connected provider and connector chain IDs. Contract reads and write controls stay unavailable until both confirm chain ID `5042002`.
- Create, approve, deposit, contribute, and withdraw requests specify the Arc chain, fixed contract/token addresses, and the current connected account.
- USDC approval requests are limited to the exact requested amount; no unlimited approval path exists.
- Deposit and contribution flows re-read balance, allowance, ownership, and lifecycle state before the product write.
- Withdrawal re-reads the current owner, closed state, unlock time, and balance before requesting the wallet transaction. There is no arbitrary recipient input.
- Success is displayed only after a successful Arc receipt and, for withdrawal, a post-transaction closed/zero-balance state check.
- Successful flows refetch jar, contribution, block, dashboard, and wallet-balance data as applicable.
- User-facing dates use local `DD/MM/YYYY HH:mm` 24-hour formatting. Create Jar converts the controlled local date/hour/minute entry to a Unix timestamp and applies the approved five-minute safety minimum.
- UI terms distinguish Saved balance, Owner deposit, Shared contribution, Locked, Unlocked, and Closed. No stale “withdrawal not enabled” copy was found.

The frontend cannot replace contract enforcement. A modified client could submit a different call, but the deployed contract still enforces owner, lifecycle, and accounting rules.

## Feature permission matrix

| User/jar state | Create Jar | Deposit | Contribute | Withdraw |
| --- | --- | --- | --- | --- |
| Disconnected | Disabled | Disabled | Disabled | Disabled |
| Connected on wrong network | Disabled | Disabled | Disabled | Disabled |
| Owner before unlock, open jar | Enabled | Enabled | Enabled | Disabled |
| Owner after unlock, positive balance | Enabled | Disabled | Disabled | Enabled |
| Non-owner before unlock | Enabled | Disabled | Enabled | Disabled |
| Contributor before unlock | Enabled | Disabled unless also owner | Enabled | Disabled |
| Closed jar | New jar only | Disabled | Disabled | Disabled |
| Unlocked zero-balance open jar | New jar only | Disabled | Disabled | Disabled |

The UI checks these states to prevent inappropriate prompts, while PenguJarV2 remains the final authority. Contributors receive no withdrawal capability or individual withdrawal claim.

## Test assessment

The complete suite contains 19 passing tests and 0 failures: one legacy PenguJar V1 test and 18 PenguJarV2 tests.

The V2 coverage explicitly enforces:

- empty and initially funded creation;
- invalid name, target, unlock, and zero-deposit inputs;
- multiple independent jars for one owner and across wallets;
- owner-only positive deposits and rejection after unlock/closure;
- owner-only withdrawal, pre-unlock rejection, full-balance withdrawal, zero-balance rejection, and double-withdraw prevention;
- aggregate jar/contract balance consistency;
- owner and third-party shared contributions, repeated contributions, multiple contributors, and immutable ownership;
- zero, nonexistent-jar, insufficient-balance, unlock, and closed contribution failures;
- no contributor or unrelated-wallet withdrawal rights;
- full withdrawal of combined owner deposits and shared contributions; and
- independent accounting across multiple shared jars.

No missing regression test was identified for the approved core scope, so no test was added merely to increase the count.

## Validation results

| Gate | Result |
| --- | --- |
| Frontend lint (`npm run lint`) | PASS |
| TypeScript (`npx tsc --noEmit`) | PASS |
| Production build (`npm run build`) | PASS |
| Complete Hardhat suite (`npx hardhat test`) | PASS — 19 passed, 0 failed |

## Findings and limitations

### Blocking findings

None.

### Non-blocking limitations

1. **Informational — direct token transfers are not jar deposits.** USDC sent directly to the contract without calling a jar function would create unassigned surplus. The contract intentionally has no admin/sweep recovery path. The audited deployment currently has no surplus.
2. **Informational — contribution totals are historical.** Shared-contribution counters are not reduced after withdrawal, while the live jar balance becomes zero. The frontend labels these as contribution history rather than withdrawable balance.
3. **Informational — owner jar enumeration is unbounded.** `getOwnerJarIds` returns the owner's complete array. This is adequate for the current testnet MVP but may require pagination/indexing for accounts with very large jar counts.
4. **Informational — local-clock presentation.** Dashboard card status is derived from the browser clock for display. Transaction eligibility uses current Arc block time plus fresh contract state, so the contract safety boundary does not depend on the browser clock.
5. **Informational — token compatibility assumption.** Accounting assumes the configured official Arc USDC transfers the requested amount. Fee-on-transfer/rebasing tokens would break that assumption, but the deployed constructor is fixed to the official Arc Testnet USDC address.

## Approval recommendation

**Final core audit: PASS.** The current deployed testnet contract and frontend are safe to freeze and approve for the tested core scope. This is a testnet readiness determination, not a substitute for an independent production audit. No roadmap feature should be inferred from this approval.
