import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, getState, getLatestVentures, getLatestResearchRun } from "./database.js";
import { startWorker } from "./worker.js";
import { aiResearchEnabled, researchModel } from "./research.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const railwayPort = Number(process.env.PORT || 3000);
const targetPort = 3000;

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "venture-evolution",
    aiResearchEnabled: aiResearchEnabled(),
    researchModel: researchModel()
  });
});

app.get("/api/state", async (_req, res) => {
  try {
    const state = await getState();
    const ventures = await getLatestVentures(20);
    res.json({
      state,
      ventures,
      aiResearch: {
        enabled: aiResearchEnabled(),
        model: researchModel(),
        everyGenerations: Number(process.env.RESEARCH_EVERY_GENERATIONS || 60)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to load simulation state." });
  }
});

app.get("/api/research", async (_req, res) => {
  try {
    const latest = await getLatestResearchRun();
    res.json({
      enabled: aiResearchEnabled(),
      model: researchModel(),
      latest
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to load market research." });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

await initDb();

const listen = (port) => {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Venture Evolution dashboard listening on port ${port}`);
  });
};

listen(railwayPort);
if (railwayPort !== targetPort) listen(targetPort);

startWorker().catch((err) => {
  console.error("Worker failed to start:", err);
});
