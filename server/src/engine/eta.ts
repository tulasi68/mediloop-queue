import type { Consultation, QueueEntry } from "./types.js";

function mean(values: readonly number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function averageConsultationSeconds(
  durationsSeconds: readonly number[],
  fallbackSeconds: number,
): number {
  return mean(durationsSeconds.slice(-10), fallbackSeconds);
}

export function estimateWaitRangeMinutes(
  index: number,
  averageSeconds: number,
  now: number,
  currentConsultation?: Consultation | null,
  rangeFactor = 0.5,
): [number, number] {
  const elapsed = currentConsultation
    ? Math.max(0, Math.floor((now - currentConsultation.startedAt) / 1000))
    : 0;

  const remaining = currentConsultation
    ? Math.max(0, averageSeconds - elapsed)
    : 0;

  const lowSeconds = remaining + index * averageSeconds;
  const highSeconds = lowSeconds + Math.round(averageSeconds * rangeFactor);

  return [
    Math.floor(lowSeconds / 60),
    Math.max(1, Math.ceil(highSeconds / 60)),
  ];
}

export function withWaitEstimates(
  entries: readonly QueueEntry[],
  averageSeconds: number,
  now: number,
  currentConsultation?: Consultation | null,
): Array<QueueEntry & { patientsAhead: number; estimatedWaitMinutes: [number, number] }> {
  return entries.map((entry, index) => ({
    ...entry,
    patientsAhead: index,
    estimatedWaitMinutes: estimateWaitRangeMinutes(
      index,
      averageSeconds,
      now,
      currentConsultation,
    ),
  }));
}
