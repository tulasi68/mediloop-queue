import type { QueueEntry } from "./types.js";
import { isLate } from "./priority.js";

export function shouldMarkNoShow(
  entry: QueueEntry,
  now: number,
  graceMinutes: number,
  noShowAfterMinutes: number,
): boolean {
  if (entry.status !== "checked_in" && entry.status !== "waiting") return false;
  if (entry.type !== "scheduled") return false;
  if (!isLate(entry, now, graceMinutes)) return false;

  const reference = entry.appointmentWindowEnd ?? entry.checkInAt;
  return now >= reference + noShowAfterMinutes * 60_000;
}
