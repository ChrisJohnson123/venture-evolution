# Venture Evolution Lab — MVP

A persistent Node.js + PostgreSQL venture evolution simulator designed for Railway.

## What it does

- Creates an initial population of simulated ventures.
- Keeps the strongest 10% each generation.
- Mutates survivors into a new population.
- Allocates fictional capital to the highest-ranked ventures.
- Saves each generation to PostgreSQL.
- Serves a mobile-friendly dashboard.
- Continues running on the cloud server when your phone is closed.

## Railway environment variables

Required:

- `DATABASE_URL` — reference your Railway PostgreSQL service.

Optional:

- `POPULATION=1000`
- `CYCLE_MS=60000`

`CYCLE_MS` is the delay between generations in milliseconds. Keep it at 60 seconds initially.

## Start

Railway will run:

`npm start`

The application listens on Railway's `PORT` automatically.

## Important

This is an MVP simulation engine, not a validated business forecasting system. Its current scores are synthetic. The next stage is to replace synthetic evidence with real external research and AI-assisted opportunity analysis.
