# PenguJar

**A goal-based USDC savings jar built on Arc.**

PenguJar lets people create onchain savings goals with a target and unlock time, add USDC over time, and invite other wallets to contribute. The contract keeps funds locked until the chosen time, and only the jar owner can withdraw.

> PenguJar is an experimental Arc Testnet project and has not undergone a professional security audit.

## What is PenguJar?

Each PenguJar is an independent onchain record with an owner, name, USDC target, live balance, and immutable unlock time. Owners can deposit before unlock. Anyone who knows a jar ID can contribute before unlock, but contributors do not receive ownership or withdrawal rights. After unlock, the owner withdraws the full available balance and the jar becomes a permanent closed record.

## Why Arc?

PenguJar is designed around stablecoin savings rather than a generic token flow. Arc provides a USDC-centered EVM environment, standard wallet and Solidity tooling, and a transaction experience suited to payments and small savings applications. USDC is both the application asset and Arc's native gas asset, while application token transfers use the official 6-decimal ERC-20 interface.

## Features

- Multiple goal-based savings jars per wallet
- Owner USDC deposits and public shared contributions
- Immutable time locks with owner-only withdrawal
- Public shareable `/jars/{id}` pages without wallet connection
- Event-derived onchain Activity with ArcScan transaction links
- Locked, Unlocked, and Closed lifecycle states
- OKX Wallet and EIP-6963 injected-wallet discovery
- Arc Testnet network switching and provider verification
- English and Vietnamese localization
- System, Light, and Dark themes
- Responsive desktop and mobile interface

## How it works

```text
Create Jar
    ↓
Owner deposits / others contribute
    ↓
Funds remain locked
    ↓
Unlock time is reached
    ↓
Owner withdraws the full balance
    ↓
Jar is closed; history remains public
```

## Smart contract

`PenguJarV2` stores jar ownership, balances, immutable terms, owner indexes, and contribution accounting. It uses OpenZeppelin `SafeERC20` and `ReentrancyGuard`; withdrawal follows checks-effects-interactions. There is no administrator withdrawal, contributor withdrawal, upgrade proxy, or emergency bypass.

| Item | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| Native/gas asset | USDC (18 decimals for native gas accounting) |
| PenguJarV2 | [`0xE77129Baa1614bB242d1703C40a568249a53BF44`](https://testnet.arcscan.app/address/0xE77129Baa1614bB242d1703C40a568249a53BF44) |
| Arc USDC ERC-20 | `0x3600000000000000000000000000000000000000` (6 application decimals) |
| Deployment block | `56583471` |
| Source | Verified on ArcScan |

Do not mix Arc native gas units with ERC-20 USDC transfer units.

## Security model

- Only the jar owner can withdraw.
- Withdrawal is permitted only at or after the immutable unlock time.
- Contributors intentionally fund the owner's jar and receive no claim or withdrawal right.
- Deposits and contributions stop when the jar unlocks or closes.
- Wallets sign every write transaction; the frontend never stores user private keys.
- Browser-visible configuration contains public chain, contract, token, explorer, and RPC information only.
- Direct USDC transfers to the contract are not credited to a jar.

See [docs/06-security.md](docs/06-security.md) and [docs/10-final-audit.md](docs/10-final-audit.md) for the project threat model and release audit.

## Tech stack

- Solidity `0.8.24`
- Hardhat and OpenZeppelin Contracts
- Next.js 16, React 19, and TypeScript
- wagmi, viem, and TanStack Query
- Arc Testnet and ArcScan

## Running locally

Requirements: Node.js 20+ and npm.

```bash
git clone <your-repository-url>
cd PenguJar-Codex

# Smart contracts
npm ci
npx hardhat compile
npx hardhat test

# Frontend
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Windows PowerShell equivalent:

```powershell
Copy-Item .env.example .env.local
```

The frontend works with its checked-in public defaults. `NEXT_PUBLIC_PENGUJAR_ADDRESS` may override only the public deployed contract address. Never place `PRIVATE_KEY` in `frontend/` or in a `NEXT_PUBLIC_*` variable.

Root `.env` is used only by local Hardhat deployment tooling. Copy `.env.example` to `.env` only when that tooling is needed, and use a dedicated testnet wallet.

## Testing

The current complete Hardhat suite contains **19 passing tests and 0 failures**: one preserved legacy V1 regression test and 18 PenguJarV2 lifecycle, authorization, contribution, and accounting tests.

```bash
npx hardhat test
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Architecture and release resources

- [Architecture](docs/architecture.md)
- [Arc Testnet deployment](docs/09-deployment.md)
- [Demo checklist](docs/demo-checklist.md)
- [Screenshot plan](docs/screenshots.md)
- [Product requirements](docs/02-prd.md)

## Production deployment

Vercel is the simplest fit for the current Next.js architecture. Its Hobby plan can suit a personal, non-commercial testnet demo within the plan limits; use an appropriate paid plan for commercial or team use. Import the GitHub repository, set the project root directory to `frontend`, keep the standard Next.js build settings, and optionally set the public `NEXT_PUBLIC_PENGUJAR_ADDRESS` override. Do not add `PRIVATE_KEY` to the Vercel project.

After deployment, verify `/`, `/jars/2`, and `/jars/3` over HTTPS, test sharing from the production origin, and confirm wallet network switching and public Activity before announcing the URL. The share implementation derives its canonical link from `window.location.origin`; it does not hardcode localhost or a speculative production domain.

## Screenshots

Release screenshots are intentionally not fabricated. Follow [docs/screenshots.md](docs/screenshots.md) and add approved captures under a future `docs/images/` directory before publication.

## Roadmap

Possible future work, not included in this release:

- Broader wallet compatibility testing
- Optional savings reminders and notifications
- Mainnet readiness and independent security review
- Additional goal templates and accessibility testing

## Disclaimer

PenguJar is experimental testnet software. It is not a bank, investment product, or promise of returns. Do not use it with assets you cannot afford to lose.

## License

This project is available under the [MIT License](LICENSE).
