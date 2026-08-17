"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { arcTestnet } from "viem/chains";

import { deserializeWalletActivityPage, normalizeWalletActivities } from "@/lib/onchainActivity";
import { loadWalletActivity, mergeWalletActivity } from "@/lib/walletActivity";

export function useWalletActivity(address?: Address, enabled = false) {
  const query = useInfiniteQuery({
    queryKey: ["wallet-activity", arcTestnet.id, address?.toLowerCase()],
    enabled: Boolean(address && enabled),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      if (!address) throw new Error("Wallet address is required");
      const params = new URLSearchParams({ address });
      if (pageParam) params.set("cursor", pageParam);
      const response = await fetch(`/api/wallet-activity?${params}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Activity could not be loaded");
      return deserializeWalletActivityPage(await response.json());
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 15_000,
    refetchInterval: enabled ? 25_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const data = useMemo(() => {
    const onchain = normalizeWalletActivities(query.data?.pages.flatMap((page) => page.activities) ?? []);
    const local = address ? loadWalletActivity(address, arcTestnet.id) : [];
    return mergeWalletActivity(onchain, local);
  }, [address, query.data]);

  return {
    data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    loadMore: query.fetchNextPage,
    isLoadingMore: query.isFetchingNextPage,
  };
}
