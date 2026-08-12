import type { ReactNode } from "react";

export function StatePanel({ icon, title, children, action }: { icon: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="state-card">
      <span className="state-icon" aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
      <div className="state-copy">{children}</div>
      {action}
    </section>
  );
}
