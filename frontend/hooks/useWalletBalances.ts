"use client";

import type { Address } from "viem";
import { useBalance, useReadContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import { erc20BalanceAbi } from "@/lib/abi/erc20";
import { getAssetById } from "@/lib/assets";

export function useWalletBalances(address?: Address, enabled = false) {
  const native = useBalance({
    address,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(address && enabled) },
  });
  const usdcAsset = getAssetById("usdc")!;
  const eurcAsset = getAssetById("eurc")!;
  const usdc = useReadContract({
    address: usdcAsset.address,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(address && enabled) },
  });
  const eurc = useReadContract({
    address: eurcAsset.address,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(address && enabled) },
  });

  return { native, usdc, eurc, assets: { usdc, eurc } };
}
