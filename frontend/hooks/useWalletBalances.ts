"use client";

import type { Address } from "viem";
import { useBalance, useReadContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import { erc20BalanceAbi } from "@/lib/abi/erc20";
import { EXPECTED_USDC_ADDRESS } from "@/lib/config";

export function useWalletBalances(address?: Address, enabled = false) {
  const native = useBalance({
    address,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(address && enabled) },
  });
  const usdc = useReadContract({
    address: EXPECTED_USDC_ADDRESS,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(address && enabled) },
  });

  return { native, usdc };
}
