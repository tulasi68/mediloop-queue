import { describe, expect, it } from "vitest";
import {
  calculateQueue,
  canTransition,
  isLate,
  type QueueConfig,
  type QueueEngineState,
} from "./index.js";

const now = Date.parse("2026-09-27T10:00:00+05:30");

const config: QueueConfig = {
  appointmentGraceMinutes: 10,
  latePriorityAfterWindow: true,
  defaultConsultationSeconds: 600,
};

function entry(
  id: string,
  token: string,
  type: "scheduled" | "walk_in",
  checkInAt: number,
  appointmentWindowEnd?: number,
  clinicalPriority?: {
    reason: string;
    confirmedBy: string;
    confirmedAt: number;
  },
) {
  return {
    id,
    token,
    patientId: id,
    patientName: id,
    type,
    checkInAt,
    status: "waiting" as const,
    ...(appointmentWindowEnd == null ? {} : { appointmentWindowEnd }),
    ...(clinicalPriority == null ? {} : { clinicalPriority }),
  };
}

describe("ClinicFlow queue engine", () => {
  it("keeps on-time scheduled patients ahead of late appointments and walk-ins", () => {
    const state: QueueEngineState = {
      entries: [
        entry("walk", "W-03", "walk_in", now - 30_000),
        entry("late", "A-02", "scheduled", now - 20_000, now - 20 * 60_000),
        entry("on-time", "A-01", "scheduled", now - 10_000, now + 20 * 60_000),
      ],
      current: null,
      durationsSeconds: [540, 600, 660],
    };

    const snapshot = calculateQueue(state, now, config);
    expect(snapshot.allWaiting.map((item) => item.token)).toEqual([
      "A-01",
      "A-02",
      "W-03",
    ]);
  });

  it("uses check-in order as the stable tie-breaker", () => {
    const state: QueueEngineState = {
      entries: [
        entry("b", "A-02", "scheduled", now - 5_000, now + 20 * 60_000),
        entry("a", "A-01", "scheduled", now - 10_000, now + 20 * 60_000),
      ],
      current: null,
      durationsSeconds: [],
    };

    const snapshot = calculateQueue(state, now, config);
    expect(snapshot.allWaiting.map((item) => item.token)).toEqual(["A-01", "A-02"]);
  });

  it("puts explicit clinical priority first without inferring it", () => {
    const priority = entry(
      "priority",
      "A-03",
      "scheduled",
      now - 30_000,
      now + 20 * 60_000,
    );
    priority.clinicalPriority = {
      reason: "doctor request",
      confirmedBy: "doctor-1",
      confirmedAt: now,
    };

    const normal = entry(
      "normal",
      "A-01",
      "scheduled",
      now - 40_000,
      now + 20 * 60_000,
    );

    const snapshot = calculateQueue(
      { entries: [normal, priority], current: null, durationsSeconds: [600] },
      now,
      config,
    );

    expect(snapshot.allWaiting.map((item) => item.token)).toEqual(["A-03", "A-01"]);
  });

  it("calculates remaining current consultation time and a wait range", () => {
    const state: QueueEngineState = {
      entries: [
        entry("next", "A-02", "scheduled", now - 60_000, now + 20 * 60_000),
        entry("later", "A-03", "scheduled", now - 30_000, now + 30 * 60_000),
      ],
      current: { queueEntryId: "current", startedAt: now - 5 * 60_000 },
      durationsSeconds: [600],
    };

    const snapshot = calculateQueue(state, now, config);
    expect(snapshot.next?.estimatedWaitMinutes).toEqual([5, 10]);
    expect(snapshot.waiting[0]?.estimatedWaitMinutes).toEqual([15, 20]);
  });

  it("enforces the explicit queue state machine", () => {
    expect(canTransition("registered", "checked_in")).toBe(true);
    expect(canTransition("waiting", "consulting")).toBe(false);
    expect(canTransition("consulting", "completed")).toBe(true);
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = canTransition("completed", "waiting");
      if (_) throw new Error("unexpected");
    }).not.toThrow();
  });

  it("identifies late appointments without creating a clinical priority", () => {
    const appointment = entry(
      "late",
      "A-09",
      "scheduled",
      now - 60 * 60_000,
      now - 15 * 60_000,
    );
    expect(isLate(appointment, now, config.appointmentGraceMinutes)).toBe(true);
    expect(appointment.clinicalPriority).toBeUndefined();
  });
});
