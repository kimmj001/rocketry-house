# Rocketry House

Rocketry House is a production-ready web-based rocket CAD ecosystem: project-first rocket repositories, browser CAD, engineering estimates, Explore flows, forking, telemetry upload UX, and moderation workflows.

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

If the local browser ever shows an unstyled HTML page, the dev cache was likely mixed with a production build while the dev server was running. Restart cleanly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1
```

When checking a production build locally, stop the dev server first so `.next` is not rewritten while the browser is loading dev CSS chunks.

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
psql "$DATABASE_URL" -f supabase/cloud-persistence.sql
```

Without those env vars, the app runs from mock data plus browser-local backup.

### Persistence model

Rocketry House protects user-created MVP data with a two-layer persistence path:

- Local backup: community posts, comments, likes, bookmarks, upload drafts, inline CAD JSON, saved motors, profiles, and selected file metadata are cached in browser storage.
- Supabase sync: when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present, the same records are upserted into `user_data_records`.
- Supabase Storage: selected upload files are sent to the `rocketry-house-files` bucket when Supabase is configured. In mock mode, file metadata is still retained locally.

Run both SQL files before relying on cloud sync:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/cloud-persistence.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

For a public production launch, run `supabase/cloud-persistence.sql` in Supabase before opening the app to users. The policy file enables RLS, scopes personal records to `auth.uid()`, keeps community posts publicly readable, requires sign-in for writes, and makes uploaded files private to the authenticated owner path.

## Deploy

The app is ready for Vercel deployment as a Next.js project.

Required for persistent public MVP data:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `supabase/cloud-persistence.sql` applied in the Supabase SQL editor or through your database pipeline

Without Supabase, the app still opens in local mock mode, but account, community, upload, motor, and rocket records only persist in the current browser storage.

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
- `supabase/schema.sql` contains tables for profiles, projects, versions, components, files, forks, reviews, discussions, flight logs, telemetry, thrust data, verification, and moderation.

## Safety Positioning

Rocketry House is for educational and lawful rocketry use only. The UI includes policy notices and moderation placeholders for reporting projects, reporting files, admin review status, and banned content tags.

## Product Pages

- Landing page with cinematic quote hero
- Explore
- Project detail
- Web CAD editor
- Simulation
- Upload project
- Creator dashboard
- Profile
- Fork tree
- Project release workflow
- Project archive
