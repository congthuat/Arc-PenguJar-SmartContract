# PenguJar

A simple onchain USDC savings jar built on Arc Testnet.

PenguJar helps people define a savings goal, lock USDC until a chosen date, save over time, and optionally accept contributions from other wallets. Funds remain locked under the jar's onchain rules, and only the jar owner can withdraw after the unlock time.

## Live App

**[Open PenguJar on Arc Testnet](https://arc-pengu-jar-smart-contract.vercel.app)**

PenguJar is currently an Arc Testnet release intended for testing and demonstration.

## Why PenguJar

Saving for a specific goal should be easy to understand and difficult to undo impulsively. PenguJar turns a familiar savings-jar idea into a transparent onchain flow:

- Set a clear target and unlock time.
- Keep the savings rules visible onchain.
- Save individually or invite others to contribute.
- Preserve owner control without giving contributors withdrawal rights.

PenguJar does not offer yield, staking, swaps, lending, or a project token.

## Core Features

- Multiple goal-based savings jars per owner
- USDC deposits and additional owner deposits
- Shared contributions from other wallets
- Immutable unlock times and time-locked funds
- Owner-only withdrawal after unlock
- Closed jar state after withdrawal
- Public, read-only jar pages and shareable links
- Onchain activity history with ArcScan transaction links
- OKX Wallet and injected-wallet support
- Arc Testnet detection and network switching
- English and Vietnamese interfaces
- Light, Dark, and System appearance modes
- Responsive desktop and mobile layout

### Current Verified Functionality

Verified on the public Vercel deployment connected to Arc Testnet:

- Jar #4, **Public Test**, was created successfully.
- The owner deposited `0.001 USDC`.
- The jar unlocked correctly at `12/08/2026 21:59`.
- The owner withdrew `0.001 USDC` after unlock.
- The jar balance became `0 USDC` and its state became **Closed**.
- Onchain Activity showed the complete lifecycle: Jar created, Deposited `0.001 USDC`, Unlock time reached, and Withdrawn · Jar closed `0.001 USDC`.

## How It Works

```text
Connect wallet
    -> Create Jar
    -> Set a target and unlock time
    -> Deposit USDC or accept contributions
    -> Funds remain locked until the unlock time
    -> Jar owner withdraws the full balance
    -> Jar closes and its history remains public
```

Contributions belong to the jar owner. Contributors do not gain ownership, repayment claims, or withdrawal rights.

## Architecture

PenguJar is a client-side dApp with no custodial application backend or application database.

- **Frontend:** Next.js 16, React 19, and TypeScript
- **Wallet and contract interaction:** wagmi and viem
- **Client-side data:** TanStack Query
- **Smart contract:** `PenguJarV2`, written in Solidity 0.8.24
- **Contract libraries:** OpenZeppelin `SafeERC20` and `ReentrancyGuard`
- **Development and testing:** Hardhat
- **Network and asset:** Arc Testnet and USDC
- **Hosting:** Vercel

Public reads go directly to Arc Testnet RPC endpoints. Write operations are prepared by the frontend and signed by the connected wallet.

More detail is available in the [release architecture](docs/architecture.md).

## Smart Contract

| Item | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.io` |
| PenguJarV2 | [`0xE77129Baa1614bB242d1703C40a568249a53BF44`](https://testnet.arcscan.app/address/0xE77129Baa1614bB242d1703C40a568249a53BF44) |
| Arc Testnet USDC | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |
| USDC application decimals | `6` |
| Deployment block | `56583471` |

The PenguJarV2 source is verified on ArcScan. Arc native gas accounting uses 18 decimals, while application USDC transfers use the standard ERC-20 interface and 6-decimal token amounts.

## Security Model

- The frontend never needs custody of wallet secrets.
- Users review and sign write transactions in their connected wallet.
- Only the jar owner can withdraw a jar's funds.
- Withdrawal cannot occur before the immutable unlock time.
- Contributors receive no withdrawal rights.
- Deposits and contributions stop when a jar unlocks or closes.
- Direct USDC transfers to the contract are not credited to a jar.
- There is no administrator withdrawal, privileged fund sweep, upgrade proxy, or early-withdrawal bypass.

PenguJar has not undergone an independent professional security audit. See the [threat model](docs/06-security.md) and [release audit](docs/10-final-audit.md) for the project's internal security review.

## Tested User Flows

- [x] Connect OKX Wallet or another injected wallet
- [x] Detect and switch to Arc Testnet
- [x] Create a savings jar
- [x] Make an owner USDC deposit
- [x] Contribute USDC from another wallet
- [x] View a public jar without connecting a wallet
- [x] Review onchain activity and ArcScan links
- [x] Enforce owner-only withdrawal and block early withdrawal in contract tests
- [x] Complete a successful post-unlock owner withdrawal in contract tests
- [x] Complete a public Arc Testnet lifecycle from jar creation through withdrawal and Closed state
- [x] Use responsive desktop and mobile layouts
- [x] Switch between Light, Dark, and System appearance
- [x] Switch between English and Vietnamese

The current contract suite contains 19 passing tests: one preserved V1 regression test and 18 PenguJarV2 lifecycle, authorization, contribution, and accounting tests.

## Screenshots and Demo

Approved release screenshots have not yet been added to the repository. The planned set includes:

- Dashboard
- Create Jar flow
- Jar detail and progress
- Onchain activity history
- Shared contribution flow
- Mobile view
- Closed jar state
- ArcScan verified contract

See the [demo checklist](docs/demo-checklist.md) and [screenshot plan](docs/screenshots.md) for capture requirements. Screenshots should show real Arc Testnet state and must not expose wallet secrets or unrelated personal information.

## Local Development

Requirements: Node.js 20 or later and npm.

```bash
git clone https://github.com/congthuat/Arc-PenguJar-SmartContract.git
cd Arc-PenguJar-SmartContract

# Install smart-contract dependencies
npm ci

# Install and start the frontend
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` after the development server starts.

On Windows PowerShell, copy the environment template with:

```powershell
Copy-Item .env.example .env.local
```

### Frontend Environment Variable

The frontend uses one optional public override. The checked-in default already points to the deployed Arc Testnet contract.

```dotenv
NEXT_PUBLIC_PENGUJAR_ADDRESS=0xE77129Baa1614bB242d1703C40a568249a53BF44
```

Use [`frontend/.env.example`](frontend/.env.example) as the source of truth. Do not place secret credentials in frontend environment variables.

## Smart Contract Development

Run these commands from the repository root:

```bash
npm ci
npm run compile
npm test
```

Available release tooling:

```bash
npm run deploy:validate
npm run deploy:arc
npm run deploy:verify
npm run clean
```

Deployment commands require deliberate local configuration and a dedicated Arc Testnet wallet. Review the [Arc Testnet deployment guide](docs/09-deployment.md) before using them.

Frontend validation commands:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Deployment

The frontend is deployed on Vercel:

- **Production URL:** [https://arc-pengu-jar-smart-contract.vercel.app](https://arc-pengu-jar-smart-contract.vercel.app)
- **Vercel Root Directory:** `frontend`
- **Framework:** Next.js

The public contract address may be configured with `NEXT_PUBLIC_PENGUJAR_ADDRESS`. No wallet signing credential belongs in the Vercel frontend configuration.

## Project Status

**Arc Testnet Release**

The application, verified contract, public jar pages, wallet flows, localization, activity history, and responsive interface are available for Arc Testnet testing. A complete create, deposit, unlock, owner-withdrawal, and Closed-state lifecycle has been verified on the public Vercel deployment connected to Arc Testnet using Jar #4, **Public Test**. PenguJar is not presented as a mainnet production service.

## Project Documentation

- [Product requirements](docs/02-prd.md)
- [Product decisions](docs/03-product-decisions.md)
- [Technical architecture](docs/05-architecture.md)
- [Security and threat model](docs/06-security.md)
- [Arc Testnet deployment](docs/09-deployment.md)
- [Final release audit](docs/10-final-audit.md)

## License

PenguJar is available under the [MIT License](LICENSE).

## Disclaimer

PenguJar is deployed on Arc Testnet for testing and demonstration. Testnet USDC is not real-world money and has no intended monetary value. The project is not a bank, investment product, or promise of returns.
