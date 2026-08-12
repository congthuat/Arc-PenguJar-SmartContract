import { JarDetail } from "@/components/JarDetail";

export default async function JarPage({ params }: { params: Promise<{ jarId: string }> }) {
  const { jarId } = await params;
  return <JarDetail jarIdParam={jarId} />;
}
