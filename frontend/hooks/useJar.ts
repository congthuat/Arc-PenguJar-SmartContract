"use client";

import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { penguJarV3Abi } from "@/lib/abi/penguJarV3";
import { contractAddress } from "@/lib/config";
import type { Jar, RawJar } from "@/lib/types";

export function useJar(jarId?: bigint, viewer?: Address) {
  const enabled = Boolean(contractAddress && jarId !== undefined);
  const contracts = enabled
    ? [
        {
          address: contractAddress!,
          abi: penguJarV3Abi,
          functionName: "getJar" as const,
          args: [jarId!] as const,
        },
        {
          address: contractAddress!,
          abi: penguJarV3Abi,
          functionName: "getTotalContributed" as const,
          args: [jarId!] as const,
        },
        ...(viewer
          ? [
              {
                address: contractAddress!,
                abi: penguJarV3Abi,
                functionName: "getContribution" as const,
                args: [jarId!, viewer] as const,
              },
            ]
          : []),
      ]
    : [];

  const query = useReadContracts({ contracts, query: { enabled } });
  const jarResult = query.data?.[0];
  const totalResult = query.data?.[1];
  const viewerResult = query.data?.[2];
  let jar: Jar | undefined;

  if (jarResult?.status === "success" && totalResult?.status === "success" && jarId !== undefined) {
    const raw = jarResult.result as RawJar;
    jar = {
      id: jarId,
      owner: raw.owner,
      balance: raw.balance,
      targetAmount: raw.targetAmount,
      unlockTime: raw.unlockTime,
      createdAt: raw.createdAt,
      closed: raw.closed,
      mode: raw.mode,
      privacyMode: raw.privacyMode,
      withdrawalDelay: raw.withdrawalDelay,
      withdrawalReadyAt: raw.withdrawalReadyAt,
      metadataCommitment: raw.metadataCommitment,
      guardian: raw.guardian,
      frozen: raw.frozen,
      freezeRecoveryReadyAt: raw.freezeRecoveryReadyAt,
      pendingGuardian: raw.pendingGuardian,
      guardianChangeReadyAt: raw.guardianChangeReadyAt,
      recoveryWallet: raw.recoveryWallet,
      guardianChangeRecoveryApproved: raw.guardianChangeRecoveryApproved,
      pendingOwner: raw.pendingOwner,
      ownerRecoveryReadyAt: raw.ownerRecoveryReadyAt,
      guardianApprovedOwnerRecovery: raw.guardianApprovedOwnerRecovery,
      name: raw.name,
      totalContributed: totalResult.result as bigint,
    };
  }

  return {
    jar,
    viewerContribution:
      viewerResult?.status === "success" ? (viewerResult.result as bigint) : undefined,
    isLoading: query.isLoading,
    error: query.error || jarResult?.error || totalResult?.error,
    refetch: query.refetch,
  };
}
