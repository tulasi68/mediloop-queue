export default async function handler(req: Request): Promise<Response> {
  return Response.json({ service: "clinicflow-api", status: "ok" });
}
