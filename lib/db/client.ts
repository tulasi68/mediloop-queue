import { Pool, type PoolClient } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }

    pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
  }

  return pool;
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}