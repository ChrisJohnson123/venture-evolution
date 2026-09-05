import pg from "pg";
const { Pool } = pg;

const hasDatabase = Boolean(process.env.DATABASE_URL);

export const pool = hasDatabase
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    })
  : null;

const memory = {
  state: null,
  ventures: [],
  research: null
};

export async function initDb() {
  if (!pool) {
    console.warn("DATABASE_URL is not set. Running with in-memory storage until PostgreSQL is connected.");
    return;
  }

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

    CREATE TABLE IF NOT EXISTS research_runs (
      id BIGSERIAL PRIMARY KEY,
      generation INTEGER NOT NULL,
      model TEXT NOT NULL,
      opportunity_count INTEGER NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS research_runs_created_idx
      ON research_runs (created_at DESC);
  `);
}

export async function getState() {
  if (!pool) return memory.state;

  const { rows } = await pool.query("SELECT * FROM app_state WHERE id = 1");
  return rows[0] ?? null;
}

export async function getLatestVentures(limit = 1000) {
  if (!pool) {
    return [...memory.ventures]
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, limit);
  }

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
  if (!pool) {
    memory.state = {
      id: 1,
      generation,
      capital,
      total_killed: totalKilled,
      paused: false,
      updated_at: new Date().toISOString()
    };
    memory.ventures = ventures.map((v) => ({ ...v }));
    return;
  }

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

export async function saveResearchRun({ generation, model, opportunities, createdAt }) {
  const record = {
    generation,
    model,
    opportunities,
    created_at: createdAt || new Date().toISOString()
  };

  if (!pool) {
    memory.research = record;
    return record;
  }

  const { rows } = await pool.query(
    `INSERT INTO research_runs (generation, model, opportunity_count, payload, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id, generation, model, opportunity_count, payload, created_at`,
    [generation, model, opportunities.length, JSON.stringify({ opportunities }), record.created_at]
  );
  return rows[0];
}

export async function getLatestResearchRun() {
  if (!pool) return memory.research;

  const { rows } = await pool.query(
    `SELECT id, generation, model, opportunity_count, payload, created_at
     FROM research_runs
     ORDER BY created_at DESC
     LIMIT 1`
  );

  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    generation: rows[0].generation,
    model: rows[0].model,
    opportunity_count: rows[0].opportunity_count,
    opportunities: rows[0].payload?.opportunities || [],
    created_at: rows[0].created_at
  };
}
