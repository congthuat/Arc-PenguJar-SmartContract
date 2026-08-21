"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { arcTestnet } from "viem/chains";
import { decodeEventLog, encodeEventTopics, toHex, type Hex } from "viem";
import { penguJarV3Abi } from "@/lib/abi/penguJarV3";
import { contractAddress, PENGUJAR_DEPLOYMENT_BLOCK } from "@/lib/config";
import { fetchAdaptiveRange, incrementalScanStart, loadBlockTimestamps, mergeActivityOverlap, withRateLimitRetry } from "@/lib/jarActivity";
import type { JarActivityItem } from "@/lib/types";

type ActivityLog = {
  eventName: "JarCreated" | "JarDeposited" | "JarContributed" | "JarWithdrawn";
  args: Record<string, unknown>;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
};

type RawRpcLog = {
  address: Hex;
  blockHash: Hex;
  blockNumber: Hex;
  data: Hex;
  logIndex: Hex;
  removed: boolean;
  topics: [Hex, ...Hex[]];
  transactionHash: Hex;
  transactionIndex: Hex;
};

type VerifiedActivityScan = { items: JarActivityItem[]; lastScannedBlock: bigint };

const blockTimestampCache = new Map<string, bigint>();
const verifiedActivityCache = new Map<string, VerifiedActivityScan>();
const eventNames = ["JarCreated", "JarDeposited", "JarContributed", "JarWithdrawn"] as const;
const eventTopics = eventNames.map((eventName) => encodeEventTopics({ abi: penguJarV3Abi, eventName })[0]);

export function useJarActivity(jarId?: bigint) {
  const publicClient = usePublicClient({ chainId: arcTestnet.id });

  return useQuery({
    queryKey: ["jar-activity", arcTestnet.id, contractAddress, jarId?.toString()],
    enabled: Boolean(publicClient && contractAddress && jarId),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      if (!publicClient || !contractAddress || !jarId) return [];
      const cacheKey = `${arcTestnet.id}:${contractAddress.toLowerCase()}:${jarId}`;
      try {
        const latestBlock = await withRateLimitRetry(() => publicClient.getBlockNumber());
        if (latestBlock < PENGUJAR_DEPLOYMENT_BLOCK) return [];
        const previous = verifiedActivityCache.get(cacheKey);
        const canIncrement = previous !== undefined && latestBlock >= previous.lastScannedBlock;
        const fromBlock = canIncrement ? incrementalScanStart(PENGUJAR_DEPLOYMENT_BLOCK, previous.lastScannedBlock) : PENGUJAR_DEPLOYMENT_BLOCK;
        const jarTopic = toHex(jarId, { size: 32 });
        const rawLogs = await fetchAdaptiveRange<RawRpcLog>({
          fromBlock,
          toBlock: latestBlock,
          request: (rangeStart, rangeEnd) => publicClient.request({
            method: "eth_getLogs",
            params: [{ address: contractAddress, topics: [eventTopics, jarTopic], fromBlock: toHex(rangeStart), toBlock: toHex(rangeEnd) }],
          }) as Promise<RawRpcLog[]>,
        });
        const logs = decodeActivityLogs(rawLogs);
        const blockNumbers = logs.map(({ blockNumber }) => blockNumber);
        await loadBlockTimestamps(
          blockNumbers,
          blockTimestampCache,
          (blockNumber) => `${arcTestnet.id}:${blockNumber}`,
          async (blockNumber) => (await publicClient.getBlock({ blockNumber })).timestamp,
          3,
        );
        const freshItems = activityItems(logs);
        const items = canIncrement && previous ? mergeActivityOverlap(previous.items, freshItems, fromBlock) : mergeActivityOverlap([], freshItems, fromBlock);
        verifiedActivityCache.set(cacheKey, { items, lastScannedBlock: latestBlock });
        return items;
      } catch (error) {
        console.error(`[PenguJar] Activity query failed for jar ${jarId} on Arc Testnet.`, error);
        throw error;
      }
    },
  });
}

function decodeActivityLogs(rawLogs: readonly RawRpcLog[]): ActivityLog[] {
  return rawLogs.flatMap((log): ActivityLog[] => {
    if (log.removed) return [];
    const decoded = decodeEventLog({ abi: penguJarV3Abi, data: log.data, topics: log.topics });
    if (!eventNames.includes(decoded.eventName as (typeof eventNames)[number])) return [];
    return [{
      eventName: decoded.eventName as ActivityLog["eventName"],
      args: decoded.args as Record<string, unknown>,
      blockNumber: BigInt(log.blockNumber),
      transactionHash: log.transactionHash,
      logIndex: Number(BigInt(log.logIndex)),
    }];
  });
}

function activityItems(logs: readonly ActivityLog[]): JarActivityItem[] {
  return logs.flatMap((log): JarActivityItem[] => {
    const timestamp = blockTimestampCache.get(`${arcTestnet.id}:${log.blockNumber}`);
    if (timestamp === undefined) return [];
    const actor = log.eventName === "JarCreated" || log.eventName === "JarWithdrawn"
      ? log.args.owner
      : log.eventName === "JarDeposited"
        ? log.args.from
        : log.args.contributor;
    if (typeof actor !== "string" || !actor.startsWith("0x")) return [];
    const amount = log.eventName === "JarCreated" ? undefined : log.args.amount;
    return [{
      id: `${log.transactionHash}-${log.logIndex}`,
      type: log.eventName === "JarCreated" ? "created" : log.eventName === "JarDeposited" ? "deposit" : log.eventName === "JarContributed" ? "contribution" : "withdrawal",
      actor: actor as `0x${string}`,
      amount: typeof amount === "bigint" ? amount : undefined,
      timestamp,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
    }];
  });
}
