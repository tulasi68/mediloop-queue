import type { IncomingMessage, ServerResponse } from "node:http";
import { server } from "../server/src/index.js";

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  server.emit("request", req, res);
}
