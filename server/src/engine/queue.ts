import type {
  Consultation,
  QueueConfig,
  QueueEntry,
  QueueSnapshot,
} from "./types.js";
import { averageConsultationSeconds, withWaitEstimates } from "./eta.js";
import { sortQueue } from "./priority.js";

export interface QueueEngineState {
  entries: QueueEntry[];
  current: Consultation | null;
  durationsSeconds: number[];
}

export function calculateQueue(
  state: QueueEngineState,
  now: number,
  config: QueueConfig,
): QueueSnapshot {
  const sorted = sortQueue(state.entries, now, config.appointmentGraceMinutes);
  const averageSeconds = averageConsultationSeconds(
    state.durationsSeconds,
    config.defaultConsultationSeconds,
  );

  const estimated = withWaitEstimates(
    sorted,
    averageSeconds,
    now,
    state.current,
  );

  const currentEntry =
    state.current == null
      ? null
      : state.entries.find((entry) => entry.id === state.current?.queueEntryId) ?? null;

  return {
    current: currentEntry,
    next: estimated[0] ?? null,
    waiting: estimated.slice(1),
    allWaiting: estimated,
  };
}
