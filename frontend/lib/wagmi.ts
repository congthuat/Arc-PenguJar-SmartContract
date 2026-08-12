import { createConfig, injected } from "wagmi";
import { fallback, http } from "viem";
import { arcTestnet } from "viem/chains";
import { ARC_PUBLIC_RPC_URLS, arcRpcUrl } from "./config";

export function createWagmiConfig() {
  const configuredArcTestnet = {
    ...arcTestnet,
    rpcUrls: { default: { http: [arcRpcUrl] } },
  } as const;

  return createConfig({
    chains: [configuredArcTestnet],
    connectors: [
      injected({
        target: {
          id: "okx",
          name: "OKX Wallet",
          provider(window) {
            const ethereum = window?.ethereum;
            const providers = ethereum?.providers ?? [];
            const legacyOkx = (window as (typeof window & { okxwallet?: typeof ethereum }) | undefined)?.okxwallet;
            return providers.find((provider) => provider.isOkxWallet || provider.isOKExWallet)
              ?? (ethereum?.isOkxWallet || ethereum?.isOKExWallet ? ethereum : undefined)
              ?? legacyOkx;
          },
        },
      }),
      injected({ shimDisconnect: true }),
    ],
    multiInjectedProviderDiscovery: true,
    ssr: true,
    transports: {
      [arcTestnet.id]: fallback(
        ARC_PUBLIC_RPC_URLS.map((url) => http(url, { retryCount: 1, retryDelay: 250, timeout: 10_000 })),
        { rank: false, retryCount: 1, retryDelay: 300 },
      ),
    },
  });
}
