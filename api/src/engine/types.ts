export type QueueStatus =
  | "registered"
  | "checked_in"
  | "waiting"
  | "approaching"
  | "called"
  | "consulting"
  | "completed"
  | "temporarily_away"
  | "no_show"
  | "rescheduled";

export type PatientType = "scheduled" | "walk_in";

export interface QueueEntry {
  id: string;
  token: string;
  patientId: string;
  patientName: string;
  type: PatientType;
  appointmentWindowStart?: number;
  appointmentWindowEnd?: number;
  checkInAt: number;
  status: QueueStatus;
  clinicalPriority?: {
    reason: string;
    confirmedBy: string;
    confirmedAt: number;
  };
}

export interface Consultation {
  queueEntryId: string;
  startedAt: number;
}

export interface QueueConfig {
  appointmentGraceMinutes: number;
  latePriorityAfterWindow: boolean;
  defaultConsultationSeconds: number;
}

export interface QueueSnapshotEntry extends QueueEntry {
  patientsAhead: number;
  estimatedWaitMinutes: [number, number];
}

export interface QueueSnapshot {
  current: QueueEntry | null;
  next: QueueSnapshotEntry | null;
  waiting: QueueSnapshotEntry[];
  allWaiting: QueueSnapshotEntry[];
}
