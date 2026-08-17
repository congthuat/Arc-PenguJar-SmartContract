export const REOWN_METADATA = {
  name: "Makoto Wallet",
  description: "A non-custodial wallet built for Arc.",
  url: "https://makoto-wallet.vercel.app",
  icons: ["https://makoto-wallet.vercel.app/makoto/logo-pro-v2.png"],
};

export function resolveReownProjectId(value: string | undefined) {
  const projectId = value?.trim();
  return projectId || undefined;
}
