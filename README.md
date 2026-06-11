# Worklog & Invoicing

A personal client worklog, invoice, and productivity dashboard. Log daily work in seconds, then turn those logs into polished PDF invoices and track payment.

**Stack**: Next.js 16 (App Router) + TypeScript · Tailwind · shadcn/ui · Supabase (Auth + Postgres + Storage) · Drizzle ORM · @react-pdf/renderer · Recharts.

Full product plan: [`docs/DESIGN_CONTEXT.md`](docs/DESIGN_CONTEXT.md) (or `C:\Users\sal8g\.claude\plans\i-want-you-to-snappy-blum.md`).

---

## Local setup (first time)

### 1. Create a Supabase project

1. https://app.supabase.com → **New project**
2. Pick a region close to you and set a DB password you'll remember
3. Wait ~2 min for provisioning

### 2. Copy env vars to `.env`

Duplicate `.env.example` → `.env` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase dashboard → **Project Settings → API**
- `SUPABASE_SERVICE_ROLE_KEY` — same page, reveal the `service_role` secret. **Server-only, never expose.**
- `DATABASE_URL` — **Project Settings → Database → Connection string → URI → Session pooler** (port `5432`, user `postgres.<ref>`). Don't use Direct connection (IPv6-only and times out from most networks). Don't wrap the password in `[ ]` — the brackets in Supabase's example are placeholder syntax.

### 3. Install + apply the schema

```powershell
npm install
npm run db:setup
```

`db:setup` runs Drizzle migrations **and** applies [`drizzle/post-push.sql`](drizzle/post-push.sql), which contains things Drizzle can't model:
- Foreign keys to `auth.users` (per-user cascade on account deletion)
- RLS policies on every app table (`user_id = auth.uid()`)
- Triggers (rate-history snapshotting, `updated_at` bump)
- Supabase Storage bucket `business-logos` + per-user-folder RLS policies

It's idempotent — safe to re-run after schema changes.

### 4. Disable email confirmation (optional, faster signup for testing)

Supabase dashboard → **Authentication → Sign In / Up → Email** → turn off **Confirm email** → Save.

### 5. Run it

```powershell
npm run dev
```

Open http://localhost:3000 → bounces to `/login` → click "Create one".

---

## Day-to-day commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack, hot reload) |
| `npm run build` | Production build + TypeScript check |
| `npm run db:check` | Probe the DB connection — shows hostname, port, masked password |
| `npm run db:setup` | Apply migrations + post-push.sql (run after editing `schema.ts`) |
| `npm run db:generate -- --name change_name` | Create a new migration file from schema diff |
| `npm run db:studio` | Web UI for inspecting data |

### After changing the schema

1. Edit `src/lib/db/schema.ts`
2. `npm run db:generate -- --name <slug>` — produces `drizzle/000X_<slug>.sql`
3. `npm run db:setup` — applies the migration + re-runs post-push (idempotent)

---

## Smoke tests

Each Phase-1 module ships with an end-to-end script that exercises the live DB and cleans up after itself. Run any after a schema change to confirm nothing broke:

```powershell
npx tsx scripts/smoke-clients.ts       # Client CRUD + rate-history trigger
npx tsx scripts/smoke-work-logs.ts     # Work-log CRUD + filtering
npx tsx scripts/smoke-invoices.ts      # Invoice generation transaction + rate snapshot
npx tsx scripts/smoke-dashboard.ts     # Dashboard aggregations + chart shapes
npx tsx scripts/smoke-settings.ts      # Settings UPSERT + storage policies
npx tsx scripts/smoke-pdf.ts           # PDF render → tmp/smoke-invoice.pdf
```

---

## Deploying to Vercel

1. Push the repo to GitHub
2. Vercel → **New project** → import the repo
3. Add **the same env vars** from `.env` to Vercel's project settings (Production + Preview)
4. **Important**: run `npm run db:setup` once against the **production** Supabase DB before the first deploy goes live. Vercel doesn't run it — Drizzle migrations + RLS policies have to land before anyone signs up, or signups will fail with FK errors.
   - Easiest path: clone the repo locally, point `.env` at the production `DATABASE_URL`, `npm run db:setup`, then revert `.env` to your dev DB.
5. Vercel auto-deploys on push to `main`. PRs get preview URLs.

**Vercel-specific gotchas**:
- The Drizzle pool size (`DB_POOL_MAX`) defaults to 1. Each lambda invocation is short-lived so one connection is plenty and keeps you well under Supabase's pool ceiling.
- The PDF route runs on the Node runtime (`runtime = "nodejs"`). Don't switch to Edge — `@react-pdf/renderer` needs Node APIs.

---

## Project structure

```
src/
├── app/
│   ├── (auth)/            # Public auth routes (login, signup)
│   ├── (dashboard)/       # Protected app routes — sidebar shell
│   │   ├── layout.tsx
│   │   ├── loading.tsx    # Skeleton during server-component fetches
│   │   ├── error.tsx      # Error boundary for the protected tree
│   │   ├── dashboard/
│   │   ├── work-logs/
│   │   ├── invoices/
│   │   ├── clients/
│   │   └── settings/
│   ├── api/invoices/[id]/pdf/  # PDF stream endpoint
│   ├── layout.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/                # shadcn primitives
│   ├── design/            # icons + status-pill + view-toggle + empty-state
│   ├── layout/            # Sidebar, TopBar, PageHeader, MobileNav
│   ├── clients/           # ClientForm, ClientTable, RateHistoryTimeline
│   ├── work-logs/         # QuickAddBar, WorkLogTable, CalendarView, BoardView
│   ├── invoices/          # InvoiceBuilder, InvoiceTable, InvoicePdf
│   ├── dashboard/         # StatCard, AlertStrip, charts
│   └── settings/          # SettingsForm, LogoUploader
├── lib/
│   ├── db/
│   │   ├── schema.ts      # Drizzle schema — single source of truth
│   │   ├── index.ts       # Pooled DB client
│   │   └── queries/       # Per-domain query helpers (always scope by user_id!)
│   ├── supabase/          # Browser, server, and middleware clients
│   ├── validations/       # zod schemas (shared client+server)
│   ├── money.ts           # cents-only money helpers (dinero.js)
│   └── colors.ts          # deterministic client-color hashing
├── server/
│   ├── auth.ts            # requireUser() helper
│   └── actions/           # Server actions per domain
└── proxy.ts               # Auth gate (Next 16 — renamed from middleware.ts)
```

---

## Architecture notes

### Money handling

All amounts in the DB are integer cents. **Never use floats for money.** Use [`src/lib/money.ts`](src/lib/money.ts) (`fromCents`, `toCents`, `formatMoney`) wherever money touches code.

### Multi-tenant safety

The Drizzle client connects via the Postgres pooler `postgres.<ref>` user, which has `BYPASSRLS`. That means RLS at the DB doesn't gate Drizzle queries. **Every query must scope by `user_id` explicitly** (see [`src/lib/db/queries/*.ts`](src/lib/db/queries/)). RLS is defense-in-depth in case a query slips, and it's the only gate for any direct `supabase-js` storage access.

### Invoice rate snapshotting

When a client's billing rate changes, a trigger writes the old rate into `client_rate_history` with `effective_to = today`. When generating an invoice, we look up the rate that was effective at `period_end`. This means changing a client's rate *next* month doesn't change *last* month's invoice.

### PDF generation

`/api/invoices/[id]/pdf` runs `renderToBuffer` from `@react-pdf/renderer` server-side, streams the PDF inline (or as attachment if `?download=1`). The logo is fetched from Supabase Storage at request time, base64-encoded, and embedded as a data URL — react-pdf can't fetch URLs from inside its worker reliably.

---

## What's deferred (Phase 2/3 — not built yet)

- **Payments**: partial/full payments table + record-payment dialog + proof upload
- **Projects**: sub-grouping under clients
- **Checklist Viewer**: upload HTML/PDF/MD checklists, sandbox-render, extract items
- **Access Vault**: Bitwarden/1Password reference store (never raw secrets)
- **Reports**: income-by-month, paid-vs-unpaid timeline, CSV export
- **Email**: cutoff reminders, overdue alerts via Resend
- **Cmd+K palette** + live theme switcher (designs exist; not wired)

The sidebar shows these as disabled "Soon" links so they don't get lost.
