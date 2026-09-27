import type { QueueStatus } from "./types.js";

const transitions: Record<QueueStatus, readonly QueueStatus[]> = {
  registered: ["checked_in", "rescheduled"],
  checked_in: ["waiting", "temporarily_away", "no_show"],
  waiting: ["approaching", "called", "temporarily_away", "no_show"],
  approaching: ["called", "waiting", "temporarily_away"],
  called: ["consulting", "waiting", "temporarily_away"],
  consulting: ["completed"],
  completed: [],
  temporarily_away: ["waiting", "approaching", "no_show"],
  no_show: ["rescheduled"],
  rescheduled: [],
};

export function canTransition(from: QueueStatus, to: QueueStatus): boolean {
  return transitions[from].includes(to);
}

export function transitionStatus(
  from: QueueStatus,
  to: QueueStatus,
): QueueStatus {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid queue transition: ${from} → ${to}`);
  }
  return to;
}
