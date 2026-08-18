import { getAddress, isAddress, type Address } from "viem";

export type Erc20PaymentRequestInput = {
  token: Address | string;
  recipient: Address | string;
  chainId: number;
  amount: bigint;
};

export function buildErc20PaymentRequest({ token, recipient, chainId, amount }: Erc20PaymentRequestInput) {
  if (!isAddress(token)) throw new Error("Invalid token address");
  if (!isAddress(recipient)) throw new Error("Invalid recipient address");
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("Invalid chain ID");
  if (amount <= 0n) throw new Error("Amount must be positive");
  return `ethereum:${getAddress(token)}@${chainId}/transfer?address=${getAddress(recipient)}&uint256=${amount}`;
}

export function buildAddressQrPayload(recipient: Address | string) {
  if (!isAddress(recipient)) throw new Error("Invalid recipient address");
  return getAddress(recipient);
}
