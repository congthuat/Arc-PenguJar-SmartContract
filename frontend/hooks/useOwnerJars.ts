"use client";

import { useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import { penguJarV3Abi } from "@/lib/abi/penguJarV3";
import { contractAddress } from "@/lib/config";
import type { Jar, RawJar } from "@/lib/types";

export function useOwnerJars(owner?: Address) {
  const idsQuery = useReadContract({
    address: contractAddress,
    abi: penguJarV3Abi,
    functionName: "getOwnerJarIds",
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(contractAddress && owner) },
  });

  const ids = idsQuery.data ?? [];
  const contracts = ids.flatMap((id) => [
    {
      address: contractAddress!,
      abi: penguJarV3Abi,
      functionName: "getJar" as const,
      args: [id] as const,
    },
    {
      address: contractAddress!,
      abi: penguJarV3Abi,
      functionName: "getTotalContributed" as const,
      args: [id] as const,
    },
  ]);

  const jarsQuery = useReadContracts({
    contracts,
    query: { enabled: Boolean(contractAddress && ids.length) },
  });

  const jars: Jar[] = [];
  if (jarsQuery.data) {
    ids.forEach((id, index) => {
      const jarResult = jarsQuery.data?.[index * 2];
      const contributionResult = jarsQuery.data?.[index * 2 + 1];
      if (jarResult?.status !== "success" || contributionResult?.status !== "success") return;
      const raw = jarResult.result as RawJar;
      jars.push({
        id,
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
        totalContributed: contributionResult.result as bigint,
      });
    });
  }

  return {
    jars,
    isLoading: idsQuery.isLoading || (ids.length > 0 && jarsQuery.isLoading),
    error: idsQuery.error || jarsQuery.error,
    refetch: async () => {
      await idsQuery.refetch();
      await jarsQuery.refetch();
    },
  };
}
