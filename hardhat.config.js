require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC_URL,
} = require("./scripts/arc-testnet");

function getArcTestnetAccounts() {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) return [];
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("PRIVATE_KEY in .env must be a 0x-prefixed 32-byte hex value");
  }
  return [privateKey];
}

module.exports = {
  solidity: "0.8.24",
  networks: {
    arcTestnet: {
      url: process.env.ARC_TESTNET_RPC_URL?.trim() || ARC_TESTNET_RPC_URL,
      chainId: ARC_TESTNET_CHAIN_ID,
      accounts: getArcTestnetAccounts(),
    },
  },
  etherscan: {
    enabled: false,
  },
  blockscout: {
    enabled: true,
    customChains: [
      {
        network: "arcTestnet",
        chainId: ARC_TESTNET_CHAIN_ID,
        urls: {
          apiURL: "https://testnet.arcscan.app/api/",
          browserURL: "https://testnet.arcscan.app",
        },
      },
    ],
  },
};
