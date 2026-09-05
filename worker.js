import { createPopulation, allocateCapital, evolveGeneration } from "./simulation.js";
import { getState, getLatestVentures, saveGeneration } from "./database.js";

const POPULATION = Math.max(100, Math.min(5000, Number(process.env.POPULATION || 1000)));
const CYCLE_MS = Math.max(10000, Number(process.env.CYCLE_MS || 60000));

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

export async function startWorker() {
  if (running) return;
  running = true;

  let current = await bootstrap();
  console.log(`Worker started at generation ${current.generation}`);

  const loop = async () => {
    try {
      const result = evolveGeneration(current.ventures, current.capital);
      current = {
        generation: current.generation + 1,
        capital: result.capital,
        totalKilled: current.totalKilled + result.killed,
        ventures: result.ventures
      };

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
