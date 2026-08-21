# Makoto Wallet Public Beta 0.2

Makoto Wallet Public Beta 0.2 expands the Arc Testnet wallet experience with easier onboarding, stronger transaction review, improved local security controls, and more reliable PenguJar Activity.

## What's new

### Easier wallet onboarding

- Email OTP embedded-wallet onboarding with clear verification guidance
- Google onboarding through Reown AppKit
- Existing wallets, injected wallets, and WalletConnect support

### Transaction Safety

- A review screen before supported write actions
- Account, network, amount, recipient, quote, and input-change checks where applicable
- Full recipient and transaction details before wallet confirmation
- Confirmed states only after a successful transaction receipt

### Security Center

- Wallet, network, custody, privacy, and Public Beta information
- PenguJar protection summaries and actionable alerts
- Clear separation between wallet-controlled signing and Makoto's local UI safeguards

### Makoto App Lock

- Optional six-digit local App Lock
- Inactivity auto-lock and failed-attempt cooldown
- Explicit cross-tab locking
- Optional **Keep unlocked for this browser session** convenience for reloads and other live Makoto tabs

Manual Lock Now and inactivity auto-lock override the browser-session convenience. App Lock does not change wallet custody or protect wallet private keys.

### Swap and Bridge

- XyloNet USDC ↔ EURC swaps with transaction review and exact-approval awareness
- Circle CCTP V2 bridging from Arc Testnet to Base Sepolia
- Separate Arc confirmation and Base Sepolia destination-finalization status

### PenguJar Savings

- Create, Deposit, Contribute, and Withdraw flows
- SAFE and SHIELDED protection modes
- PUBLIC and PRIVATE metadata modes
- Guardian protection and Recovery Wallet support
- Verified Activity with bounded requests, incremental refresh, deduplication, and RPC failover

## Quality and reliability

- Receipt-confirmed transaction feedback
- Improved Activity performance and provider reliability
- Accessible transaction-modal focus behavior
- English and Vietnamese product copy
- Responsive desktop and mobile layouts
- Light and Dark themes
- 19 required contract tests and 265 frontend tests passing, plus clean typecheck, lint, and production build

## Beta notice

Makoto Wallet Public Beta 0.2 is Arc Testnet-only software for testing and demonstration. Testnet assets have no intended real-world monetary value.

Makoto Wallet and PenguJar have not undergone an independent professional security audit and are not mainnet-ready financial software.
