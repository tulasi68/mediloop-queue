# ClinicFlow — Product Workflow

## Core idea

**Appointment = reserved place in the doctor's queue, not a fixed consultation time.**

ClinicFlow treats the live queue as the operational source of truth.

## End-to-end workflow

```
APPOINTMENT / WALK-IN
        ↓
REGISTRATION
        ↓
CHECK-IN
        ↓
TOKEN ASSIGNED
        ↓
LIVE QUEUE
        ↓
NOW → NEXT → YOU
        ↓
CALL PATIENT
        ↓
CONSULTATION START
        ↓
CONSULTATION COMPLETE
        ↓
ACTUAL DURATION RECORDED
        ↓
QUEUE RECALCULATED
        ↓
LIVE UPDATE TO STAFF / PATIENT / BOARD
```

## Queue states

Registered → Checked in → Waiting → Approaching → Called → Consulting → Completed

Operational exceptions:

- Not arrived
- Temporarily away
- Late
- Clinic delay
- Clinical priority
- No-show
- Rescheduled

## Appointment behaviour

Appointments use arrival/appointment windows, for example:

**10:30–11:00 AM — please arrive by 10:20 AM**

The queue position is confirmed at check-in. Late arrival can change position according to clinic rules.

Walk-ins enter the same unified queue.

## Queue engine

Inputs:

- appointment window
- check-in time
- scheduled/walk-in type
- late state
- current consultation
- actual consultation durations
- clinic delay
- explicit clinical priority
- temporary absence

Outputs:

- current patient
- next patient
- waiting queue
- patients ahead
- estimated wait range
- journey state
- public display state
- notification events

The engine must not diagnose, prescribe, or infer clinical priority from symptoms. Clinical priority is an explicit, auditable operational state.

## Patient experience

The patient receives a simple live view:

- own token
- current token
- patients ahead
- estimated wait range
- queue status
- appointment window
- arrival status
- last update

Use **patients ahead** as the primary metric and a range such as **20–30 minutes** rather than a false exact promise.

Patient-specific access must use an opaque session identifier. The URL must not contain patient name, phone number, or clinical information.

## Staff experience

Staff controls:

- Register Patient
- Walk-in
- Check-in
- Call Next
- Start/Complete consultation
- Clinical Priority
- Clinic Delay
- Check In Again

Staff operates the queue; staff should not manipulate appointment times simply to force ordering.

## Doctor experience

The doctor dashboard provides situational awareness:

- current consultation
- next patient
- waiting count
- completed count
- recent average consultation duration
- estimated backlog

## Public board

The public board shows:

- current token
- next token(s)
- waiting tokens
- estimated wait
- queue status

**Never show patient names or clinical information on the public board.**

## Live events

The production system should be event-driven:

- patient.checked_in
- queue.position_changed
- patient.approaching
- patient.called
- consultation.started
- consultation.completed
- patient.no_show
- queue.priority_changed
- clinic.delay_started
- clinic.delay_resolved
- patient.returned

Every event can trigger queue recalculation and live dashboard updates.

## Product boundary

ClinicFlow is independent from:

- MediLoop AI
- AI Clinical Screening
- any EMR
- WhatsApp
- SMS
- any specific clinic software

Integration is through APIs/events/webhooks.

## Build sequence

### Phase 1 — Mock UI

Build and review:

1. Staff dashboard
2. Patient live queue
3. Doctor dashboard
4. Public board

Use one shared mock state so all four surfaces show the same clinic.

### Phase 2 — Queue Engine

Implement the authoritative state machine and deterministic queue rules.

### Phase 3 — Persistence/API

Add clinic, doctor, patient, appointment, queue entry, check-in, consultation and event persistence.

### Phase 4 — Live transport

Add WebSocket/SSE updates and patient-specific sessions.

### Phase 5 — Integrations

Add optional notifications and external-system webhooks.

### Phase 6 — Analytics

Add historical waiting-time, consultation-duration and clinic-flow analytics.

**Do not build integrations or AI before the core queue behaviour is accepted.**
