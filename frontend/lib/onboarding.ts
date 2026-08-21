export const ONBOARDING_INTENT_KEY = "makoto_wallet_onboarding_intent";

export type OnboardingPath = "create" | "existing";
export type CreateWalletMethod = "email" | "google";
export type WalletKind = "embedded" | "external";

export function appKitViewForPath(path: OnboardingPath) {
  return path === "create" ? "Connect" as const : "AllWallets" as const;
}

const createMethodViews: Record<CreateWalletMethod, "Connect"> = { email: "Connect", google: "Connect" };

export function appKitViewForCreateMethod(method: CreateWalletMethod) {
  return createMethodViews[method];
}

export function walletKindFromConnector(connectorId: string | undefined): WalletKind {
  return connectorId?.toUpperCase() === "AUTH" ? "embedded" : "external";
}

export function shouldShowWalletReady(
  intent: OnboardingPath | undefined,
  connected: boolean,
  connectorId: string | undefined,
) {
  return intent === "create" && connected && walletKindFromConnector(connectorId) === "embedded";
}

export function parseOnboardingIntent(value: string | null): OnboardingPath | undefined {
  return value === "create" || value === "existing" ? value : undefined;
}
