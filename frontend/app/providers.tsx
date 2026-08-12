"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { createWagmiConfig } from "@/lib/wagmi";
import { WalletNetworkProvider } from "@/hooks/useVerifiedWalletChain";
import { PreferenceProvider } from "@/hooks/usePreferences";
import type { Locale, ThemePreference } from "@/i18n";

export function Providers({ children, initialLocale, initialTheme }: { children: ReactNode; initialLocale: Locale; initialTheme: ThemePreference }) {
  const [queryClient] = useState(() => new QueryClient());
  const [wagmiConfig] = useState(createWagmiConfig);

  return (
    <PreferenceProvider initialLocale={initialLocale} initialTheme={initialTheme}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <WalletNetworkProvider>{children}</WalletNetworkProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PreferenceProvider>
  );
}
