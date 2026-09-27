import type { PoolClient } from "pg";
import type { QueueEngineState } from "../engine/queue.js";
import type { QueueEntry, QueueStatus } from "../engine/types.js";

type QueueRow = {
  id: string;
  token: string;
  patient_id: string;
  patient_name: string;
  patient_type: "scheduled" | "walk_in";
  window_start: Date | null;
  window_end: Date | null;
  check_in_at: Date | null;
  status: QueueStatus;
  priority_reason: string | null;
  priority_confirmed_by: string | null;
  priority_confirmed_at: Date | null;
};

type DurationRow = { duration_seconds: number | null };
type CurrentRow = { queue_entry_id: string; started_at: Date } | undefined;

export async function lockDoctor(client: PoolClient, doctorId: string): Promise<void> {
  const result = await client.query<{ id: string }>(
    "select id from doctors where id = $1 for update",
    [doctorId],
  );
  if (result.rowCount !== 1) throw new Error("Doctor not found");
}

export async function loadQueueState(
  client: PoolClient,
  clinicId: string,
  doctorId: string,
): Promise<QueueEngineState> {
  const rows = await client.query<QueueRow>(
    `select qe.id, qe.token, qe.patient_id, p.name as patient_name,
            qe.patient_type, a.window_start, a.window_end, qe.check_in_at,
            qe.status, qe.priority_reason, qe.priority_confirmed_by,
            qe.priority_confirmed_at
       from queue_entries qe
       join patients p on p.id = qe.patient_id
       left join appointments a on a.id = qe.appointment_id
      where qe.clinic_id = $1 and qe.doctor_id = $2
        and qe.status not in ('completed', 'no_show', 'rescheduled')
      order by qe.created_at asc`,
    [clinicId, doctorId],
  );

  const entries: QueueEntry[] = rows.rows.map((row) => {
    const entry: QueueEntry = {
      id: row.id,
      token: row.token,
      patientId: row.patient_id,
      patientName: row.patient_name,
      type: row.patient_type,
      status: row.status,
      ...(row.window_start ? { appointmentWindowStart: row.window_start.getTime() } : {}),
      ...(row.window_end ? { appointmentWindowEnd: row.window_end.getTime() } : {}),
      ...(row.check_in_at ? { checkInAt: row.check_in_at.getTime() } : {}),
      ...(row.priority_reason && row.priority_confirmed_by && row.priority_confirmed_at
        ? {
            clinicalPriority: {
              reason: row.priority_reason,
              confirmedBy: row.priority_confirmed_by,
              confirmedAt: row.priority_confirmed_at.getTime(),
            },
          }
        : {}),
    };
    return entry;
  });

  const durations = await client.query<DurationRow>(
    `select duration_seconds
       from consultations c
       join queue_entries qe on qe.id = c.queue_entry_id
      where qe.clinic_id = $1 and qe.doctor_id = $2
        and c.duration_seconds is not null
      order by c.completed_at desc
      limit 10`,
    [clinicId, doctorId],
  );

  const current = await client.query<{ queue_entry_id: string; started_at: Date }>(
    `select c.queue_entry_id, c.started_at
       from consultations c
       join queue_entries qe on qe.id = c.queue_entry_id
      where qe.clinic_id = $1 and qe.doctor_id = $2
        and c.completed_at is null
      order by c.started_at desc
      limit 1`,
    [clinicId, doctorId],
  );

  const currentRow: CurrentRow = current.rows[0];

  return {
    entries,
    current: currentRow
      ? { queueEntryId: currentRow.queue_entry_id, startedAt: currentRow.started_at.getTime() }
      : null,
    durationsSeconds: durations.rows.map((row) => row.duration_seconds ?? 0),
  };
}

export async function persistEntryStatus(
  client: PoolClient,
  entry: QueueEntry,
): Promise<void> {
  await client.query(
    `update queue_entries
        set status = $2,
            check_in_at = coalesce($3, check_in_at),
            priority_reason = $4,
            priority_confirmed_by = $5,
            priority_confirmed_at = $6
      where id = $1`,
    [
      entry.id,
      entry.status,
      entry.checkInAt ? new Date(entry.checkInAt) : null,
      entry.clinicalPriority?.reason ?? null,
      entry.clinicalPriority?.confirmedBy ?? null,
      entry.clinicalPriority?.confirmedAt ? new Date(entry.clinicalPriority.confirmedAt) : null,
    ],
  );
}

export async function insertCheckIn(
  client: PoolClient,
  queueEntryId: string,
  checkedInAt: number,
  actorId: string,
): Promise<void> {
  await client.query(
    `insert into check_ins (queue_entry_id, checked_in_at, actor_id)
     values ($1, $2, $3)
     on conflict (queue_entry_id) do update
       set checked_in_at = excluded.checked_in_at, actor_id = excluded.actor_id`,
    [queueEntryId, new Date(checkedInAt), actorId],
  );
}

export async function insertConsultation(
  client: PoolClient,
  queueEntryId: string,
  startedAt: number,
  actorId: string,
): Promise<void> {
  await client.query(
    `insert into consultations (queue_entry_id, started_at, actor_id)
     values ($1, $2, $3)
     on conflict (queue_entry_id) do update
       set started_at = excluded.started_at,
           completed_at = null,
           duration_seconds = null,
           actor_id = excluded.actor_id`,
    [queueEntryId, new Date(startedAt), actorId],
  );
}

export async function completeConsultation(
  client: PoolClient,
  queueEntryId: string,
  completedAt: number,
  durationSeconds: number,
  actorId: string,
): Promise<void> {
  await client.query(
    `update consultations
        set completed_at = $2, duration_seconds = $3, actor_id = $4
      where queue_entry_id = $1 and completed_at is null`,
    [queueEntryId, new Date(completedAt), durationSeconds, actorId],
  );
}

export async function insertEvent(
  client: PoolClient,
  event: {
    id: string;
    clinicId: string;
    queueEntryId?: string;
    type: string;
    occurredAt: number;
    actorId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  await client.query(
    `insert into queue_events
      (id, clinic_id, queue_entry_id, event_type, occurred_at, actor_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      event.id,
      event.clinicId,
      event.queueEntryId ?? null,
      event.type,
      new Date(event.occurredAt),
      event.actorId ?? null,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}
