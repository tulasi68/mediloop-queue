# ClinicFlow — Real-Time Patient Flow Management

## Product: ClinicFlow

**ClinicFlow — Real-Time Patient Flow Management**

ClinicFlow is a standalone, integration-agnostic patient-flow platform for outpatient clinics. It manages appointments, walk-ins, check-ins, queue movement, actual consultation progress, waiting-time estimates, patient notifications, and public displays as one live view of the clinic.

The product is designed around a simple idea:

> **An appointment reserves a place in the doctor's queue; it does not promise an exact consultation time.**

The system should reflect how real clinics actually operate rather than forcing clinics into rigid appointment-slot behaviour.

---

## 1. The Problem

In Indian small clinics, appointments and walk-ins are often one chaotic stream. Patients may arrive early, arrive late, walk in without appointments, temporarily leave, return, or expect to be seen immediately. Consultation duration varies significantly, doctors may be delayed, and clinical priorities may occasionally change the order.

A conventional appointment scheduler treats the calendar as the source of truth.

ClinicFlow treats the **live queue** as the source of truth.

The objective is not to promise zero waiting or an exact consultation time. The objective is to:

- manage the queue fairly and transparently;
- keep staff in control of clinic operations;
- give doctors live situational awareness;
- give patients useful real-time information;
- reduce repeated questions such as "When will the doctor see me?";
- adapt continuously as the clinic changes during the day.

---

## 2. Product Category

ClinicFlow should not be positioned primarily as appointment-management software.

**Category: Real-Time Patient Flow Management**

Potential positioning:

- "Appointments. Walk-ins. Waiting. Calling. Delays. One live queue."
- "Know where you are. Know what's happening. Know when you're next."
- "Your clinic's live status board — for every patient, every doctor, every queue."

Core promise:

> **ClinicFlow helps the clinic manage the queue fairly and keeps patients informed.**

---

## 3. Product Inspiration

ClinicFlow combines familiar patterns from high-volume service environments:

### Passport Seva
Transparent status tracking:
- Registered
- Processing
- Ready
- Completed

### Airport
Live operational information:
- Current
- Next
- Waiting
- Delay
- Status

### Swiggy / Zomato
Real-time personal tracking:
- current status;
- progress;
- changing estimates;
- event-driven notifications.

### ClinicFlow

A live patient journey:

**Registered → Checked in → Waiting → Approaching → Called → Consulting → Completed**

The clinic waiting room becomes a live service journey rather than an opaque period of waiting.

---

## 4. Core Workflow

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
CONSULTATION
        ↓
START / COMPLETE
        ↓
ACTUAL CONSULTATION DURATION
        ↓
QUEUE RECALCULATED
        ↓
NEXT PATIENT
```

The queue engine continuously recalculates the live state.

---

## 5. Appointment Model

### Avoid fixed consultation slots

A booking such as:

**10:15 AM — consultation**

creates an expectation that the doctor will see the patient at 10:15.

That is usually unrealistic in outpatient clinics.

Instead, ClinicFlow uses **arrival/appointment windows**.

Example:

**Appointment: 10:30–11:00 AM**  
**Please arrive by: 10:20 AM**

The individual booking order can still be retained internally.

The patient-facing promise is:

> Your appointment gives you priority within the clinic queue. Your exact consultation time depends on the live queue and consultation durations.

### Patient confirmation

Example:

> Your clinic visit is scheduled for 10:30–11:00 AM. Please arrive by 10:20 AM. Your queue position will be confirmed when you check in. If you arrive late, your position may change.

Do not promise an exact consultation time.

---

## 6. Patient Types

ClinicFlow should support one unified queue containing:

1. Scheduled patients
2. Walk-ins
3. Late scheduled patients

Additional internal states may include:

- Not arrived
- Temporarily away
- Clinical priority
- Doctor delay
- No-show
- Rescheduled

These states should remain operationally simple for patients.

### Late arrivals

A late patient should not automatically be marked as missed.

Example:

- Appointment: 9:30 AM
- Arrives 9:20 → On time
- Arrives 9:38 → Late
- Arrives 10:05 → Very late

Rules should be configurable by the clinic.

Possible default behaviour:

**On-time appointment → Late appointment → Walk-in**

subject to clinic configuration and clinical priority.

The important principle is that staff should not have to manipulate appointment times to make the queue work.

---

## 7. Walk-ins

Walk-ins enter the same live queue.

Example token:

**W-07**

There should not be a completely separate "walk-in queue" that patients cannot understand.

The queue engine determines the position according to configured clinic rules.

---

## 8. Check-in

The most important staff event is:

**Patient has arrived.**

Flow:

**Appointment → Checked-in → Queue position assigned → Waiting**

Walk-in:

**Walk-in registration → Token assigned → Queue**

Once checked in, the patient becomes part of the live operational queue.

---

## 9. Queue Engine

The Queue Engine is the single source of truth.

### Inputs

- appointments;
- appointment windows;
- walk-ins;
- check-ins;
- late status;
- no-shows;
- doctor availability;
- consultation start;
- consultation completion;
- actual consultation duration;
- clinical priority;
- temporary absence;
- clinic delays.

### Outputs

- current queue;
- current patient;
- next patient;
- waiting patients;
- queue positions;
- patients ahead;
- estimated waiting range;
- patient journey status;
- notification events;
- public display state.

### Continuous recalculation

When a consultation starts:

**consultation.started → queue recalculated → positions updated → wait estimates updated → notifications evaluated**

When a consultation completes:

**consultation.completed → queue recalculated → positions updated → wait estimates updated → notifications evaluated**

The system must respond to what is actually happening rather than assuming a fixed consultation duration.

---

## 10. Queue Display

Example:

```
NOW
A-14

NEXT
A-15

WAITING
A-16
A-17
W-07

YOUR TOKEN
A-17

PATIENTS AHEAD
2

ESTIMATED WAIT
20–30 MIN

QUEUE UPDATED
JUST NOW
```

The primary patient metric should be:

**Patients ahead**

Waiting time is secondary and should be expressed as a range.

Avoid false precision such as:

**"Doctor will see you in 18 minutes."**

Prefer:

**"Estimated wait: 15–30 minutes."**

---

## 11. Dynamic Waiting Estimates

Consultation durations are not fixed.

Example historical/live durations:

- A-11 → 6 minutes
- A-12 → 16 minutes
- A-13 → 15 minutes
- A-14 → 19 minutes

The queue engine can use recent actual consultation durations to estimate the remaining wait.

The patient should see only a simple range.

Internally, the system can eventually learn:

- recent consultation duration;
- doctor-specific patterns;
- time-of-day patterns;
- queue backlog;
- clinic delay.

The statistical complexity should remain hidden from patients.

---

## 12. True Waiting Time

ClinicFlow should measure waiting time from:

**actual patient arrival/check-in → actual consultation start**

This allows the system to distinguish:

- appointment time;
- arrival time;
- queue entry time;
- actual waiting time;
- consultation duration.

Useful clinic metrics include:

- average waiting time;
- median waiting time;
- longest waiting time;
- average consultation duration;
- current backlog;
- completed consultations;
- waiting patients.

---

## 13. Patient Mobile Dashboard

The patient experience should be extremely simple.

It should feel more like tracking a delivery or airport status than using an EMR.

Example:

```
CLINICFLOW

Dr. Rao — ENT

YOUR TOKEN
A-17

CURRENTLY CONSULTING
A-14

PATIENTS AHEAD
2

ESTIMATED WAIT
20–30 min

STATUS
Waiting

QUEUE
Moving normally

UPDATED
Just now

APPOINTMENT
10:00–10:30

ARRIVED
9:45
```

The page should update automatically where technically feasible.

The patient should not need:

- an app;
- login;
- password;
- Play Store installation;
- account creation.

---

## 14. Patient Journey Tracker

```
Registered
    ↓
Checked in
    ↓
Waiting
    ↓
Approaching
    ↓
Called
    ↓
Consulting
    ↓
Completed
```

The journey is intentionally simple.

The patient does not need to understand internal queue states.

---

## 15. QR Gateway

The QR code is the gateway to the patient's live queue.

Reception can display:

> **CHECK YOUR QUEUE — SCAN HERE**

The QR should open a patient-specific session.

Important security principle:

- no patient name in the URL;
- no phone number in the URL;
- no clinical information in the URL;
- use an opaque short-lived token/session identifier.

A global public QR must not expose an individual's queue information.

---

## 16. Return Later

A useful later feature is:

**WAIT / RETURN LATER**

Example:

> 7 patients ahead  
> Estimated wait: 45–60 minutes

Patient can choose:

**RETURN LATER**

Status becomes:

**Temporarily away**

When the queue reaches an approaching threshold, the patient can be notified.

Example:

> You are now approximately 2 patients away. Please return to the clinic.

On return:

**Check In Again**

This formalizes a behaviour that already occurs in real clinics.

---

## 17. Public Clinic Display

An optional TV/tablet/monitor can provide an airport-style operational dashboard.

Example:

```
CLINICFLOW

DR. RAO — ENT

NOW CONSULTING
A-14

NEXT
A-15

WAITING
A-16  A-17  W-07

ESTIMATED WAIT
20–30 MIN

PLEASE WAIT FOR YOUR TOKEN
```

Only tokens should be displayed publicly, not patient names.

This is particularly useful for:

- elderly patients;
- patients without smartphones;
- accompanying family members;
- poor connectivity;
- patients who do not want to use QR.

---

## 18. Multi-Doctor Display

The system should eventually support multiple doctors, rooms and departments.

Example:

```
DR. RAO — ENT / ROOM 2
NOW A-104
NEXT A-105
WAITING 5

DR. SHETTY — GP / ROOM 1
NOW B-22
NEXT B-23
WAITING 4
```

The architecture should not assume one doctor per clinic.

---

## 19. Staff Dashboard

The staff dashboard is the operational control centre.

It should be a queue-management screen rather than a traditional calendar.

Example:

```
TODAY'S CLINIC

24 appointments
8 walk-ins
18 checked in
12 completed
6 waiting

NOW
A-17 — Patient
Consulting

NEXT
A-18

WAITING
A-19
W-08
A-20
W-09

NOT ARRIVED
A-21
A-22

+ REGISTER PATIENT
+ WALK-IN
CALL NEXT
PRIORITY
CLINIC DELAY
```

Primary sections:

- NOW
- NEXT
- WAITING
- NOT ARRIVED

Primary actions:

- Register patient
- Walk-in
- Call next
- Priority
- Clinic delay

Avoid forcing reception staff to manage a complicated calendar throughout the day.

---

## 20. Doctor Dashboard

The doctor needs situational awareness, not appointment-calendar administration.

Example:

```
TODAY
12 / 24 completed

NOW
A-17 — Patient
Consulting: 8 min

NEXT
A-18

WAITING
6 patients

AVERAGE CONSULTATION
11.8 min

ESTIMATED BACKLOG
~55 min
```

The doctor should be able to see queue status without having to operate the reception workflow.

---

## 21. Clinical Priority

ClinicFlow should not have a "VIP" queue.

The appropriate concept is:

**Clinical Priority**

Possible reasons:

- acute distress;
- child;
- elderly/frail patient;
- doctor request;
- clinically urgent situation;
- other documented reason.

Staff can flag:

**Possible Priority**

An authorized clinician or staff role confirms the priority.

Priority changes must be:

- visible;
- auditable;
- attributable;
- timestamped;
- associated with a reason.

Initial priority rules should be deterministic and understandable.

AI should not make opaque queue-priority decisions.

AI may later assist with operational prediction, but queue rules should remain explainable.

---

## 22. Clinic Delay

Staff should have a simple action:

**Clinic Delay**

If the doctor or clinic is delayed, patient-facing communication should be neutral:

> The clinic is currently experiencing a delay.

The system recalculates estimated waiting ranges.

Avoid exposing unnecessary internal operational details.

---

## 23. Notifications

Notifications should be event-driven.

### Appointment booked

> Your clinic visit is scheduled for 10:30–11:00 AM. Please arrive by 10:20 AM.

### Checked in

> You're checked in. There are 4 patients ahead.

### Queue movement

> You're now 2 patients away.

### Approaching

> Your consultation is approaching. Please remain available.

### Called

> It's your turn. Please proceed to the consultation area.

### Delay

> The clinic is currently experiencing a delay. Your queue remains active.

WhatsApp can be an optional channel.

SMS can be a fallback.

ClinicFlow must not depend on WhatsApp.

---

## 24. Event Model

Important system events:

```
patient.checked_in
queue.position_changed
patient.approaching
patient.called
consultation.started
consultation.completed
patient.no_show
queue.priority_changed
clinic.delay_started
clinic.delay_resolved
patient.returned
```

The event model allows integrations without forcing external systems to continuously poll ClinicFlow.

---

## 25. API-First Architecture

ClinicFlow must be integration-agnostic.

It should work:

1. Standalone
2. Alongside another EMR/practice-management system
3. Integrated with MediLoop AI
4. Integrated with other future clinical systems

Conceptual write APIs:

```
POST /patients
POST /appointments
POST /check-ins
POST /walk-ins
POST /consultations/start
POST /consultations/complete
POST /queue/priority
POST /queue/delay
```

Conceptual read APIs:

```
GET /queue/today
GET /queue/{token}
GET /patients/{id}/journey
GET /queue/{token}/position
```

These are initial concepts, not the final API contract.

---

## 26. Architecture

```
                    EVENTS
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   Appointment     Walk-in       Check-in
        │             │             │
        └─────────────┼─────────────┘
                      ▼
                 QUEUE ENGINE
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
     PATIENT        STAFF         DISPLAY
     MOBILE        DASHBOARD        TV
        │
     Optional
   Notifications
        │
   WhatsApp / SMS
```

The Queue Engine is the central source of truth.

External applications can send events through APIs and receive changes through webhooks/events.

---

## 27. Standalone Product Boundary

ClinicFlow is a separate product.

It must not depend on:

- MediLoop AI;
- AI Clinical Screening;
- a particular EMR;
- a particular messaging provider;
- a particular clinic software.

MediLoop AI is simply one possible integration.

### Product ecosystem

```
                    CLINICFLOW
              Real-Time Patient Flow
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
 Standalone       Existing EMR      MediLoop AI
     Clinic          + ClinicFlow    + ClinicFlow
       │                                │
       │                         AI Clinical Screening
       │                                │
       └────────────────┬───────────────┘
                        ▼
                  Doctor / Clinic
```

Each product remains independently useful.

---

## 28. MediLoop Integration

When integrated with the user's broader healthcare ecosystem:

```
Registration
     ↓
ClinicFlow
     ↓
AI Clinical Screening
     ↓
Clinic Queue
     ↓
Doctor
     ↓
MediLoop AI
     ↓
Clinical Evidence
     ↓
Summary
     ↓
Prescription
     ↓
Follow-up
```

But the boundaries remain clear:

### ClinicFlow
Patient movement, queue, waiting and operational flow.

### AI Clinical Screening
Patient-reported information before consultation.

### MediLoop AI
Clinical consultation intelligence and clinical workflow assistance.

ClinicFlow does not need to understand:

- diagnosis;
- prescription;
- RAG;
- FHIR clinical content.

---

## 29. Commercial Modes

ClinicFlow can support three deployment models:

### 1. Standalone ClinicFlow
For clinics with no suitable existing patient-flow system.

### 2. ClinicFlow + Existing EMR
For clinics that already have an EMR or practice-management system but need better real-time patient flow.

### 3. MediLoop Ecosystem
ClinicFlow + AI Clinical Screening + MediLoop AI.

The commercial positioning should make it clear:

> **If you already use another EMR, ClinicFlow can work alongside it.**

---

# V1 Scope

## Core queue

1. Appointment windows
2. Patient registration
3. Check-in
4. Automatic token
5. Walk-in registration
6. Today's queue
7. Now / Next / Waiting
8. Late status
9. Not Arrived
10. Call Next
11. Consultation Start
12. Consultation Complete
13. Actual waiting-time measurement
14. Basic dynamic queue

## Patient

15. Patient-specific QR
16. Patient queue page
17. Live position
18. Patients ahead
19. Estimated waiting range
20. Queue status

## Public display

21. Public token display
22. Current patient
23. Next patients
24. Waiting count
25. Estimated waiting range

## Notifications

26. Appointment notification
27. Check-in notification
28. Approaching notification
29. Called notification
30. Delay notification

---

# V2

Potential additions:

- Return Later;
- dynamic consultation-duration prediction;
- doctor-delay management;
- clinical priority;
- audit trail;
- multi-doctor queues;
- multiple rooms;
- multiple departments;
- WhatsApp;
- SMS fallback.

---

# V3

Potential additions:

- queue analytics;
- patient arrival behaviour analysis;
- clinic waiting-time analytics;
- historical consultation-duration models;
- capacity prediction;
- integration ecosystem;
- operational intelligence.

AI should only be added where it provides genuine value.

The underlying queue rules should remain understandable and deterministic.

---

# Product Principles

1. **Live queue over rigid calendar**
2. **Patients ahead over false precision**
3. **Ranges over exact waiting-time promises**
4. **Actual clinic behaviour over theoretical scheduling**
5. **Transparency over uncertainty**
6. **Simple patient experience**
7. **Operational control for staff**
8. **Situational awareness for doctors**
9. **Explainable queue rules**
10. **Auditable priority changes**
11. **API-first integration**
12. **Standalone product architecture**
13. **No dependency on MediLoop**
14. **No dependency on WhatsApp**
15. **No clinical decision-making by the queue engine**

---

# One-Sentence Product Definition

> **ClinicFlow is an integration-agnostic, real-time patient-flow platform for outpatient clinics that combines appointments, walk-ins, check-ins, queue management, consultation progress, waiting-time estimates, patient notifications and public displays into one live view of the clinic.**

# Product Opportunity

> **ClinicFlow turns the clinic waiting room into a live, transparent service journey.**

---

# Initial Development Direction

The repository should initially focus on the Queue Engine and the three primary experiences:

1. **Staff operational dashboard**
2. **Patient live queue page**
3. **Public clinic display**

The first implementation should establish the queue as the authoritative state machine before adding integrations, AI, messaging providers or advanced analytics.

The architecture should make it possible to build and test ClinicFlow completely independently of MediLoop AI.
