// Drizzle schema — single source of truth for all tables.
//
// Conventions:
// - Every row is scoped by user_id (uuid) referencing Supabase auth.users.
// - RLS is enforced at the DB layer (see drizzle/post-push.sql).
// - All money is stored as integer cents. NEVER use floats for money.
// - All timestamps are timestamptz.

import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  time,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

// ============================================================
// Enums
// ============================================================

export const clientStatus = pgEnum("client_status", [
  "active",
  "paused",
  "ended",
])

export const billingType = pgEnum("billing_type", [
  "hourly",
  "weekly",
  "bi_monthly",
  "monthly",
  "fixed_project",
])

export const workLogStatus = pgEnum("work_log_status", [
  "unbilled",
  "billed",
  "paid",
])

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "cancelled",
])

export const invoiceItemUnit = pgEnum("invoice_item_unit", ["hours", "flat"])

// ============================================================
// Tables
// ============================================================

// Note on user_id: references auth.users(id) but Drizzle can't model the auth
// schema natively, so we treat it as an opaque uuid here. The actual FK is
// added in drizzle/post-push.sql so it cascades on user deletion.

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    companyName: text("company_name"),
    contactPerson: text("contact_person"),
    email: text("email"),
    timezone: text("timezone").notNull().default("UTC"),
    workType: text("work_type"),
    status: clientStatus("status").notNull().default("active"),
    billingType: billingType("billing_type").notNull().default("hourly"),
    hourlyRateCents: integer("hourly_rate_cents"),
    monthlySalaryCents: integer("monthly_salary_cents"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    cutoffSchedule: jsonb("cutoff_schedule"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(7),
    defaultInvoiceNotes: text("default_invoice_notes"),
    contractStart: date("contract_start"),
    contractEnd: date("contract_end"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("clients_user_status_idx").on(t.userId, t.status),
    index("clients_user_name_idx").on(t.userId, t.name),
  ],
)

export const clientRateHistory = pgTable(
  "client_rate_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    rateCents: integer("rate_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    billingType: billingType("billing_type").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"), // null = current
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("client_rate_history_client_from_idx").on(t.clientId, t.effectiveFrom),
    index("client_rate_history_user_idx").on(t.userId),
  ],
)

export const invoiceSequences = pgTable("invoice_sequences", {
  userId: uuid("user_id").primaryKey(),
  nextNumber: integer("next_number").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    invoiceNumber: text("invoice_number").notNull(),
    status: invoiceStatus("status").notNull().default("draft"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    issuedDate: date("issued_date").notNull(),
    dueDate: date("due_date").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    expensesCents: integer("expenses_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    notes: text("notes"),
    rateSnapshotCents: integer("rate_snapshot_cents"),
    pdfStoragePath: text("pdf_storage_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("invoices_user_number_uniq").on(t.userId, t.invoiceNumber),
    index("invoices_user_status_idx").on(t.userId, t.status),
    index("invoices_user_client_idx").on(t.userId, t.clientId),
    index("invoices_user_due_idx").on(t.userId, t.dueDate),
  ],
)

export const workLogs = pgTable(
  "work_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    notes: text("notes"),
    workDate: date("work_date").notNull(),
    startTime: time("start_time", { withTimezone: true }),
    endTime: time("end_time", { withTimezone: true }),
    durationMinutes: integer("duration_minutes").notNull(),
    tag: text("tag"),
    billable: boolean("billable").notNull().default(true),
    invoiceStatus: workLogStatus("invoice_status").notNull().default("unbilled"),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    attachmentUrl: text("attachment_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("work_logs_user_client_date_idx").on(t.userId, t.clientId, t.workDate),
    index("work_logs_user_status_idx").on(t.userId, t.invoiceStatus),
    index("work_logs_user_date_idx").on(t.userId, t.workDate),
    index("work_logs_invoice_idx").on(t.invoiceId),
  ],
)

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    workLogId: uuid("work_log_id").references(() => workLogs.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unit: invoiceItemUnit("unit").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("invoice_items_invoice_idx").on(t.invoiceId),
    index("invoice_items_user_idx").on(t.userId),
  ],
)

export const settings = pgTable("settings", {
  userId: uuid("user_id").primaryKey(),
  baseCurrency: varchar("base_currency", { length: 3 }).notNull().default("USD"),
  invoiceNumberFormat: text("invoice_number_format").notNull().default("INV-####"),
  defaultPaymentTerms: integer("default_payment_terms").notNull().default(7),
  businessName: text("business_name"),
  businessAddress: text("business_address"),
  businessEmail: text("business_email"),
  taxId: text("tax_id"),
  logoStoragePath: text("logo_storage_path"),
  defaultInvoiceNotes: text("default_invoice_notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

// ============================================================
// Types — inferred for ergonomic use in server actions
// ============================================================

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type ClientRate = typeof clientRateHistory.$inferSelect
export type WorkLog = typeof workLogs.$inferSelect
export type NewWorkLog = typeof workLogs.$inferInsert
export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type InvoiceItem = typeof invoiceItems.$inferSelect
export type NewInvoiceItem = typeof invoiceItems.$inferInsert
export type Settings = typeof settings.$inferSelect
