const problems = [
  "pet hair embedded in car carpets",
  "food being forgotten in fridges",
  "tradespeople losing time writing quotes",
  "condensation around windows",
  "small firms chasing overdue invoices",
  "renters documenting property condition",
  "drivers keeping interiors clean",
  "creators repurposing long videos",
  "homeowners spotting hidden water leaks",
  "parents tracking school kit and belongings"
];

const solutions = [
  "specialist cleaning tool",
  "AI workflow assistant",
  "low-cost sensor kit",
  "mobile-first SaaS",
  "subscription service",
  "physical + app hybrid",
  "automated marketplace",
  "browser-based utility",
  "compact household device",
  "smart reminder system"
];

const types = ["Physical product", "SaaS", "Consumer app", "B2B service", "Hybrid"];
const prefixes = ["Nova", "Loop", "Swift", "Clear", "Nimble", "Bright", "Snap", "Forge", "Pulse", "Nest", "Pilot", "Flow"];
const suffixes = ["Lab", "Mate", "Flow", "Kit", "Pilot", "Works", "Guard", "IQ", "Pro", "Spark", "Track", "Nest"];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const rnd = (a = 0, b = 100) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const jitter = (v, spread = 9) => clamp(v + rnd(-spread, spread));

function ventureName() {
  return pick(prefixes) + pick(suffixes);
}

function score(v) {
  const raw =
    v.demand * 0.25 +
    v.margin * 0.20 +
    v.evidence * 0.15 +
    (100 - v.competition) * 0.12 +
    v.viral * 0.12 +
    v.repeat * 0.08 +
    v.defensibility * 0.08;

  v.fitness = clamp(raw - v.risk * 0.08);
  v.probability = clamp(
    18 + v.fitness * 0.78 + v.evidence * 0.10 - v.risk * 0.18,
    3,
    94
  );
  v.testBudget = Math.round(75 + (100 - v.evidence) * 2.3 + v.risk * 1.2);
  return v;
}

export function makeVenture(parent = null) {
  const base = parent ?? {
    demand: rnd(20, 95),
    margin: rnd(20, 95),
    evidence: rnd(15, 90),
    competition: rnd(15, 95),
    viral: rnd(10, 95),
    repeat: rnd(5, 90),
    defensibility: rnd(5, 85),
    risk: rnd(15, 90)
  };

  const mutate = (key) => parent ? jitter(base[key]) : base[key];

  return score({
    id: crypto.randomUUID(),
    name: parent && Math.random() < 0.35 ? parent.name : ventureName(),
    type: parent && Math.random() < 0.72 ? parent.type : pick(types),
    problem: parent && Math.random() < 0.78 ? parent.problem : pick(problems),
    solution: parent && Math.random() < 0.68 ? parent.solution : pick(solutions),
    demand: mutate("demand"),
    margin: mutate("margin"),
    evidence: mutate("evidence"),
    competition: mutate("competition"),
    viral: mutate("viral"),
    repeat: mutate("repeat"),
    defensibility: mutate("defensibility"),
    risk: mutate("risk"),
    allocated: 0
  });
}

export function createPopulation(size = 1000) {
  return Array.from({ length: size }, () => makeVenture());
}

export function allocateCapital(ventures, capital) {
  const ranked = [...ventures].sort((a, b) => b.fitness - a.fitness);
  ranked.forEach((v) => { v.allocated = 0; });

  const picks = ranked.slice(0, Math.min(20, ranked.length));
  const weights = picks.map((v) => Math.max(1, v.fitness * (v.evidence / 100)));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const deployable = capital * 0.22;

  picks.forEach((v, i) => {
    v.allocated = deployable * (weights[i] / totalWeight);
  });

  return ranked;
}

export function evolveGeneration(ventures, capital) {
  const ranked = [...ventures].sort((a, b) => b.fitness - a.fitness);
  const oldSize = ranked.length;
  const survivorCount = Math.max(5, Math.ceil(oldSize * 0.10));
  const survivors = ranked.slice(0, survivorCount);

  let pnl = 0;
  for (const v of survivors.slice(0, Math.min(20, survivors.length))) {
    const simulatedReturn = clamp((v.fitness - 48) / 220 + rnd(-0.06, 0.06), -0.12, 0.22);
    pnl += (v.allocated || 0) * simulatedReturn;
  }

  const next = survivors.map((v) => makeVenture(v));
  while (next.length < oldSize) {
    next.push(makeVenture(pick(survivors)));
  }

  const nextCapital = Math.max(10000, capital + pnl);
  return {
    ventures: allocateCapital(next, nextCapital),
    capital: nextCapital,
    killed: oldSize - survivorCount
  };
}
