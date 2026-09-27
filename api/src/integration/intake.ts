import type { PoolClient } from "pg";

export type QueueIntake = {
  clinicId: string;
  doctorId: string;
  externalPatientId: string;
  patientName: string;
  externalVisitId: string;
  patientType: "scheduled" | "walk_in";
  windowStart?: string;
  windowEnd?: string;
};

export type QueueIntakeResult = {
  queueEntryId: string;
  token: string;
  patientId: string;
  externalPatientId: string;
  externalVisitId: string;
  patientType: "scheduled" | "walk_in";
};

function parseDate(value: string | undefined, field: string): Date | null {
  if (value === undefined) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} must be a valid ISO timestamp`);
  return parsed;
}

export async function createQueueEntryFromVisit(client: PoolClient, input: QueueIntake): Promise<QueueIntakeResult> {
  if (input.patientType === "scheduled" && (!input.windowStart || !input.windowEnd)) throw new Error("windowStart and windowEnd are required for scheduled visits");
  if (input.patientType === "walk_in" && (input.windowStart || input.windowEnd)) throw new Error("walk-in visits must not include an appointment window");
  const windowStart = parseDate(input.windowStart, "windowStart");
  const windowEnd = parseDate(input.windowEnd, "windowEnd");
  if (windowStart && windowEnd && windowEnd <= windowStart) throw new Error("windowEnd must be after windowStart");

  const doctor = await client.query<{ id: string; clinic_id: string }>("select id, clinic_id from doctors where id = $1", [input.doctorId]);
  const doctorRow = doctor.rows[0];
  if (doctor.rowCount !== 1 || !doctorRow || doctorRow.clinic_id !== input.clinicId) throw new Error("Doctor not found for clinic");

  const patient = await client.query<{ id: string }>(
    `insert into patients (clinic_id, external_patient_id, name)
     values ($1, $2, $3)
     on conflict (clinic_id, external_patient_id) do update set name = excluded.name
     returning id`,
    [input.clinicId, input.externalPatientId, input.patientName],
  );
  const patientId = patient.rows[0]?.id;
  if (!patientId) throw new Error("Unable to create patient reference");

  const existing = await client.query<{ id: string; token: string; patient_id: string }>(
    `select id, token, patient_id from queue_entries
      where clinic_id = $1 and doctor_id = $2 and external_visit_id = $3 limit 1`,
    [input.clinicId, input.doctorId, input.externalVisitId],
  );
  if (existing.rowCount === 1) {
    const row = existing.rows[0];
    if (!row) throw new Error("Unable to read existing queue entry");
    if (row.patient_id !== patientId) throw new Error("Visit is already linked to another patient");
    return { queueEntryId: row.id, token: row.token, patientId, externalPatientId: input.externalPatientId, externalVisitId: input.externalVisitId, patientType: input.patientType };
  }

  let appointmentId: string | null = null;
  if (input.patientType === "scheduled") {
    const appointment = await client.query<{ id: string }>(
      `insert into appointments (clinic_id, doctor_id, patient_id, external_visit_id, window_start, window_end)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [input.clinicId, input.doctorId, patientId, input.externalVisitId, windowStart, windowEnd],
    );
    appointmentId = appointment.rows[0]?.id ?? null;
  }

  const prefix = input.patientType === "scheduled" ? "A" : "W";
  const tokenRows = await client.query<{ token: string }>(
    `select token from queue_entries where clinic_id = $1 and doctor_id = $2 and token like $3 order by created_at desc`,
    [input.clinicId, input.doctorId, `${prefix}-%`],
  );
  let maxNumber = 0;
  for (const row of tokenRows.rows) {
    const match = new RegExp("^" + prefix + "-(\\d+)$").exec(row.token);
    const numberText = match?.[1];
    if (numberText) maxNumber = Math.max(maxNumber, Number(numberText));
  }
  const token = `${prefix}-${String(maxNumber + 1).padStart(2, "0")}`;

  const queue = await client.query<{ id: string }>(
    `insert into queue_entries (clinic_id, doctor_id, patient_id, appointment_id, external_visit_id, token, patient_type)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [input.clinicId, input.doctorId, patientId, appointmentId, input.externalVisitId, token, input.patientType],
  );
  const queueEntryId = queue.rows[0]?.id;
  if (!queueEntryId) throw new Error("Unable to create queue entry");
  return { queueEntryId, token, patientId, externalPatientId: input.externalPatientId, externalVisitId: input.externalVisitId, patientType: input.patientType };
}