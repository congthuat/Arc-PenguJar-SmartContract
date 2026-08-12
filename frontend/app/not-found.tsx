import Link from "next/link";

export default function NotFound() {
  return (
    <main className="centered-page">
      <div className="state-card">
        <span className="state-icon">?</span>
        <h1>Jar not found</h1>
        <p>Check the jar ID and try again.</p>
        <Link className="text-link" href="/">Back to dashboard</Link>
      </div>
    </main>
  );
}
