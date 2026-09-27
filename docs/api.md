# ClinicFlow API

The first API slice exposes queue operations around the pure queue engine.

## Health

`GET /health`

## Read queue

`GET /api/queue?clinicId=<clinic>&doctorId=<doctor>`

Returns the current queue snapshot with:

- current consultation
- next patient
- waiting patients
- patients ahead
- estimated wait range

## Create queue entry from an upstream visit

`POST /api/queue-entries`

ClinicFlow does not register the patient. An upstream system supplies the existing patient and visit identifiers.

Scheduled visit:

```json
{
  "clinicId": "clinic-id",
  "doctorId": "doctor-id",
  "externalPatientId": "mediloop-patient-id",
  "patientName": "Meena",
  "externalVisitId": "mediloop-visit-id",
  "patientType": "scheduled",
  "windowStart": "2026-09-28T10:30:00+05:30",
  "windowEnd": "2026-09-28T11:00:00+05:30"
}
```

Walk-in:

```json
{
  "clinicId": "clinic-id",
  "doctorId": "doctor-id",
  "externalPatientId": "mediloop-patient-id",
  "patientName": "Meena",
  "externalVisitId": "mediloop-visit-id",
  "patientType": "walk_in"
}
```

The response contains the ClinicFlow queue entry ID and token. The external visit ID makes intake idempotent, so retrying the same visit does not create a duplicate queue entry.

## Check in

`POST /api/check-ins`

```json
{
  "clinicId": "clinic-id",
  "doctorId": "doctor-id",
  "queueEntryId": "queue-entry-id",
  "actorId": "staff-id"
}
```

The operation locks the doctor's queue, changes the patient to waiting, records the check-in and writes the audit event in one transaction.

## Call next

`POST /api/call-next`

```json
{
  "clinicId": "clinic-id",
  "doctorId": "doctor-id",
  "actorId": "staff-id"
}
```

The queue engine selects the next patient. The API does not accept an arbitrary patient ID for this operation.

## Start consultation

`POST /api/consultations/start`

```json
{
  "clinicId": "clinic-id",
  "doctorId": "doctor-id",
  "queueEntryId": "queue-entry-id",
  "actorId": "doctor-id"
}
```

Only the patient currently in the called state can start. A second active consultation is rejected.

## Complete consultation

`POST /api/consultations/complete`

```json
{
  "clinicId": "clinic-id",
  "doctorId": "doctor-id",
  "actorId": "doctor-id"
}
```

The actual consultation duration is calculated from the stored start time, persisted, and fed back into subsequent wait estimates.

## Concurrency

All queue-changing operations lock the doctor's row with PostgreSQL `SELECT ... FOR UPDATE` inside a transaction. PostgreSQL holds the row lock until transaction end, preventing two concurrent staff operations from mutating the same doctor's queue at the same time. citeturn0search3

This is intentional: ClinicFlow's queue is operational state, not merely a display.
