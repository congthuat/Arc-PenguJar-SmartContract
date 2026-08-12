# 09 — Arc Testnet Deployment

Phase 3A prepares and validates deployment tooling. Do not broadcast a deployment until Phase 3 deployment approval is given.

## Network and constructor

- Network: Arc Testnet
- Hardhat network key: `arcTestnet`
- Chain ID: `5042002`
- Default RPC: `https://rpc.testnet.arc.io`
- PenguJarV2 constructor: one `address` argument
- Constructor value: official Arc Testnet USDC ERC-20 interface, `0x3600000000000000000000000000000000000000`
- Application USDC amounts use 6 decimals. Arc native gas accounting is separate.

## Local environment

Copy `.env.example` to a local `.env`. Keep `.env` local and never commit it.

Set:

```dotenv
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io
PRIVATE_KEY=0x_YOUR_TEST_ONLY_PRIVATE_KEY
PENGUJAR_ADDRESS=0x_DEPLOYED_PENGUJAR_V2_ADDRESS
```

Use only a test-only wallet funded with enough Arc Testnet native gas for deployment. Never place a private key in source files, commands, documentation, logs, screenshots, or chat.

## Non-broadcast validation

This command validates the Hardhat Arc configuration, constructor ABI, official USDC argument, and deployment transaction encoding on the local Hardhat network. It does not broadcast a transaction.

```bash
npm run deploy:validate
```

## Deployment command — run only after approval

```bash
npm run deploy:arc
```

Equivalent Hardhat command:

```bash
npx hardhat run scripts/deploy-pengujar-v2.js --network arcTestnet
```

After deployment, copy the printed PenguJarV2 address into the local `.env` as `PENGUJAR_ADDRESS`. Do not commit the value as a repository deployment record during Phase 3A.

## Read-only post-deployment verification

The verifier checks that contract bytecode exists, reads `USDC()` and confirms the official constructor value, and reads `nextJarId()`. It does not move funds.

```bash
npm run deploy:verify
```

Equivalent Hardhat command:

```bash
npx hardhat run scripts/verify-pengujar-v2.js --network arcTestnet
```

## Required regression checks

```bash
npx hardhat compile
npx hardhat test
```

## Arc Testnet deployment

- Deployment date: `2026-08-12T08:19:44Z`
- Network: Arc Testnet
- Chain ID: `5042002`
- PenguJarV2: `0xE77129Baa1614bB242d1703C40a568249a53BF44`
- Deployment transaction: `0xf6a4dfea696f32c53f0ae81b4fa437ea69b61641a21366553d05e5e4566af94d`
- Deployment block: `56583471`
- USDC: `0x3600000000000000000000000000000000000000`
