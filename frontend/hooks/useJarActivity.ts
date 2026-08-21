"use client";

import { useQuery } from "@tanstack/react-query";
import { arcTestnet } from "viem/chains";
import { contractAddress, PENGUJAR_DEPLOYMENT_BLOCK } from "@/lib/config";
import { deserializeJarActivityResponse } from "@/lib/jarActivityApi";
import { incrementalScanStart, mergeActivityOverlap } from "@/lib/jarActivity";
import type { JarActivityItem } from "@/lib/types";

type VerifiedActivityScan = { items: JarActivityItem[]; lastScannedBlock: bigint };
const verifiedActivityCache = new Map<string, VerifiedActivityScan>();

export function useJarActivity(jarId?: bigint) {
  return useQuery({
    queryKey: ["jar-activity", arcTestnet.id, contractAddress, jarId?.toString()],
    enabled: Boolean(contractAddress && jarId),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      if (!contractAddress || !jarId) return [];
      const cacheKey = `${arcTestnet.id}:${contractAddress.toLowerCase()}:${jarId}`;
      const previous = verifiedActivityCache.get(cacheKey);
      const fromBlock = previous ? incrementalScanStart(PENGUJAR_DEPLOYMENT_BLOCK, previous.lastScannedBlock) : undefined;
      const query = new URLSearchParams({ jarId: jarId.toString(), ...(fromBlock === undefined ? {} : { fromBlock: fromBlock.toString() }) });
      const response = await fetch(`/api/jar-activity?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Jar Activity API unavailable.");
      const result = deserializeJarActivityResponse(await response.json());
      const items = previous && fromBlock !== undefined ? mergeActivityOverlap(previous.items, result.items, fromBlock) : result.items;
      verifiedActivityCache.set(cacheKey, { items, lastScannedBlock: result.lastScannedBlock });
      return items;
    },
  });
}
