CREATE TYPE "public"."billing_type" AS ENUM('hourly', 'weekly', 'bi_monthly', 'monthly', 'fixed_project');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."invoice_item_unit" AS ENUM('hours', 'flat');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_log_status" AS ENUM('unbilled', 'billed', 'paid');--> statement-breakpoint
CREATE TABLE "client_rate_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"rate_cents" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"billing_type" "billing_type" NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"company_name" text,
	"contact_person" text,
	"email" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"work_type" text,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"billing_type" "billing_type" DEFAULT 'hourly' NOT NULL,
	"hourly_rate_cents" integer,
	"monthly_salary_cents" integer,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"cutoff_schedule" jsonb,
	"payment_terms_days" integer DEFAULT 7 NOT NULL,
	"default_invoice_notes" text,
	"contract_start" date,
	"contract_end" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"work_log_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" "invoice_item_unit" NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"period_start" date,
	"period_end" date,
	"issued_date" date NOT NULL,
	"due_date" date NOT NULL,
	"currency" varchar(3) NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"expenses_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"amount_paid_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"rate_snapshot_cents" integer,
	"pdf_storage_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"base_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"invoice_number_format" text DEFAULT 'INV-####' NOT NULL,
	"default_payment_terms" integer DEFAULT 7 NOT NULL,
	"business_name" text,
	"business_address" text,
	"business_email" text,
	"tax_id" text,
	"logo_storage_path" text,
	"default_invoice_notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"notes" text,
	"work_date" date NOT NULL,
	"start_time" time with time zone,
	"end_time" time with time zone,
	"duration_minutes" integer NOT NULL,
	"tag" text,
	"billable" boolean DEFAULT true NOT NULL,
	"invoice_status" "work_log_status" DEFAULT 'unbilled' NOT NULL,
	"invoice_id" uuid,
	"attachment_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_rate_history" ADD CONSTRAINT "client_rate_history_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_work_log_id_work_logs_id_fk" FOREIGN KEY ("work_log_id") REFERENCES "public"."work_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_rate_history_client_from_idx" ON "client_rate_history" USING btree ("client_id","effective_from");--> statement-breakpoint
CREATE INDEX "client_rate_history_user_idx" ON "client_rate_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clients_user_status_idx" ON "clients" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "clients_user_name_idx" ON "clients" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_user_idx" ON "invoice_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_user_number_uniq" ON "invoices" USING btree ("user_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_user_status_idx" ON "invoices" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "invoices_user_client_idx" ON "invoices" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "invoices_user_due_idx" ON "invoices" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "work_logs_user_client_date_idx" ON "work_logs" USING btree ("user_id","client_id","work_date");--> statement-breakpoint
CREATE INDEX "work_logs_user_status_idx" ON "work_logs" USING btree ("user_id","invoice_status");--> statement-breakpoint
CREATE INDEX "work_logs_user_date_idx" ON "work_logs" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE INDEX "work_logs_invoice_idx" ON "work_logs" USING btree ("invoice_id");