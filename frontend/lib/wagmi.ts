import { createAppKit, type AppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createConfig, injected, type Config } from "wagmi";
import { fallback, http } from "viem";
import { arcTestnet } from "viem/chains";
import { ARC_PUBLIC_RPC_URLS, arcRpcUrl } from "./config";
import { REOWN_METADATA, resolveReownProjectId } from "./reown";

export const REOWN_PROJECT_ID = resolveReownProjectId(process.env.NEXT_PUBLIC_REOWN_PROJECT_ID);
export const isReownConfigured = Boolean(REOWN_PROJECT_ID);

export const configuredArcTestnet = {
  ...arcTestnet,
  rpcUrls: { default: { http: [arcRpcUrl] } },
} as const;

const transports = {
  [arcTestnet.id]: fallback(
    ARC_PUBLIC_RPC_URLS.map((url) => http(url, { retryCount: 1, retryDelay: 250, timeout: 10_000 })),
    { rank: false, retryCount: 1, retryDelay: 300 },
  ),
} as const;

let appKit: AppKit | undefined;
let wagmiConfig: Config;

if (REOWN_PROJECT_ID) {
  const adapter = new WagmiAdapter({ networks: [configuredArcTestnet], projectId: REOWN_PROJECT_ID, ssr: true, transports });
  wagmiConfig = adapter.wagmiConfig;
  appKit = createAppKit({
    adapters: [adapter],
    networks: [configuredArcTestnet],
    defaultNetwork: configuredArcTestnet,
    projectId: REOWN_PROJECT_ID,
    metadata: REOWN_METADATA,
    allowUnsupportedChain: false,
    features: { analytics: false, email: false, socials: false, swaps: false, onramp: false },
    themeVariables: { "--w3m-accent": "#7250ff", "--w3m-border-radius-master": "3px" },
  });
} else {
  wagmiConfig = createConfig({
    chains: [configuredArcTestnet],
    connectors: [injected({ shimDisconnect: true })],
    multiInjectedProviderDiscovery: true,
    ssr: true,
    transports,
  });
}

export function createWagmiConfig() { return wagmiConfig; }
export function getAppKit() { return appKit; }
