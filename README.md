# Makoto Wallet

<p align="center">
  <img src="frontend/public/makoto/logo.png" alt="Makoto Wallet" width="96" />
</p>

<p align="center">
  <strong>A colorful, non-custodial mini wallet for Arc.</strong><br/>
  Send and receive USDC or EURC, track confirmed Makoto activity, and save USDC with PenguJar.
</p>

<p align="center">
  <a href="https://makoto-wallet.vercel.app"><strong>Open Makoto Wallet</strong></a>
  ·
  <a href="https://testnet.arcscan.app/address/0x2d2C30ACe5d1f057C6eC2e2E8219A43355Dd226a">PenguJar V3 on ArcScan</a>
</p>

---

## Overview

Makoto Wallet is a client-side mini wallet experience built for **Arc Testnet**.

The project started as **PenguJar**, an onchain USDC savings dApp. PenguJar is now one module inside a broader wallet experience rather than the entire product.

Makoto Wallet currently focuses on a simple set of everyday actions:

- Connect an injected wallet such as OKX Wallet
- View real USDC, EURC, and separate Arc Testnet native balances
- Send and receive supported assets (USDC and EURC)
- Review real Arc Testnet USDC and EURC activity, including transfers created outside Makoto
- Open PenguJar savings jars
- Switch between English and Vietnamese
- Use light/dark appearance controls
- Work across responsive desktop and mobile layouts

**Swap is available on Arc Testnet for the supported USDC ↔ EURC pair. Arc-native USDC bridging to Base Sepolia is also available through Circle CCTP V2 Forwarding Service.**

## Live App

**Production:** https://makoto-wallet.vercel.app

The public app is deployed on Vercel and connected to Arc Testnet.

> Makoto Wallet is currently a testnet product for development, testing, and demonstration. Testnet assets have no intended real-world monetary value.

## Product Structure

### Wallet

The main Makoto Wallet dashboard provides the connected-wallet experience:

- Real onchain balance reads
- Arc Testnet detection
- Wallet connection controls
- Multi-asset USDC/EURC Send and Receive flows
- Persistent confirmed activity with asset identity and ArcScan links
- Colorful 3D Makoto interface and responsive navigation

Makoto Wallet is **non-custodial**: the frontend does not store or control the user's private key. Transactions are prepared by the app and signed by the connected wallet.

### Savings — PenguJar V3

PenguJar remains available as Makoto Wallet's savings module.

The V3 design includes:

- Goal-based USDC savings jars
- SAFE and SHIELDED jar modes
- PUBLIC and PRIVATE metadata modes
- Time-locked withdrawal flow
- Optional Guardian protection for SHIELDED jars
- Recovery Wallet support
- Guardian-assisted owner recovery
- Delayed guardian replacement
- Defensive withdrawal freeze flow
- Encrypted client-side private metadata support

Guardian and Recovery roles are designed as defensive controls. They do not receive an unrestricted path to withdraw or redirect a jar's USDC.

## Current Feature Status

| Feature | Status |
| --- | --- |
| Wallet connection | ✅ Available |
| Arc Testnet detection | ✅ Available |
| Real USDC balance | ✅ Available |
| Real EURC balance | ✅ Available |
| Native Arc Testnet balance | ✅ Available |
| Send USDC / EURC | ✅ Available |
| Receive USDC / EURC | ✅ Available |
| On-chain USDC / EURC activity | ✅ Available |
| PenguJar savings | ✅ Available |
| Public/private jar metadata | ✅ Available |
| Guardian & Recovery | ✅ Available |
| EN / VI | ✅ Available |
| Light / Dark UI | ✅ Available |
| Swap USDC ↔ EURC | ✅ Available |
| Arc → Base Sepolia CCTP bridge | ✅ Available |
| Mainnet release | ⏳ Not released |

## Arc Testnet Configuration

| Item | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Arc Testnet USDC | `0x3600000000000000000000000000000000000000` |
| Arc Testnet EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| PenguJar V3 | `0x2d2C30ACe5d1f057C6eC2e2E8219A43355Dd226a` |
| V3 deployment block | `56927475` |
| USDC decimals | `6` |

PenguJar V3 is verified on ArcScan:

https://testnet.arcscan.app/address/0x2d2C30ACe5d1f057C6eC2e2E8219A43355Dd226a#code

## Architecture

Makoto Wallet is a client-side dApp. It does not require a custodial application backend to hold user funds or signing credentials.

### Frontend

- **Next.js 16.3**
- **React 19**
- **TypeScript**
- **wagmi 3**
- **viem 2**
- **TanStack Query 5**
- Responsive Makoto Wallet UI

### Smart Contracts

- Solidity
- Hardhat
- OpenZeppelin contracts
- PenguJar V3 on Arc Testnet

Public reads go to Arc Testnet RPC endpoints. Write operations are signed by the connected wallet.

## Security Model

Makoto Wallet is designed around non-custodial interaction:

- The frontend does not require custody of wallet private keys
- Wallet secrets must never be placed in frontend environment variables
- Users approve and sign write transactions in their wallet
- Contract state is read directly from Arc Testnet
- PenguJar V3 uses `SafeERC20` and `ReentrancyGuard`
- There is no intended administrator fund-withdrawal backdoor
- Guardian controls are defensive and do not directly grant withdrawal rights
- Owner recovery is delayed and approval-gated
- Private jar metadata is encrypted client-side before local storage

PenguJar V3 has undergone extensive project-level automated testing and adversarial-path testing, but **has not undergone an independent professional security audit**. Do not treat this repository as audited production financial software.

## Validation

The current Makoto Wallet frontend checkpoint has been validated with:

```bash
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Run the commands above for the current verified frontend test count.

PenguJar V3 development also includes dedicated privacy, guardian, recovery, and adversarial security tests in the repository's Hardhat test suite.

## Local Development

Requirements:

- Node.js 20 or later
- npm

Clone the repository:

```bash
git clone https://github.com/congthuat/Makoto-Wallet.git
cd Makoto-Wallet
```

Install smart-contract dependencies:

```bash
npm ci
```

Install and start the frontend:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

## Frontend Environment Variables

The checked-in defaults already point to the current Arc Testnet deployment. Public overrides can be supplied when needed:

```dotenv
NEXT_PUBLIC_PENGUJAR_ADDRESS=0x2d2C30ACe5d1f057C6eC2e2E8219A43355Dd226a
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
```

Only `NEXT_PUBLIC_*` configuration intended for the browser belongs in the frontend environment.

**Never put `PRIVATE_KEY` or other wallet signing secrets in the frontend, GitHub, or Vercel public environment variables.**

## Contract Development

From the repository root:

```bash
npm ci
npm run compile
npx hardhat test
```

V3 deployment and verification tooling is available through:

```bash
npm run deploy:v3:arc
npm run validate:v3:arc
npm run verify:v3:arc
npm run smoke:v3:arc
```

Deployment commands require deliberate local configuration and a dedicated Arc Testnet wallet.

## Deployment

### Frontend

- **Hosting:** Vercel
- **Production URL:** https://makoto-wallet.vercel.app
- **Vercel Root Directory:** `frontend`
- **Production branch:** `makoto-wallet`

### Repository

- **Repository:** `congthuat/Makoto-Wallet`
- **Active production branch:** `makoto-wallet`

The `main` branch contains earlier PenguJar project history and is retained as part of the project's evolution. The current Makoto Wallet production frontend is developed and deployed from `makoto-wallet`.

## Roadmap

Makoto Wallet is being developed in phases.

### Phase 1 — Wallet Foundation ✅

- Makoto Wallet rebrand
- Real Arc Testnet balances
- Send / Receive
- Session activity
- PenguJar retained as Savings
- Responsive colorful wallet dashboard
- Production Vercel deployment

### Completed

- Phase 1 — Wallet Foundation
- Phase 2 — Mini Wallet Core
- Phase 3 — Real Swap
- Phase 4 — Wallet Safety
- Phase 5 — Multi-Asset Wallet (USDC and EURC)
- Phase 6 — Arc-native integrations
- Phase 7 — Public Beta polish and release readiness

### Current checkpoint

Phase 3 and Phase 6 are implemented on Arc Testnet. Remaining roadmap work is future expansion beyond the current public-beta scope.

Roadmap items are plans, not promises of release or availability.

## PenguJar Project History

PenguJar was the original project in this repository. It evolved through multiple iterations before becoming the savings module inside Makoto Wallet.

That history remains useful because it contains the contract work behind:

- Time-locked savings
- Privacy modes
- Guardian controls
- Recovery flows
- Security tests
- Arc Testnet deployment tooling

The Makoto Wallet rebrand does not remove PenguJar; it changes its role from the whole application to a focused savings feature.

## License

This project is available under the [MIT License](LICENSE).

## Disclaimer

Makoto Wallet is currently deployed on **Arc Testnet** for testing and demonstration.

It is not a bank, investment product, exchange, audited custody service, or promise of returns. Testnet assets are not intended to represent real-world monetary value. Users are responsible for reviewing wallet prompts and transaction details before signing.
