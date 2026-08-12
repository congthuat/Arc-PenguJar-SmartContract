# PenguJar Release Architecture

PenguJar is a client-side dApp with no custodial backend or application database.

```text
Next.js / React frontend
          │
          ├── Public reads ── wagmi + viem fallback RPC ──┐
          │                                               │
          └── Wallet writes ─ connected EIP-1193 wallet ──┤
                                                          ▼
                                                  Arc Testnet
                                                          │
                                                  PenguJarV2
                                                          │
                                                Arc USDC ERC-20
```

## Frontend

Next.js renders the dashboard and canonical public `/jars/{jarId}` pages. React components use wagmi and viem for typed contract interaction, TanStack Query for caching, and localized dictionaries for English and Vietnamese. Theme and language preferences are stored in same-site cookies so server rendering is deterministic.

## Public reads

Public state and Activity do not require a wallet. One stable wagmi configuration uses sequential viem fallback transports across fixed public Arc Testnet RPC endpoints. Activity queries:

- start at PenguJarV2 deployment block `56583471`;
- filter the deployed contract and indexed jar ID;
- request the four verified event signatures in bounded 10,000-block ranges;
- cache successful history and block timestamps;
- refetch the relevant jar after a confirmed product transaction.

If every endpoint fails, the jar page remains usable and Activity presents a localized retry state.

## Wallet writes

Wallet connection and signing use the currently connected EIP-1193 provider, including the explicit OKX/EIP-6963 selection. Before enabling product writes, the frontend verifies that both the provider and connector report Arc Testnet chain ID `5042002`.

Public fallback RPCs never sign transactions and never receive private keys. The connected wallet signs create, approval, deposit, contribution, and withdrawal requests only after explicit user confirmation.

## Contract and token

PenguJarV2 stores ownership, jar balances, immutable terms, lifecycle state, and shared-contribution accounting. It holds the official Arc Testnet USDC ERC-20 interface at `0x3600000000000000000000000000000000000000`. Application token amounts use 6 decimals; Arc native gas display uses 18 decimals.

Only the jar owner can withdraw, only after unlock, and contributors never gain withdrawal rights.
