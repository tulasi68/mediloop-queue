export type ClinicFlowEventType =
  | "patient.checked_in"
  | "queue.position_changed"
  | "patient.approaching"
  | "patient.called"
  | "consultation.started"
  | "consultation.completed"
  | "patient.no_show"
  | "queue.priority_changed"
  | "clinic.delay_started"
  | "clinic.delay_resolved"
  | "patient.returned";

export interface ClinicFlowEvent {
  id: string;
  type: ClinicFlowEventType;
  occurredAt: number;
  clinicId: string;
  queueEntryId?: string;
  actorId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export function createEvent(
  type: ClinicFlowEventType,
  clinicId: string,
  occurredAt: number,
  values: Omit<ClinicFlowEvent, "id" | "type" | "clinicId" | "occurredAt"> = {},
): ClinicFlowEvent {
  return {
    id: crypto.randomUUID(),
    type,
    clinicId,
    occurredAt,
    ...values,
  };
}
