import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
const empty = () => ({ observations: [], records: {}, sessions: [], runs: [] });
export function createEvidenceStore(config = process.env) {
  let pool,
    redis,
    mode,
    queue = Promise.resolve();
  const key = "product-hunter:evidence:v1",
    file =
      config.EVIDENCE_FILE ||
      new URL("./data/evidence-store.json", import.meta.url).pathname;
  async function init() {
    if (mode) return mode;
    if (config.DATABASE_URL) {
      const { Pool } = await import("pg");
      pool = new Pool({
        connectionString: config.DATABASE_URL,
        ssl: config.PGSSL === "disable" ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });
      await pool.query(
        "CREATE TABLE IF NOT EXISTS evidence_portal (id text PRIMARY KEY,payload jsonb NOT NULL)",
      );
      await pool.query(
        "INSERT INTO evidence_portal VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [key, empty()],
      );
      mode = "postgres";
    } else if (config.REDIS_URL) {
      const { default: Redis } = await import("ioredis");
      redis = new Redis(config.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        connectTimeout: 5000,
      });
      redis.on("error", () => {});
      await redis.connect();
      await redis.ping();
      mode = "keyvalue";
    } else {
      if (config.NODE_ENV === "production")
        throw new Error(
          "Evidence storage requires DATABASE_URL or REDIS_URL in production",
        );
      mode = "file";
      await mkdir(dirname(file), { recursive: true });
      try {
        await readFile(file);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
        await writeFile(file, JSON.stringify(empty()));
      }
    }
    return mode;
  }
  async function read() {
    await init();
    if (pool) {
      const r = await pool.query(
        "SELECT payload FROM evidence_portal WHERE id=$1",
        [key],
      );
      return r.rows[0].payload;
    }
    if (redis)
      return JSON.parse((await redis.get(key)) || JSON.stringify(empty()));
    return JSON.parse(await readFile(file, "utf8"));
  }
  async function mutate(fn) {
    const job = queue.then(async () => {
      await init();
      if (pool) {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const r = await c.query(
            "SELECT payload FROM evidence_portal WHERE id=$1 FOR UPDATE",
            [key],
          );
          const data = r.rows[0].payload,
            result = await fn(data);
          await c.query("UPDATE evidence_portal SET payload=$2 WHERE id=$1", [
            key,
            data,
          ]);
          await c.query("COMMIT");
          return result;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      }
      if (redis) {
        for (let n = 0; n < 5; n++) {
          await redis.watch(key);
          const data = JSON.parse(
              (await redis.get(key)) || JSON.stringify(empty()),
            ),
            result = await fn(data);
          if (await redis.multi().set(key, JSON.stringify(data)).exec())
            return result;
        }
        throw new Error("Concurrent update; retry");
      }
      const data = await read(),
        result = await fn(data);
      await writeFile(file + ".tmp", JSON.stringify(data));
      await rename(file + ".tmp", file);
      return result;
    });
    queue = job.catch(() => {});
    return job;
  }
  return {
    init,
    read,
    mutate,
    close: async () => {
      await pool?.end();
      redis?.disconnect();
    },
  };
}
export const evidenceStore = createEvidenceStore();
