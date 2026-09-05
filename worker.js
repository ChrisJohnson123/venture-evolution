import { createPopulation, allocateCapital, evolveGeneration, injectResearchVentures } from "./simulation.js";
import {
  getState,
  getLatestVentures,
  saveGeneration,
  saveResearchRun,
  getLatestResearchRun
} from "./database.js";
import { aiResearchEnabled, researchModel, researchOpportunities } from "./research.js";

const POPULATION = Math.max(100, Math.min(5000, Number(process.env.POPULATION || 1000)));
const CYCLE_MS = Math.max(10000, Number(process.env.CYCLE_MS || 60000));
const RESEARCH_EVERY_GENERATIONS = Math.max(
  5,
  Number(process.env.RESEARCH_EVERY_GENERATIONS || 60)
);

let running = false;

async function bootstrap() {
  const state = await getState();

  if (!state) {
    const ventures = allocateCapital(createPopulation(POPULATION), 1_000_000);
    await saveGeneration({
      generation: 1,
      capital: 1_000_000,
      totalKilled: 0,
      ventures
    });
    return { generation: 1, capital: 1_000_000, totalKilled: 0, ventures };
  }

  const ventures = await getLatestVentures(POPULATION);
  return {
    generation: state.generation,
    capital: Number(state.capital),
    totalKilled: Number(state.total_killed),
    ventures
  };
}

async function maybeRunResearch(current) {
  if (!aiResearchEnabled()) return current.ventures;

  const latest = await getLatestResearchRun();
  const lastGeneration = Number(latest?.generation || 0);
  const due = !latest || current.generation - lastGeneration >= RESEARCH_EVERY_GENERATIONS;
  if (!due) return current.ventures;

  console.log(`Starting live market research at generation ${current.generation} using ${researchModel()}`);
  const research = await researchOpportunities();
  if (!research?.opportunities?.length) return current.ventures;

  await saveResearchRun({
    generation: current.generation,
    model: research.model,
    opportunities: research.opportunities,
    createdAt: research.createdAt
  });

  console.log(`Research found ${research.opportunities.length} evidence-backed opportunities`);
  return injectResearchVentures(current.ventures, research.opportunities, current.capital);
}

export async function startWorker() {
  if (running) return;
  running = true;

  let current = await bootstrap();
  console.log(`Worker started at generation ${current.generation}`);
  console.log(
    aiResearchEnabled()
      ? `AI market research enabled with ${researchModel()}`
      : "AI market research waiting for OPENAI_API_KEY"
  );

  const loop = async () => {
    try {
      const result = evolveGeneration(current.ventures, current.capital);
      current = {
        generation: current.generation + 1,
        capital: result.capital,
        totalKilled: current.totalKilled + result.killed,
        ventures: result.ventures
      };

      try {
        current.ventures = await maybeRunResearch(current);
      } catch (researchError) {
        console.error("Market research cycle failed; evolution will continue:", researchError);
      }

      await saveGeneration(current);
      const champion = current.ventures[0];
      console.log(
        `Generation ${current.generation} saved | capital £${current.capital.toFixed(0)} | best ${champion.fitness.toFixed(1)}`
      );
    } catch (err) {
      console.error("Evolution cycle failed:", err);
    } finally {
      setTimeout(loop, CYCLE_MS);
    }
  };

  setTimeout(loop, CYCLE_MS);
}
