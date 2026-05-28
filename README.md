# Rocketry House

Rocketry House is a production-ready web-based rocket CAD ecosystem: project-first rocket repositories, browser CAD, engineering estimates, marketplace flows, forking, telemetry upload UX, and moderation workflows.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- shadcn-style local UI primitives
- React Three Fiber / Three.js for the rocket CAD viewport
- Zustand for CAD state
- Recharts for telemetry and simulation graphs
- Supabase-ready client, SQL schema, and seed data
- Mock mode when Supabase env vars are missing

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Optional Supabase

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Then apply:

```bash
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

Without those env vars, the app runs entirely from `lib/mock-data.ts`.

## Deploy

The app is ready for Vercel deployment as a Next.js project.

Required for the current public MVP:

- No environment variables are required. The app falls back to local mock data when Supabase is not configured.

Optional production environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Build command:

```bash
next build
```

The repo includes `vercel.json` with the Next.js framework and build command.

## Architecture Notes

- `lib/types.ts` defines `RocketProject`, `RocketComponent`, `SimulationResult`, and `TelemetryDataset`.
- `lib/cad/geometry.ts` owns design sorting, JSON export, independent .ork-like XML export/import, and STL placeholder architecture.
- `lib/cad/store.ts` owns browser CAD editing state with Zustand.
- `lib/simulation/estimates.ts` isolates the engineering estimate layer. This boundary is where a higher-fidelity aerodynamic and flight simulation engine should be integrated later.
- `lib/telemetry.ts` contains messy-data column detection helpers.
- `supabase/schema.sql` contains tables for profiles, projects, versions, components, files, purchases, forks, royalties, reviews, discussions, flight logs, telemetry, thrust data, verification, and moderation.

## Safety Positioning

Rocketry House is for educational and lawful rocketry use only. The UI includes policy notices and moderation placeholders for reporting projects, reporting files, admin review status, and banned content tags.

## Product Pages

- Landing page with cinematic quote hero
- Marketplace explore
- Project detail
- Web CAD editor
- Simulation
- Upload/sell project
- Creator dashboard
- Profile
- Fork tree
- Mock checkout
- Purchases/downloads
- Admin moderation
