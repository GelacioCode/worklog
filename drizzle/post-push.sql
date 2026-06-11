-- ============================================================
-- post-push.sql
-- Applied AFTER Drizzle pushes the schema. Contains things Drizzle
-- doesn't manage: auth.users FKs, RLS policies, triggers, functions.
-- Safe to re-run (idempotent via IF NOT EXISTS / DROP+CREATE).
-- ============================================================

-- ============================================================
-- 1. Foreign keys to auth.users so deleting a user cascades.
--    (Drizzle can't reference auth.users; we add FKs here.)
-- ============================================================

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_user_id_fkey,
  ADD CONSTRAINT clients_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE client_rate_history
  DROP CONSTRAINT IF EXISTS client_rate_history_user_id_fkey,
  ADD CONSTRAINT client_rate_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE work_logs
  DROP CONSTRAINT IF EXISTS work_logs_user_id_fkey,
  ADD CONSTRAINT work_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_user_id_fkey,
  ADD CONSTRAINT invoices_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_user_id_fkey,
  ADD CONSTRAINT invoice_items_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE invoice_sequences
  DROP CONSTRAINT IF EXISTS invoice_sequences_user_id_fkey,
  ADD CONSTRAINT invoice_sequences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE settings
  DROP CONSTRAINT IF EXISTS settings_user_id_fkey,
  ADD CONSTRAINT settings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Shared functions
-- ============================================================

-- Bump updated_at on row update.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- On INSERT into clients: snapshot the starting rate into client_rate_history.
CREATE OR REPLACE FUNCTION snapshot_client_rate_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO client_rate_history (user_id, client_id, rate_cents, currency, billing_type, effective_from)
  VALUES (
    NEW.user_id,
    NEW.id,
    COALESCE(NEW.hourly_rate_cents, NEW.monthly_salary_cents, 0),
    NEW.currency,
    NEW.billing_type,
    CURRENT_DATE
  );
  RETURN NEW;
END;
$$;

-- On UPDATE of clients: if rate/currency/billing_type changed, close the
-- current rate history row and open a new one. This keeps historical invoices
-- pointing at the rate that was in effect when they were issued.
CREATE OR REPLACE FUNCTION snapshot_client_rate_on_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.hourly_rate_cents      IS DISTINCT FROM OLD.hourly_rate_cents
     OR NEW.monthly_salary_cents IS DISTINCT FROM OLD.monthly_salary_cents
     OR NEW.currency             IS DISTINCT FROM OLD.currency
     OR NEW.billing_type         IS DISTINCT FROM OLD.billing_type THEN

    UPDATE client_rate_history
    SET effective_to = CURRENT_DATE
    WHERE client_id = NEW.id AND effective_to IS NULL;

    INSERT INTO client_rate_history (user_id, client_id, rate_cents, currency, billing_type, effective_from)
    VALUES (
      NEW.user_id,
      NEW.id,
      COALESCE(NEW.hourly_rate_cents, NEW.monthly_salary_cents, 0),
      NEW.currency,
      NEW.billing_type,
      CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Triggers
-- ============================================================

-- updated_at triggers
DROP TRIGGER IF EXISTS clients_set_updated_at ON clients;
CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS work_logs_set_updated_at ON work_logs;
CREATE TRIGGER work_logs_set_updated_at BEFORE UPDATE ON work_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS invoices_set_updated_at ON invoices;
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS settings_set_updated_at ON settings;
CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS invoice_sequences_set_updated_at ON invoice_sequences;
CREATE TRIGGER invoice_sequences_set_updated_at BEFORE UPDATE ON invoice_sequences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Rate history snapshot triggers
DROP TRIGGER IF EXISTS clients_snapshot_rate_insert ON clients;
CREATE TRIGGER clients_snapshot_rate_insert AFTER INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION snapshot_client_rate_on_insert();

DROP TRIGGER IF EXISTS clients_snapshot_rate_update ON clients;
CREATE TRIGGER clients_snapshot_rate_update AFTER UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION snapshot_client_rate_on_update();

-- ============================================================
-- 4. Row Level Security
--    Pattern on every table: user_id = auth.uid()
--    Enabled for: SELECT / INSERT / UPDATE / DELETE
-- ============================================================

-- helper macro inlined for each table since Postgres has no DO-block for policy DDL

-- clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clients_select_own ON clients;
DROP POLICY IF EXISTS clients_insert_own ON clients;
DROP POLICY IF EXISTS clients_update_own ON clients;
DROP POLICY IF EXISTS clients_delete_own ON clients;
CREATE POLICY clients_select_own ON clients FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY clients_insert_own ON clients FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY clients_update_own ON clients FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY clients_delete_own ON clients FOR DELETE TO authenticated USING (user_id = auth.uid());

-- client_rate_history
ALTER TABLE client_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_rate_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crh_select_own ON client_rate_history;
DROP POLICY IF EXISTS crh_insert_own ON client_rate_history;
DROP POLICY IF EXISTS crh_update_own ON client_rate_history;
DROP POLICY IF EXISTS crh_delete_own ON client_rate_history;
CREATE POLICY crh_select_own ON client_rate_history FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY crh_insert_own ON client_rate_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY crh_update_own ON client_rate_history FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY crh_delete_own ON client_rate_history FOR DELETE TO authenticated USING (user_id = auth.uid());

-- work_logs
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS work_logs_select_own ON work_logs;
DROP POLICY IF EXISTS work_logs_insert_own ON work_logs;
DROP POLICY IF EXISTS work_logs_update_own ON work_logs;
DROP POLICY IF EXISTS work_logs_delete_own ON work_logs;
CREATE POLICY work_logs_select_own ON work_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY work_logs_insert_own ON work_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY work_logs_update_own ON work_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY work_logs_delete_own ON work_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_select_own ON invoices;
DROP POLICY IF EXISTS invoices_insert_own ON invoices;
DROP POLICY IF EXISTS invoices_update_own ON invoices;
DROP POLICY IF EXISTS invoices_delete_own ON invoices;
CREATE POLICY invoices_select_own ON invoices FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY invoices_insert_own ON invoices FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY invoices_update_own ON invoices FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY invoices_delete_own ON invoices FOR DELETE TO authenticated USING (user_id = auth.uid());

-- invoice_items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_items_select_own ON invoice_items;
DROP POLICY IF EXISTS invoice_items_insert_own ON invoice_items;
DROP POLICY IF EXISTS invoice_items_update_own ON invoice_items;
DROP POLICY IF EXISTS invoice_items_delete_own ON invoice_items;
CREATE POLICY invoice_items_select_own ON invoice_items FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY invoice_items_insert_own ON invoice_items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY invoice_items_update_own ON invoice_items FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY invoice_items_delete_own ON invoice_items FOR DELETE TO authenticated USING (user_id = auth.uid());

-- invoice_sequences
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_sequences_select_own ON invoice_sequences;
DROP POLICY IF EXISTS invoice_sequences_insert_own ON invoice_sequences;
DROP POLICY IF EXISTS invoice_sequences_update_own ON invoice_sequences;
DROP POLICY IF EXISTS invoice_sequences_delete_own ON invoice_sequences;
CREATE POLICY invoice_sequences_select_own ON invoice_sequences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY invoice_sequences_insert_own ON invoice_sequences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY invoice_sequences_update_own ON invoice_sequences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY invoice_sequences_delete_own ON invoice_sequences FOR DELETE TO authenticated USING (user_id = auth.uid());

-- settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_select_own ON settings;
DROP POLICY IF EXISTS settings_insert_own ON settings;
DROP POLICY IF EXISTS settings_update_own ON settings;
DROP POLICY IF EXISTS settings_delete_own ON settings;
CREATE POLICY settings_select_own ON settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY settings_insert_own ON settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY settings_update_own ON settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY settings_delete_own ON settings FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 5. Supabase Storage — business-logos bucket
--    Per-user folder layout: {userId}/logo.{ext}
--    RLS scoped so each user can only touch their own folder.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  false,
  1048576, -- 1 MB cap
  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "business_logos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_delete_own" ON storage.objects;

CREATE POLICY "business_logos_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "business_logos_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "business_logos_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'business-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "business_logos_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
