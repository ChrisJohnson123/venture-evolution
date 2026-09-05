import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add a PostgreSQL service in Railway and set DATABASE_URL.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      generation INTEGER NOT NULL,
      capital DOUBLE PRECISION NOT NULL,
      total_killed INTEGER NOT NULL,
      paused BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ventures (
      generation INTEGER NOT NULL,
      id UUID NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      problem TEXT NOT NULL,
      solution TEXT NOT NULL,
      demand DOUBLE PRECISION NOT NULL,
      margin DOUBLE PRECISION NOT NULL,
      evidence DOUBLE PRECISION NOT NULL,
      competition DOUBLE PRECISION NOT NULL,
      viral DOUBLE PRECISION NOT NULL,
      repeat DOUBLE PRECISION NOT NULL,
      defensibility DOUBLE PRECISION NOT NULL,
      risk DOUBLE PRECISION NOT NULL,
      fitness DOUBLE PRECISION NOT NULL,
      probability DOUBLE PRECISION NOT NULL,
      test_budget DOUBLE PRECISION NOT NULL,
      allocated DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (generation, id)
    );

    CREATE INDEX IF NOT EXISTS ventures_generation_fitness_idx
      ON ventures (generation, fitness DESC);
  `);
}

export async function getState() {
  const { rows } = await pool.query("SELECT * FROM app_state WHERE id = 1");
  return rows[0] ?? null;
}

export async function getLatestVentures(limit = 1000) {
  const state = await getState();
  if (!state) return [];
  const { rows } = await pool.query(
    `SELECT
       id, name, type, problem, solution,
       demand, margin, evidence, competition, viral, repeat,
       defensibility, risk, fitness,
       probability, test_budget AS "testBudget",
       allocated
     FROM ventures
     WHERE generation = $1
     ORDER BY fitness DESC
     LIMIT $2`,
    [state.generation, limit]
  );
  return rows;
}

export async function saveGeneration({ generation, capital, totalKilled, ventures }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO app_state (id, generation, capital, total_killed, updated_at)
       VALUES (1, $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET
         generation = EXCLUDED.generation,
         capital = EXCLUDED.capital,
         total_killed = EXCLUDED.total_killed,
         updated_at = NOW()`,
      [generation, capital, totalKilled]
    );

    const values = [];
    const params = [];
    let p = 1;

    for (const v of ventures) {
      values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
      params.push(
        generation, v.id, v.name, v.type, v.problem, v.solution,
        v.demand, v.margin, v.evidence, v.competition, v.viral,
        v.repeat, v.defensibility, v.risk, v.fitness,
        v.probability, v.testBudget, v.allocated
      );
    }

    if (values.length) {
      await client.query(
        `INSERT INTO ventures (
          generation,id,name,type,problem,solution,demand,margin,evidence,
          competition,viral,repeat,defensibility,risk,fitness,probability,
          test_budget,allocated
        ) VALUES ${values.join(",")}`,
        params
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
