import { describe, expect, it } from "vitest";
import { QueueService, type QueueConfig, type QueueEngineState, type QueueEntry } from "./index.js";

const now = Date.parse("2026-09-27T10:00:00+05:30");

const config: QueueConfig = {
  appointmentGraceMinutes: 10,
  latePriorityAfterWindow: true,
  defaultConsultationSeconds: 600,
};

function waitingEntry(id: string, token: string, checkInAt: number): QueueEntry {
  return {
    id,
    token,
    patientId: id,
    patientName: `Patient ${id}`,
    type: "scheduled",
    checkInAt,
    status: "waiting",
  };
}

describe("QueueService", () => {
  it("calls the queue engine's next patient rather than letting the caller choose an arbitrary patient", () => {
    const state: QueueEngineState = {
      entries: [
        waitingEntry("later", "A-02", now - 60_000),
        waitingEntry("first", "A-01", now - 120_000),
      ],
      current: null,
      durationsSeconds: [600],
    };

    const service = new QueueService("clinic-1", config, state);
    service.callNext(now, "staff-1");

    expect(state.entries.find((entry) => entry.token === "A-01")?.status).toBe("called");
    expect(state.entries.find((entry) => entry.token === "A-02")?.status).toBe("waiting");
  });

  it("records actual consultation duration on completion", () => {
    const state: QueueEngineState = {
      entries: [waitingEntry("first", "A-01", now - 120_000)],
      current: null,
      durationsSeconds: [],
    };

    const service = new QueueService("clinic-1", config, state);
    service.callNext(now, "staff-1");
    service.startConsultation("first", now + 30_000, "doctor-1");
    const snapshot = service.completeConsultation(now + 10 * 60_000 + 30_000, "doctor-1");

    expect(state.durationsSeconds).toEqual([600]);
    expect(snapshot.current).toBeNull();
    expect(snapshot.allWaiting).toHaveLength(0);
    expect(service.eventsSince()).toHaveLength(3);
  });

  it("rejects calling another patient while a consultation is active", () => {
    const state: QueueEngineState = {
      entries: [
        waitingEntry("first", "A-01", now - 120_000),
        waitingEntry("second", "A-02", now - 60_000),
      ],
      current: null,
      durationsSeconds: [600],
    };

    const service = new QueueService("clinic-1", config, state);
    service.callNext(now, "staff-1");
    service.startConsultation("first", now + 1_000, "doctor-1");

    expect(() => service.callNext(now + 2_000, "staff-1")).toThrow(
      "A consultation is already active",
    );
  });
});
