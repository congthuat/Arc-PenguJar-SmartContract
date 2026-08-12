# PenguJar frontend

The PenguJar web app is a Next.js 16 application using React, TypeScript, wagmi, viem, and TanStack Query. Product and contract documentation lives in the [root README](../README.md).

## Public configuration

Copy `.env.example` to `.env.local` only when overriding checked-in public defaults:

```dotenv
NEXT_PUBLIC_PENGUJAR_ADDRESS=0xE77129Baa1614bB242d1703C40a568249a53BF44
```

Never place `PRIVATE_KEY`, wallet secrets, or authenticated RPC credentials in this directory or in a `NEXT_PUBLIC_*` variable.

Public Arc reads use a stable viem fallback transport across the approved Arc Testnet endpoints. Wallet connection and transaction signing remain isolated to the connected EIP-1193 wallet provider.

## Commands

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
npm start
```

## Routes

- `/` — connected-wallet dashboard or public owner lookup
- `/jars/{jarId}` — canonical public jar page; no wallet is required for state or Activity

The app supports English/Vietnamese and System/Light/Dark preferences. Preferences use same-site cookies so the server and first client render remain deterministic.

## Transaction boundary

Reads use the fixed Arc Testnet chain, deployed PenguJarV2 address, and public RPC fallback. Writes are requested only after explicit review and wallet confirmation:

- `createJar(name, targetAmount, unlockTime, 0)`
- `depositToJar(jarId, amount)` for the owner
- `contributeToJar(jarId, amount)` for any eligible wallet
- `withdrawJar(jarId)` for the owner after unlock

The contract remains the final authority for ownership and lifecycle rules.
