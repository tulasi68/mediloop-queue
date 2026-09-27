import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getPool, withTransaction } from "./db/client.js";
import {
  completeConsultation,
  insertCheckIn,
  insertConsultation,
  insertEvent,
  loadQueueState,
  lockDoctor,
  persistEntryStatus,
} from "./db/queue-repository.js";
import { QueueService } from "./engine/service.js";
import { createQueueEntryFromVisit } from "./integration/intake.js";

const PORT = Number(process.env.PORT ?? 3001);
const CONFIG = {
  appointmentGraceMinutes: Number(process.env.APPOINTMENT_GRACE_MINUTES ?? 10),
  latePriorityAfterWindow: true,
  defaultConsultationSeconds: Number(process.env.DEFAULT_CONSULTATION_SECONDS ?? 11 * 60),
};

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  });
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

async function mutateQueue(
  clinicId: string,
  doctorId: string,
  actorId: string,
  mutation: (service: QueueService, now: number) => Promise<{ queueEntryId?: string }>,
): Promise<unknown> {
  return withTransaction(async (client) => {
    await lockDoctor(client, doctorId);
    const state = await loadQueueState(client, clinicId, doctorId);
    const service = new QueueService(clinicId, CONFIG, state);
    const eventIndex = service.eventsSince().length;
    const now = Date.now();

    const result = await mutation(service, now);

    if (result.queueEntryId) {
      const entry = state.entries.find((item) => item.id === result.queueEntryId);
      if (entry) await persistEntryStatus(client, entry);
    }

    for (const event of service.eventsSince(eventIndex)) {
      await insertEvent(client, event);
    }

    return service.snapshot(now);
  });
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      json(response, 204, {});
      return;
    }

    const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);

    if (request.method === "GET" && url.pathname === "/health") {
      json(response, 200, { service: "clinicflow-api", status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/queue") {
      const clinicId = url.searchParams.get("clinicId");
      const doctorId = url.searchParams.get("doctorId");
      if (!clinicId || !doctorId) throw new Error("clinicId and doctorId are required");

      const client = await getPool().connect();
      try {
        const state = await loadQueueState(client, clinicId, doctorId);
        const service = new QueueService(clinicId, CONFIG, state);
        json(response, 200, service.snapshot(Date.now()));
      } finally {
        client.release();
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/queue-entries") {
      const input = await body(request);
      const clinicId = requiredString(input, "clinicId");
      const doctorId = requiredString(input, "doctorId");
      const externalPatientId = requiredString(input, "externalPatientId");
      const patientName = requiredString(input, "patientName");
      const externalVisitId = requiredString(input, "externalVisitId");
      const patientType = input.patientType;
      if (patientType !== "scheduled" && patientType !== "walk_in") {
        throw new Error("patientType must be scheduled or walk_in");
      }
      const windowStart = typeof input.windowStart === "string" ? input.windowStart : undefined;
      const windowEnd = typeof input.windowEnd === "string" ? input.windowEnd : undefined;

      const result = await withTransaction(async (client) => {
        await lockDoctor(client, doctorId);
        return createQueueEntryFromVisit(client, {
          clinicId,
          doctorId,
          externalPatientId,
          patientName,
          externalVisitId,
          patientType,
          ...(windowStart ? { windowStart } : {}),
          ...(windowEnd ? { windowEnd } : {}),
        });
      });

      json(response, 201, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/check-ins") {
      const input = await body(request);
      const clinicId = requiredString(input, "clinicId");
      const doctorId = requiredString(input, "doctorId");
      const queueEntryId = requiredString(input, "queueEntryId");
      const actorId = requiredString(input, "actorId");

      const result = await withTransaction(async (client) => {
        await lockDoctor(client, doctorId);
        const state = await loadQueueState(client, clinicId, doctorId);
        const service = new QueueService(clinicId, CONFIG, state);
        const eventIndex = service.eventsSince().length;
        const now = Date.now();
        const snapshot = service.checkIn(queueEntryId, now, actorId);
        const entry = state.entries.find((item) => item.id === queueEntryId);
        if (entry) await persistEntryStatus(client, entry);
        await insertCheckIn(client, queueEntryId, now, actorId);
        for (const event of service.eventsSince(eventIndex)) await insertEvent(client, event);
        return snapshot;
      });

      json(response, 200, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/call-next") {
      const input = await body(request);
      const clinicId = requiredString(input, "clinicId");
      const doctorId = requiredString(input, "doctorId");
      const actorId = requiredString(input, "actorId");

      const result = await withTransaction(async (client) => {
        await lockDoctor(client, doctorId);
        const state = await loadQueueState(client, clinicId, doctorId);
        const service = new QueueService(clinicId, CONFIG, state);
        const eventIndex = service.eventsSince().length;
        const now = Date.now();
        const before = service.snapshot(now);
        const resultSnapshot = service.callNext(now, actorId);
        const called = before.next;
        if (called) {
          const entry = state.entries.find((item) => item.id === called.id);
          if (entry) await persistEntryStatus(client, entry);
        }
        for (const event of service.eventsSince(eventIndex)) await insertEvent(client, event);
        return resultSnapshot;
      });

      json(response, 200, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/consultations/start") {
      const input = await body(request);
      const clinicId = requiredString(input, "clinicId");
      const doctorId = requiredString(input, "doctorId");
      const queueEntryId = requiredString(input, "queueEntryId");
      const actorId = requiredString(input, "actorId");

      const result = await withTransaction(async (client) => {
        await lockDoctor(client, doctorId);
        const state = await loadQueueState(client, clinicId, doctorId);
        const service = new QueueService(clinicId, CONFIG, state);
        const eventIndex = service.eventsSince().length;
        const now = Date.now();
        const snapshot = service.startConsultation(queueEntryId, now, actorId);
        const entry = state.entries.find((item) => item.id === queueEntryId);
        if (entry) await persistEntryStatus(client, entry);
        await insertConsultation(client, queueEntryId, now, actorId);
        for (const event of service.eventsSince(eventIndex)) await insertEvent(client, event);
        return snapshot;
      });

      json(response, 200, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/consultations/complete") {
      const input = await body(request);
      const clinicId = requiredString(input, "clinicId");
      const doctorId = requiredString(input, "doctorId");
      const actorId = requiredString(input, "actorId");

      const result = await withTransaction(async (client) => {
        await lockDoctor(client, doctorId);
        const state = await loadQueueState(client, clinicId, doctorId);
        const service = new QueueService(clinicId, CONFIG, state);
        const eventIndex = service.eventsSince().length;
        const now = Date.now();
        const currentId = state.current?.queueEntryId;
        const snapshot = service.completeConsultation(now, actorId);
        if (!currentId) throw new Error("No active consultation");
        const entry = state.entries.find((item) => item.id === currentId);
        if (entry) await persistEntryStatus(client, entry);
        const completedEvent = service.eventsSince(eventIndex).find(
          (event) => event.type === "consultation.completed",
        );
        const durationSeconds =
          typeof completedEvent?.metadata?.durationSeconds === "number"
            ? completedEvent.metadata.durationSeconds
            : 0;
        await completeConsultation(client, currentId, now, durationSeconds, actorId);
        for (const event of service.eventsSince(eventIndex)) await insertEvent(client, event);
        return snapshot;
      });

      json(response, 200, result);
      return;
    }

    json(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("required") || message.includes("must be") ? 400 :
      message.includes("not found") ? 404 :
      409;
    json(response, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`ClinicFlow API listening on :${PORT}`);
});
