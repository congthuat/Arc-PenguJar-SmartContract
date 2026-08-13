"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { arcTestnet } from "viem/chains";
import { decodeEventLog, encodeEventTopics, toHex, type Hex } from "viem";
import { penguJarV3Abi } from "@/lib/abi/penguJarV3";
import { contractAddress, PENGUJAR_DEPLOYMENT_BLOCK } from "@/lib/config";
import type { JarActivityItem } from "@/lib/types";

type ActivityLog = {
  eventName: "JarCreated" | "JarDeposited" | "JarContributed" | "JarWithdrawn";
  args: Record<string, unknown>;
  blockNumber: bigint | null;
  transactionHash: `0x${string}` | null;
  logIndex: number | null;
};

const blockTimestampCache = new Map<string, bigint>();
let activityRpcQueue: Promise<unknown> = Promise.resolve();
const ACTIVITY_BLOCK_CHUNK = 10_000n;

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
      try {
        const latestBlock = await queuedRpc(() => publicClient.getBlockNumber());
        const logs: ActivityLog[] = [];
        const eventNames = ["JarCreated", "JarDeposited", "JarContributed", "JarWithdrawn"] as const;
        const eventTopics = eventNames.map((eventName) => encodeEventTopics({ abi: penguJarV3Abi, eventName })[0]);
        const jarTopic = toHex(jarId, { size: 32 });

        async function fetchActivityRange(fromBlock: bigint, toBlock: bigint): Promise<ActivityLog[]> {
          for (let attempt = 0; attempt < 4; attempt += 1) {
            try {
              const eventLogs = await queuedRpc(() => publicClient!.request({
                method: "eth_getLogs",
                params: [{
                  address: contractAddress!,
                  topics: [eventTopics, jarTopic],
                  fromBlock: toHex(fromBlock),
                  toBlock: toHex(toBlock),
                }],
              })) as RawRpcLog[];
              return eventLogs.map((log) => {
                const decoded = decodeEventLog({ abi: penguJarV3Abi, data: log.data, topics: log.topics });
                return {
                  eventName: decoded.eventName,
                  args: decoded.args as Record<string, unknown>,
                  blockNumber: BigInt(log.blockNumber),
                  transactionHash: log.transactionHash,
                  logIndex: Number(BigInt(log.logIndex)),
                } as ActivityLog;
              });
            } catch (error) {
              const message = rpcErrorMessage(error);
              if (isRateLimitError(message) && attempt < 3) {
                await delay(600 * (attempt + 1));
                continue;
              }
              if (isRangeLimitError(message) && fromBlock < toBlock) {
                const middle = (fromBlock + toBlock) / 2n;
                const first = await fetchActivityRange(fromBlock, middle);
                await delay(150);
                const second = await fetchActivityRange(middle + 1n, toBlock);
                return [...first, ...second];
              }
              throw error;
            }
          }
          return [];
        }

        for (let fromBlock = PENGUJAR_DEPLOYMENT_BLOCK; fromBlock <= latestBlock; fromBlock += ACTIVITY_BLOCK_CHUNK) {
          const chunkEnd = fromBlock + ACTIVITY_BLOCK_CHUNK - 1n;
          const toBlock = chunkEnd < latestBlock ? chunkEnd : latestBlock;
          logs.push(...await fetchActivityRange(fromBlock, toBlock));
        }

        const blockNumbers = [...new Set(logs.flatMap((log) => log.blockNumber === null ? [] : [log.blockNumber]))];
        for (const blockNumber of blockNumbers) {
          const cacheKey = `${arcTestnet.id}:${blockNumber}`;
          if (!blockTimestampCache.has(cacheKey)) {
            let block;
            for (let attempt = 0; attempt < 4; attempt += 1) {
              try {
                block = await queuedRpc(() => publicClient.getBlock({ blockNumber }));
                break;
              } catch (error) {
                if (!isRateLimitError(rpcErrorMessage(error)) || attempt === 3) throw error;
                await delay(600 * (attempt + 1));
              }
            }
            if (!block) throw new Error(`Arc block ${blockNumber} was unavailable.`);
            blockTimestampCache.set(cacheKey, block.timestamp);
          }
        }

        return logs.flatMap((log): JarActivityItem[] => {
          if (log.blockNumber === null || log.transactionHash === null) return [];
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
            id: `${log.transactionHash}-${log.logIndex ?? 0}`,
            type: log.eventName === "JarCreated" ? "created" : log.eventName === "JarDeposited" ? "deposit" : log.eventName === "JarContributed" ? "contribution" : "withdrawal",
            actor: actor as `0x${string}`,
            amount: typeof amount === "bigint" ? amount : undefined,
            timestamp,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex ?? 0,
          }];
        }).sort((a, b) => a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1);
      } catch (error) {
        console.error(`[PenguJar] Activity query failed for jar ${jarId} on Arc Testnet.`, error);
        throw error;
      }
    },
  });
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function queuedRpc<T>(request: () => Promise<T>): Promise<T> {
  const result = activityRpcQueue.then(request, request);
  activityRpcQueue = result.then(() => delay(250), () => delay(250));
  return result;
}

function rpcErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const details = "details" in error && typeof error.details === "string" ? error.details : "";
  return `${error.message} ${details}`;
}

function isRateLimitError(message: string) {
  return /rate limit|too many requests|\b429\b/i.test(message);
}

function isRangeLimitError(message: string) {
  return /block range|range limit|range too large|requested range|response size|too many results|query returned more than/i.test(message);
}
