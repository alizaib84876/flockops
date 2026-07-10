# FlockOps — Progress Tracker

> Update this file continuously, not in batches. This is what lets any AI session — including a different AI model — pick up work with zero lost context. See `CLAUDE.md` for the update protocol.

Last updated: 2026-07-10 (Step 5 complete)

## Current Phase

Phase A — Internal Tool (steps 1–8 of the implementation sequence in `broiler-farm-management-project-spec.md`)

## Completed Steps

- [x] Step 1 — Data foundation (schema + shed/batch creation)
  - [x] Next.js 16 app scaffolded (App Router, TypeScript, CSS modules, no Tailwind)
  - [x] Supabase client configured (`@supabase/supabase-js` + `@supabase/ssr`)
  - [x] Full SQL schema written: `supabase/migrations/001_initial_schema.sql`
        - All 13 tables: users, farms, farm_members, sheds, batches, daily_logs,
          daily_log_edits (audit trail), weight_samples, vaccinations, expenses,
          sales, subscriptions, alerts
        - Enums, indexes, RLS (Phase A: permissive; structure in place for Phase B)
        - Trigger: auto-create user profile on Supabase Auth signup
  - [x] TypeScript type definitions: `src/lib/supabase/database.types.ts`
  - [x] Auth middleware (session refresh, route protection)
  - [x] PWA manifest
  - [x] Full design system CSS (dark mode, green palette, mobile-first)
  - [x] Shed creation flow (`/sheds/new`, `/sheds/[shedId]/edit`)
  - [x] Shed list page (`/sheds`)
  - [x] Shed detail page (`/sheds/[shedId]`) — shows active batch, history
  - [x] Batch start flow (`/sheds/[shedId]/batches/new`)
  - [x] Batch detail page (`/sheds/[shedId]/batches/[batchId]`) — day of cycle, stats, log list
  - [x] Farm creation flow (`/settings/farm/new`)
  - [x] Dashboard (`/dashboard`) — shed overview with active batch status
  - [x] Login/Signup page (`/login`)
  - [x] All 13 routes compile clean; build passes

- [x] Step 2 — Daily operations logging screen
  - [x] NumericStepper with +/- buttons (52px touch targets)
  - [x] Required: mortality, feed given, feed stock remaining
  - [x] Optional: water, temperature, humidity, notes
  - [x] Running totals (mortality %, total feed, birds alive) always visible
  - [x] Today's log read-only summary + Edit button
  - [x] Edit history written to daily_log_edits (spec §9 audit trail)
  - [x] Offline-first: localStorage cache + pending sync banner + Sync now button
- [ ] Step 3 — Deployed for one live batch
- [x] Step 4 — Growth & feed efficiency tracking
  - [x] breedStandards.ts: Ross 308 + Cobb 500 day-by-day target weights (g, day 0–42)
  - [x] GrowthChart component (recharts): actual vs standard curve, Today line
  - [x] /growth page: FCR calculation + quality rating (Excellent/Good/Average/Poor)
  - [x] vs-standard delta per sample shown in table
  - [x] /weights/new: weight sample entry form
  - [x] Batch detail: FCR stat card + live birds + Growth & FCR button
- [x] Step 5 — Financial tracking
  - [x] /expenses/new: visual category picker (chicks/feed/medicine/labor/utilities/other), PKR amount
  - [x] /close: harvest/sale form — weight, rate/kg, condemned birds, auto revenue, 2-step confirm
  - [x] /financials: P&L hub — net profit/loss, cost/bird, cost/kg, revenue/kg, profit/bird
  - [x] Category cost breakdown bars with % share
  - [x] Batch detail: Financials button added
- [ ] Step 6 — Multi-shed dashboard
- [ ] Step 7 — Alerting
- [ ] Step 8 — Reporting
- [ ] Step 9 — Multi-tenancy
- [ ] Step 10 — Subscription & billing
- [ ] Step 11 — Onboard external farmers
- [ ] Step 12 — Farm data assistant (AI)
- [ ] Step 13 — Mortality risk prediction (AI)
- [ ] Step 14 — Remaining Phase 2 differentiators

## In Progress

- Step 6: Multi-shed dashboard — next code task

## Known Issues / Bugs / Stubs

- `middleware.ts` filename is deprecated in Next.js 16 — warning shows "use 'proxy' instead".
  Does NOT affect functionality in Phase A. Will fix when migrating to Next.js stable or if
  it causes actual errors. See: https://nextjs.org/docs/messages/middleware-to-proxy
- `/sheds/[shedId]/batches/[batchId]/close` — stub only, not functional yet (Step 5)
- `/alerts` — stub only (Step 7)
- `/settings` — stub only (Step 9)
- Batch detail page: FCR calculation not shown yet (needs weight_samples data — Step 4)
- Batch detail page: logs paginated to 10 — no "load more" yet

## Key Decisions Log

- Used untyped Supabase client (no `Database` generic) — hand-written types are in
  `database.types.ts` for reference, but Supabase's TS client requires Supabase CLI-generated
  types for full inference. Will add CLI-generated types after Supabase project is confirmed
  working and schema is finalized.
- No Tailwind — using plain CSS modules + global design system tokens in `globals.css`.
  Rationale: maximum control, no build dependency, consistent with CLAUDE.md tech spec.
- `daily_log_edits` table added (not in spec's abbreviated table list) to satisfy spec §9
  data quality requirement: "corrections should be recorded as edit history rather than
  overwriting the original value."
- RLS policies are Phase A permissive (`FOR ALL TO authenticated USING (true)`) — structure
  and framework is in place; will be replaced with farm-scoped policies in Step 9.

## Environment & Setup Notes

- Supabase project: `kehkmunubdovohpyftst.supabase.co` (region: ap-northeast-1 / Tokyo)
- Required env vars (in `.env.local`, never committed):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **CRITICAL FIRST STEP FOR NEW SESSION**: Run the SQL schema before any data can be stored.
  Go to Supabase Dashboard → SQL Editor → New Query → paste contents of
  `supabase/migrations/001_initial_schema.sql` → Run.
  This has NOT been run yet as of this session.
- Other services connected: none yet (WhatsApp/Twilio/JazzCash: not set up)

## Next Immediate Task

Step 6 — Multi-shed dashboard (rebuild /dashboard):
- Show all 4 sheds in a card grid
- Each card: shed name, active batch (breed + day of cycle), mortality %, FCR if available
- Summary row at top: total active sheds, total birds across all sheds, total mortality today
- Quick links from dashboard: tap shed card → go to shed detail
- Dashboard must work even when some sheds have no active batch
