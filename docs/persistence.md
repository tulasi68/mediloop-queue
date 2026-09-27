# ClinicFlow persistence layer

The queue engine remains independent of PostgreSQL. The database stores durable clinic state and the event audit trail.

## Core tables

- clinics — clinic configuration and timezone
- doctors — doctors, departments and rooms
- patients — patient identity within a clinic
- appointments — appointment windows, not fixed consultation promises
- queue_entries — authoritative patient state for a doctor queue
- check_ins — check-in record
- consultations — start/completion timestamps and actual duration
- queue_events — append-only operational history

## Concurrency rule

Operations that can change a queue must execute inside a database transaction and lock the affected doctor's active queue state before calculating and committing the next state.

In particular:

- two staff devices must not call the same patient;
- a second consultation must not start while one is active;
- completion must record actual duration before the next queue calculation;
- priority changes must be auditable.

The API layer will load the relevant queue into the pure queue service, apply one state transition, persist the resulting changes and event in the same transaction, then return the new snapshot.

## Deployment boundary

The schema is PostgreSQL-compatible and can be hosted by Supabase or another PostgreSQL provider. ClinicFlow does not depend on Supabase-specific APIs.

If Supabase is selected, exposed tables need an explicit access model and RLS before patient data is exposed.
