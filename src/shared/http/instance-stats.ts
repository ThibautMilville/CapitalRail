/**
 * Real counters for this server instance only (in-memory, reset on restart).
 * Nothing here is estimated or seeded.
 */
type Stats = {
  startedAt: string;
  preflights: number;
  go: number;
  wait: number;
  noGo: number;
};

const globalStats = globalThis as typeof globalThis & {
  __capitalRailStats?: Stats;
};

function stats(): Stats {
  globalStats.__capitalRailStats ??= {
    startedAt: new Date().toISOString(),
    preflights: 0,
    go: 0,
    wait: 0,
    noGo: 0,
  };
  return globalStats.__capitalRailStats;
}

export function recordDecision(decision: "GO" | "WAIT" | "NO-GO") {
  const current = stats();
  current.preflights += 1;
  if (decision === "GO") current.go += 1;
  else if (decision === "WAIT") current.wait += 1;
  else current.noGo += 1;
}

export type InstanceStats = Stats & {
  /** WAIT + NO-GO: deposits that would have failed or broken the rules, stopped before signing. */
  failedDepositsAvoided: number;
  scope: string;
};

export function readStats(): InstanceStats {
  const current = stats();
  return {
    ...current,
    failedDepositsAvoided: current.wait + current.noGo,
    scope: "this server instance, since start (in-memory)",
  };
}
