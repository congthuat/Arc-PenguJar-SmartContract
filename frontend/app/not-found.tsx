import Image from "next/image";
import Link from "next/link";
export default function NotFound() { return <main className="release-state"><Image src="/makoto/logo.png" alt="" width={72} height={72} /><p>Makoto Wallet · 404</p><h1>Page not found</h1><span>This page is not available in Makoto Wallet.</span><Link href="/">Return to Wallet</Link></main>; }
