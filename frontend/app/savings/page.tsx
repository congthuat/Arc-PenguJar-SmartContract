import { Dashboard } from "@/components/Dashboard";
export default async function SavingsPage({ searchParams }: { searchParams: Promise<{ owner?: string }> }) { const { owner } = await searchParams; return <Dashboard initialOwner={owner} />; }
