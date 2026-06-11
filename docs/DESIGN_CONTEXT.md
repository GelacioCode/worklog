# Design Context — Worklog & Invoicing

Paste this whole file into Claude / v0 / Figma AI / any design tool when you want it to mock screens or critique layouts. It's self-contained: nothing in here assumes prior conversation.

---

## 1. Product in one sentence

A personal SaaS-ready dashboard where a freelancer logs daily client work in seconds, then turns those logs into polished PDF invoices and tracks payments — replacing the painful "backread Telegram + Slack + email + Asana every cutoff" workflow.

## 2. Target user

- Freelance developer / designer / VA / consultant
- Works with **3–15 active clients** across different platforms, currencies, and billing cadences
- Needs to log work in <10 seconds or won't do it
- Sends 3–20 invoices per month
- Cares about: speed of entry, accuracy of invoices, knowing what's unpaid
- Does NOT need: time-tracking timers, team collaboration, accounting integrations (yet)

## 3. Design direction

- **Aesthetic**: clean, modern dashboard. Closer to Linear / Vercel / Cal.com than QuickBooks / FreshBooks.
- **Density**: medium. Tables can be dense; forms breathe.
- **Mood**: calm, focused, professional. Not playful, not corporate.
- **Color**: neutral base (slate/zinc) + a single accent (default: emerald/violet — pick one). Status colors only for status (draft=gray, sent=blue, paid=green, overdue=red).
- **Typography**: sans-serif (Geist by default). One font family. 14–15px base.
- **Imagery**: zero illustrations. Empty states use a single Lucide icon + one line of copy + one CTA.
- **Motion**: subtle. 150ms transitions max. No bouncy animations.
- **Mobile**: secondary but required. Sidebar collapses to a drawer. Tables become stacked cards on `<sm`.

## 4. Stack constraints designers should know

- **shadcn/ui** components (Radix/base-ui primitives + Tailwind). Stick to its component vocabulary: Card, Button, Input, Select, Sheet, Dialog, DropdownMenu, Tabs, Table, Badge, Separator.
- **lucide-react** icons. No custom SVG icons unless absolutely needed.
- **Recharts** for charts. Bar, donut, line.
- **Tailwind** utility classes only. CSS variables for theme tokens.

## 5. Information architecture (left sidebar, in order)

| # | Item | Phase | Purpose |
|---|---|---|---|
| 1 | **Dashboard** | 1 | At-a-glance: money + workload + alerts |
| 2 | **Work Logs** | 1 | Daily entry + history. The most-visited page. |
| 3 | **Invoices** | 1 | List + generate new + view PDF + mark paid |
| 4 | **Clients** | 1 | Manage clients, rates, cutoffs, contracts |
| 5 | Projects | 2 | Sub-grouping under clients (disabled in MVP, "Soon" badge) |
| 6 | Checklists | 3 | Upload + view HTML/PDF/MD checklist guides (disabled, "Soon") |
| 7 | Payments | 2 | Partial/full payment recording (disabled, "Soon") |
| 8 | Access Vault | 3 | Bitwarden references for client logins (disabled, "Soon") |
| 9 | Reports | 3 | Advanced analytics (disabled, "Soon") |
| 10 | **Settings** | 1 | Business profile, currency, invoice format |

**Layout shell** (`(dashboard)/layout.tsx`):
- Fixed left sidebar, **256px** wide, bg-card, right border
- Top: logo + tagline (px-6 py-5, border-b)
- Below: nav links (lucide icon + label, px-3 py-2, rounded-md, hover bg-secondary)
- Disabled items: muted, "Soon" badge top-right, no hover
- Sticky topbar: h-14, border-b, mobile hamburger left, user menu right
- Main area: p-4 md:p-6 lg:p-8

## 6. Pages — designs needed

### 6.1 Dashboard `/dashboard`

**Purpose**: answer "where's my money + what should I work on next?"

**Layout** (top to bottom):
1. PageHeader: "Dashboard" + subtitle
2. **Stat card grid** — 4 cols on lg, 2 on sm, 1 on mobile:
   - Hours this month (e.g. "42.5h")
   - Expected income (sum of unpaid + unbilled value, in base currency)
   - Paid income (this month)
   - Unpaid income (sum of `sent` + `partially_paid` + `overdue`)
3. **Alert strip** (only if has data): horizontal cards
   - "3 invoices overdue" → red badge, link to filtered invoice list
   - "8 unbilled work logs ready" → emerald badge, link to invoice generator
   - "2 cutoffs in next 7 days" → amber badge, link to client list
4. **Charts row** — 2 cols on lg, 1 on mobile:
   - Hours by client (horizontal bar, top 5 + "Other")
   - Income by client this month (donut)
5. **Charts row 2**:
   - Paid vs unpaid (stacked bar, last 6 months)
   - Weekly workload (line, last 12 weeks, hours)

**Empty state**: single Card with icon, "Add your first client to get started", primary button.

### 6.2 Work Logs `/work-logs`

**Purpose**: log work fast + see/edit history.

**Layout**:
1. PageHeader: "Work Logs" + "View work log" button (toggles between table and calendar)
2. **Sticky Quick-Add bar** (most important UI in the whole app — must feel snappy):
   - Single horizontal row, h-12, border, rounded-lg, p-2
   - Inline fields left-to-right: Client (combobox), Title (input, grows), Date (defaults today), Hours (number, w-20), Billable toggle, "Add" button
   - Press `N` anywhere to focus the title input
   - Submit with Enter; on success, toast + clear title only (keep client/date)
3. **Filter row**: client multi-select, date range picker, status (unbilled/billed/paid), billable yes/no, search
4. **Table** (TanStack Table):
   - Columns: Date, Client (badge color), Title, Hours, Tag, Billable, Status, ⋯ actions
   - Sortable headers; default sort: date desc
   - Row click → opens edit Sheet (slides from right, full form)
   - Bulk select → "Generate invoice from selected" action
5. **Calendar view** (toggle): month grid, each day shows total hours + dot per client
   - Click day → opens day detail Sheet with that day's logs

**Empty state**: "Log your first task" + focus quick-add.

### 6.3 Clients `/clients`

**Purpose**: manage who you bill and how.

**List page** `/clients`:
1. PageHeader: "Clients" + "Add client" button
2. Filter: status tabs (Active / Paused / Ended / All), search
3. **Table**:
   - Columns: Name + company (stacked), Status badge, Billing type, Rate (formatted with currency), Cutoff (next date), Last invoiced (relative), ⋯
   - Row click → `/clients/[id]`

**Detail page** `/clients/[id]`:
- Header: client name + company, status badge, ⋯ menu (edit, archive, delete)
- Tabs:
  - **Overview**: contact card, billing card, contract dates, default invoice notes
  - **Work Logs**: filtered work log table for this client
  - **Invoices**: filtered invoice list for this client
  - **Rate history**: timeline (vertical, newest first) showing rate changes with effective dates
- "Edit" opens a Sheet with the full form

**Client form** (Sheet, ~480px wide):
- Section: Identity — name, company, contact person, email, timezone, work type
- Section: Status — status select, contract start, contract end
- Section: Billing — billing type, rate or salary, currency, payment terms (days)
- Section: Cutoff — schedule builder (radio: weekly / biweekly 15+30 / monthly / custom)
- Section: Defaults — default invoice notes (textarea)
- Sticky footer: Cancel + Save

### 6.4 Invoices `/invoices`

**List page**:
1. PageHeader: "Invoices" + "Generate invoice" button
2. **Status filter pills** (above the table): All | Draft | Sent | Partially Paid | Paid | Overdue | Cancelled (counts in parens)
3. **Table**:
   - Columns: #, Client, Period (Mar 1 – Mar 15), Issued, Due, Total (formatted), Paid, Status badge, ⋯
   - Status badge colors: draft=slate, sent=blue, partially_paid=amber, paid=emerald, overdue=red, cancelled=zinc
   - Row click → `/invoices/[id]`

**Generate page** `/invoices/new`:

This is the **most important screen in the app**. Three-step single-page wizard (no actual step indicator, just visually sectioned):

1. **Section: Choose** — Client select (combobox), Date range picker. As soon as both are picked, the next section appears.
2. **Section: Work logs**
   - Auto-loaded list of all `unbilled + billable` logs in that range for that client
   - Checkbox column, select-all header
   - Inline columns: Date, Title, Hours, Rate snapshot
   - Subtotal of selected updates in real-time at the right
3. **Section: Adjustments**
   - Add manual line item button (e.g. "Stripe fees", "Hosting")
   - Discount: % or fixed (toggle)
   - Tax: %
   - Notes: textarea (pre-filled with client's default invoice notes)
4. **Sticky right sidebar (lg) or bottom card (mobile)** — Invoice preview:
   - Invoice # (next in sequence: "INV-0042")
   - Issued: today | Due: today + payment_terms_days
   - Subtotal / Discount / Tax / Total (totals update live)
   - Primary button: "Save as draft" + secondary: "Save and mark as sent"

**Detail page** `/invoices/[id]`:
- Top bar: invoice # + status badge + action menu (Edit / Mark sent / Mark paid / Download PDF / Delete)
- Two-column layout (lg): 
  - **Left (main)**: full invoice as it'll render in the PDF — your business info, client info, period, line items table, totals
  - **Right (rail, 320px)**: 
    - Status card with quick mark-paid button
    - Payment summary (total / paid / outstanding)
    - Payment history list (Phase 2: payments table)
    - Activity log (Phase 2)
- Below on mobile: stacked

### 6.5 Settings `/settings`

Tabs (vertical on lg, horizontal on mobile):

- **Business profile** — business name, address, email, tax ID, logo upload (square, 200×200), preview chip showing how it'll look on PDF
- **Invoicing** — base currency, invoice number format (`INV-####` / `YYYY-####` / custom), default payment terms (days), default invoice notes
- **Account** — email (read-only), change password, sign out

## 7. Phase 2 / 3 page sketches (for future design work)

### Payments `/payments` (Phase 2)
- List of all payments across all invoices
- Filter by client, date range, method
- "Record payment" button → opens dialog: invoice select, amount (with currency), date, method (radio: bank transfer / PayPal / Wise / crypto / cash / other), reference number, notes, proof upload (image/PDF)
- Recording a payment auto-updates the invoice status

### Checklist Viewer `/checklists` (Phase 3)
- Two-pane layout: left = uploaded docs list (grouped by client), right = viewer
- Upload area accepts PDF / HTML / Markdown
- HTML renders in a sandboxed iframe (security)
- Markdown renders as formatted text with checkboxes inline
- Extracted checklist items live in a separate panel; check off, add notes per item

### Access Vault `/vault` (Phase 3)
- Table of accounts grouped by client
- Columns: Platform, Username/Email, Account Type, Access Level, Last Updated
- "Open in Bitwarden" deep link (or copy reference)
- **No raw passwords ever** — only reference fields

### Reports `/reports` (Phase 3)
- Tabs: Income / Hours / Clients / Rates
- Each tab: date range selector + 2-3 large charts + summary table
- Export CSV button

## 8. Component vocabulary (reuse these names)

| Component | Where used | Notes |
|---|---|---|
| `PageHeader` | Top of every page | title + optional description + optional action button |
| `StatCard` | Dashboard | label + big number + optional delta indicator |
| `EmptyState` | First-load on any list page | icon + heading + body + CTA |
| `DataTable` | Work logs, invoices, clients, payments | wraps TanStack Table with consistent styling |
| `StatusBadge` | Invoice/work log/client status | maps status → color |
| `ClientCombobox` | Quick-add, invoice generator | searchable client picker with avatar |
| `MoneyInput` | All currency forms | enforces decimals, shows currency prefix |
| `DateRangePicker` | Invoice generator, filters | two-month popover calendar |
| `RateHistoryTimeline` | Client detail | vertical timeline |
| `InvoiceLineItems` | Invoice generator, detail | editable line item table |

## 9. Status colors (use consistently everywhere)

| Status | Color | Tailwind class hints |
|---|---|---|
| Draft | slate | `bg-slate-100 text-slate-700` |
| Active / Sent | blue | `bg-blue-100 text-blue-700` |
| Partial / Pending | amber | `bg-amber-100 text-amber-800` |
| Paid / Success | emerald | `bg-emerald-100 text-emerald-700` |
| Overdue / Error | red | `bg-red-100 text-red-700` |
| Cancelled / Archived | zinc | `bg-zinc-100 text-zinc-600` |
| Unbilled | violet | `bg-violet-100 text-violet-700` |

(Dark mode variants use `dark:` prefix with `bg-*-950/40 text-*-300`.)

## 10. Currency display rules

- Always show currency code on first appearance: `$50.00 USD`, `₱2,500.00 PHP`
- In tight tables, omit code if column is single-currency
- Mixed-currency dashboards always show currency
- Never show currency without thousands separators
- Stored as integer cents; never displayed as cents

## 11. PDF invoice template (separate visual design needed)

A4 page, three sections:
- **Header band**: business logo (left), business name + address + email + tax ID (left under logo), invoice # + dates (right aligned)
- **Bill to / Period band**: client name + company + email (left), period start–end + due date (right)
- **Line items table**: Description | Hours | Rate | Amount. Currency in column header.
- **Totals stack** (right-aligned): Subtotal / Discount / Tax / Expenses / **Total** (bold, larger)
- **Notes**: italicized, smaller
- **Footer**: "Generated by Worklog" + page number

## 12. Empty states — write the copy

Every list page must have one. Format: icon + heading + body + CTA.

- Clients (empty): "No clients yet" / "Add a client to start tracking work and generating invoices." / [Add client]
- Work logs (empty): "Nothing logged yet" / "Log your first task — it'll take 10 seconds." / [Focus on quick-add]
- Invoices (empty): "No invoices yet" / "Generate your first invoice from logged work." / [Generate invoice]
- Invoices (filtered empty): "No invoices match these filters." / [Clear filters]

## 13. What to design FIRST (priority order)

1. **Dashboard** (the marketing page — first impression)
2. **Work Logs** (most-used page — quick-add bar must be perfect)
3. **Invoice generator** (the magic moment — turning logs into money)
4. **Invoice detail / PDF template** (what the client sees)
5. **Clients list + form**
6. **Settings**
7. Empty states + loading skeletons + error states for all of the above

## 14. Out of scope for design right now

- Onboarding flow (assume users land on empty dashboard, figure it out)
- Public marketing site / landing page
- Phase 2 and Phase 3 pages — wait until Phase 1 is shipped before designing these in detail

---

**End of context.** When using this file with a design tool, you can ask:
- "Mock the Dashboard page based on the spec in section 6.1"
- "Design the Work Logs quick-add bar described in section 6.2"
- "Critique my current invoice generator layout against section 6.4"
- "Create a PDF invoice template per section 11"
