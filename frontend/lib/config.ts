import { getAddress, isAddress, type Address } from "viem";

export const ARC_EXPLORER_URL = "https://testnet.arcscan.app";
export const EXPECTED_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as Address;
export const DEFAULT_PENGUJAR_ADDRESS = "0xE77129Baa1614bB242d1703C40a568249a53BF44";
export const DEFAULT_ARC_RPC_URL = "https://rpc.testnet.arc.io";
export const ARC_PUBLIC_RPC_URLS = [
  DEFAULT_ARC_RPC_URL,
  "https://rpc.drpc.testnet.arc.io",
  "https://rpc.blockdaemon.testnet.arc.io",
  "https://rpc.quicknode.testnet.arc.io",
] as const;
export const PENGUJAR_DEPLOYMENT_BLOCK = 56_583_471n;

const rawContractAddress =
  process.env.NEXT_PUBLIC_PENGUJAR_ADDRESS || DEFAULT_PENGUJAR_ADDRESS;

export const contractAddress = isAddress(rawContractAddress)
  ? getAddress(rawContractAddress)
  : undefined;

export const contractAddressError = contractAddress
  ? undefined
  : "NEXT_PUBLIC_PENGUJAR_ADDRESS is not a valid address.";

export const arcRpcUrl = DEFAULT_ARC_RPC_URL;
