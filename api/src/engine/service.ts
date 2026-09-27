import type { ClinicFlowEvent } from "../events/events.js";
import { createEvent } from "../events/events.js";
import { calculateQueue, type QueueEngineState } from "./queue.js";
import { transitionStatus } from "./state-machine.js";
import type { Consultation, QueueConfig, QueueEntry, QueueSnapshot } from "./types.js";

export class QueueService {
  private readonly events: ClinicFlowEvent[] = [];

  constructor(
    private readonly clinicId: string,
    private readonly config: QueueConfig,
    private readonly state: QueueEngineState,
  ) {}

  snapshot(now: number): QueueSnapshot {
    return calculateQueue(this.state, now, this.config);
  }

  checkIn(queueEntryId: string, now: number, actorId: string): QueueSnapshot {
    const entry = this.requireEntry(queueEntryId);
    if (entry.status === "registered") {
      entry.status = transitionStatus(entry.status, "checked_in");
    }
    entry.checkInAt = now;
    entry.status = transitionStatus(entry.status, "waiting");
    this.emit("patient.checked_in", now, queueEntryId, actorId);
    return this.snapshot(now);
  }

  callNext(now: number, actorId: string): QueueSnapshot {
    const current = this.snapshot(now);
    if (current.current) {
      throw new Error("A consultation is already active");
    }

    const next = current.next;
    if (!next) return current;

    next.status = transitionStatus(next.status, "called");
    this.emit("patient.called", now, next.id, actorId);
    return this.snapshot(now);
  }

  startConsultation(queueEntryId: string, now: number, actorId: string): QueueSnapshot {
    const entry = this.requireEntry(queueEntryId);
    if (this.state.current) throw new Error("A consultation is already active");
    if (entry.status !== "called") throw new Error("Patient must be called before consultation starts");
    entry.status = transitionStatus(entry.status, "consulting");
    this.state.current = { queueEntryId, startedAt: now };
    this.emit("consultation.started", now, queueEntryId, actorId);
    return this.snapshot(now);
  }

  completeConsultation(now: number, actorId: string): QueueSnapshot {
    const current = this.state.current;
    if (!current) throw new Error("No active consultation");

    const entry = this.requireEntry(current.queueEntryId);
    entry.status = transitionStatus(entry.status, "completed");

    const durationSeconds = Math.max(0, Math.floor((now - current.startedAt) / 1000));
    this.state.durationsSeconds.push(durationSeconds);
    this.state.current = null;

    this.emit("consultation.completed", now, entry.id, actorId, {
      durationSeconds,
    });

    return this.snapshot(now);
  }

  eventsSince(index = 0): ClinicFlowEvent[] {
    return this.events.slice(index);
  }

  private requireEntry(queueEntryId: string): QueueEntry {
    const entry = this.state.entries.find((item) => item.id === queueEntryId);
    if (!entry) throw new Error(`Queue entry not found: ${queueEntryId}`);
    return entry;
  }

  private emit(
    type: ClinicFlowEvent["type"],
    occurredAt: number,
    queueEntryId: string,
    actorId: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): void {
    this.events.push(
      createEvent(type, this.clinicId, occurredAt, {
        queueEntryId,
        actorId,
        ...(metadata ? { metadata } : {}),
      }),
    );
  }
}
