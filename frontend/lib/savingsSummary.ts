import type { Jar } from "./types";

type SummaryJar = Pick<Jar, "balance" | "targetAmount" | "closed">;

export function summarizeSavingsJars(jars: readonly SummaryJar[]) {
  return jars.reduce(
    (summary, jar) => {
      const goalReached = jar.targetAmount > 0n && jar.balance >= jar.targetAmount;
      const completed = jar.closed || goalReached;
      return {
        totalSaved: summary.totalSaved + jar.balance,
        active: summary.active + (completed ? 0 : 1),
        completed: summary.completed + (completed ? 1 : 0),
      };
    },
    { totalSaved: 0n, active: 0, completed: 0 },
  );
}
