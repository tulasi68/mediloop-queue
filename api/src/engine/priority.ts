import type { QueueEntry } from "./types.js";

export function isLate(entry: QueueEntry, now: number, graceMinutes: number): boolean {
  if (entry.type !== "scheduled" || entry.appointmentWindowEnd == null) return false;
  return now > entry.appointmentWindowEnd + graceMinutes * 60_000;
}

export function priorityRank(
  entry: QueueEntry,
  now: number,
  graceMinutes: number,
): number {
  // Explicit clinical priority is an operational override. It is never inferred here.
  if (entry.clinicalPriority) return 0;

  if (entry.type === "scheduled" && !isLate(entry, now, graceMinutes)) return 1;
  if (entry.type === "scheduled" && isLate(entry, now, graceMinutes)) return 2;
  return 3;
}

export function sortQueue(
  entries: readonly QueueEntry[],
  now: number,
  graceMinutes: number,
): QueueEntry[] {
  return [...entries]
    .filter((entry) => entry.status === "waiting" || entry.status === "approaching")
    .sort((a, b) => {
      const rank = priorityRank(a, now, graceMinutes) - priorityRank(b, now, graceMinutes);
      if (rank !== 0) return rank;
      return (a.checkInAt ?? Number.MAX_SAFE_INTEGER) - (b.checkInAt ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
    });
}
