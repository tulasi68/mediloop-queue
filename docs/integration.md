# ClinicFlow Integration Boundary

ClinicFlow does not register patients or own the clinic's master patient record.

An upstream system such as MediLoop Clinical AI registers the patient and visit, then sends the visit to ClinicFlow. ClinicFlow creates the operational queue entry and owns the live patient-flow state.

## Intake endpoint

POST /api/queue-entries

Scheduled visits require windowStart and windowEnd. Walk-ins do not.

The endpoint is idempotent for the combination of clinic, doctor and external visit ID. Repeating the same visit does not create a second queue entry.

## Ownership

Upstream registration system:
- patient registration
- patient demographics
- visit creation
- appointment booking
- patient identity

ClinicFlow:
- queue entry
- token
- check-in
- waiting order
- call
- consultation state
- waiting-time estimates
- live queue events

ClinicFlow stores a small patient reference/snapshot locally so queue operations can display the patient name. It is not a replacement patient-registration system.

## Queue safety

The intake operation runs inside the same transaction as the doctor-row lock used by other queue mutations. PostgreSQL row-level FOR UPDATE locks prevent competing writers/lockers on the same doctor row until the transaction ends.
