# ClinicFlow

ClinicFlow is a single-page queue display for MediLoop Clinical AI.

## Only responsibility

MediLoop Clinical AI remains the source of patient registration information.

ClinicFlow receives one simple queue update message from MediLoop and displays:

- the newly added patient;
- the most recently completed patient;
- total patients remaining;
- the current queue.

There is **no patient registration system, database, queue engine, authentication, messaging system, analytics, doctor dashboard, patient dashboard, public-board mode, or separate API layer** in this version.

## Integration

The page is designed to be embedded in, or opened by, MediLoop Clinical AI.

MediLoop sends one message shape:

```js
{
  source: "mediloop-ai",
  type: "QUEUE_UPDATE",
  action: "added" | "completed" | "snapshot",
  clinicName: "Clinic name",
  patient: {
    id: "patient-id",
    token: "A-01",
    name: "Patient name"
  },
  patients: [
    {
      id: "patient-id",
      token: "A-01",
      name: "Patient name"
    }
  ],
  remainingCount: 4
}
```

For a new registration, use `action: "added"`.

For a completed patient, use `action: "completed"`.

For an initial/full refresh, use `action: "snapshot"`.

The page sends this message back to MediLoop when it is ready:

```js
{
  source: "clinicflow",
  type: "QUEUE_READY"
}
```

Cross-origin communication uses `window.postMessage`. The page accepts messages only from the configured MediLoop production origin and local development origins.

## Repository

The runtime is intentionally only:

```
index.html
README.md
```

No build step is required. No Docker. No Vercel configuration file. No npm package is required.

Vercel can serve the static page directly. Vercel supports zero-configuration deployment of static sites, and its `api` directory is only needed when serverless functions are actually required. citeturn0search0

## Product boundary

```
MediLoop Clinical AI
        │
        │ QUEUE_UPDATE
        ▼
    ClinicFlow
        │
        ▼
   One queue page
```

ClinicFlow does not become another patient-management application.
