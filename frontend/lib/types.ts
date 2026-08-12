import type { Address } from "viem";

export type Jar = {
  id: bigint;
  owner: Address;
  balance: bigint;
  targetAmount: bigint;
  unlockTime: bigint;
  createdAt: bigint;
  closed: boolean;
  name: string;
  totalContributed: bigint;
};

export type RawJar = Omit<Jar, "id" | "totalContributed">;

export type JarActivityItem = {
  id: string;
  type: "created" | "deposit" | "contribution" | "unlocked" | "withdrawal";
  actor: Address;
  amount?: bigint;
  timestamp: bigint;
  transactionHash?: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
};
