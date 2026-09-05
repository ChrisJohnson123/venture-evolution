import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, getState, getLatestVentures } from "./database.js";
import { startWorker } from "./worker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "venture-evolution" });
});

app.get("/api/state", async (_req, res) => {
  try {
    const state = await getState();
    const ventures = await getLatestVentures(20);
    res.json({ state, ventures });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to load simulation state." });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

await initDb();

app.listen(port, "0.0.0.0", () => {
  console.log(`Venture Evolution dashboard listening on port ${port}`);
});

startWorker().catch((err) => {
  console.error("Worker failed to start:", err);
});
