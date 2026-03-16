# pWarf

A Dwarf Fortress-inspired strategy sim with ASCII canvas rendering, procedural world generation, and a Supabase backend.

## Prerequisites

- Node.js 18+
- npm 9+
- A [Supabase](https://supabase.com) project with the schema applied (see [Database Setup](#database-setup))

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the shared types package
npm run build --workspace=shared

# 3. Set up environment variables (see below)

# 4. Start the frontend
npm run dev:app
```

Open the URL printed by Vite (usually `http://localhost:5173`).

Click **Generate World**, wait for the tiles to populate, then pan around with WASD or click-drag. Select a non-ocean tile and click **Embark** to create your fortress.

## Environment Variables

### Frontend (`app/.env.local`)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Copy from `app/.env.example` and fill in your Supabase project values.

### Sim Engine (optional, for headless simulation)

Set these as shell environment variables or in a `.env` file:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
CIVILIZATION_ID=uuid-of-civilization
WORLD_ID=uuid-of-world
```

Then run:

```bash
npm run dev:sim
```

## Project Structure

```
pwarf/
├── app/          React + Vite frontend (canvas ASCII renderer)
├── sim/          Node.js headless simulation engine
├── shared/       Shared TypeScript types and constants
├── supabase/     Database migrations
└── designDocs/   Game design specifications
```

## Database Setup

Apply migrations to your Supabase project using the Supabase CLI:

```bash
supabase db push
```

Or run the SQL files in `supabase/migrations/` manually in the Supabase SQL editor, in order:

1. `00001_initial_schema.sql` — enums, tables, RLS policies
2. `00002_fortress_tiles.sql` — fortress tile table and enum

## Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run build --workspace=shared` | Build shared types (required before dev:app) |
| `npm run dev:app` | Start the frontend dev server |
| `npm run dev:sim` | Start the simulation engine |
| `npm test` | Run all tests |
| `npm test --workspace=sim` | Run sim tests only |

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Pan the map |
| Tab | Toggle fortress/world mode |
| [ | Toggle left panel |
| ] | Toggle right panel |
| Click + drag | Pan the map |
