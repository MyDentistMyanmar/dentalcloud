-- ============================================================================
-- RECEIPT INFO MIGRATION
-- ============================================================================
-- This migration adds `receipt_email` and `receipt_phone` columns to the
-- `app_settings` table, allowing custom contact info displayed on receipts.
--
-- Safe to run multiple times — all statements use IF NOT EXISTS / idempotent checks.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ADD receipt_email AND receipt_phone COLUMNS TO app_settings
-- ----------------------------------------------------------------------------
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS receipt_email VARCHAR(255) DEFAULT 'info@dentflowpro.com';

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS receipt_phone VARCHAR(50) DEFAULT '(555) 123-4567';

-- ----------------------------------------------------------------------------
-- 2. ENSURE DEFAULT ROW EXISTS
-- ----------------------------------------------------------------------------
INSERT INTO app_settings (id, receipt_email, receipt_phone)
VALUES (1, 'info@dentflowpro.com', '(555) 123-4567')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. BACKFILL NULL VALUES ON EXISTING ROW
-- ----------------------------------------------------------------------------
UPDATE app_settings
SET
  receipt_email = COALESCE(receipt_email, 'info@dentflowpro.com'),
  receipt_phone = COALESCE(receipt_phone, '(555) 123-4567')
WHERE id = 1;

-- ----------------------------------------------------------------------------
-- 4. VERIFICATION
-- ----------------------------------------------------------------------------
SELECT '=== RECEIPT INFO MIGRATION COMPLETE ===' AS status;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'app_settings'
  AND column_name IN ('receipt_email', 'receipt_phone');

SELECT id, app_name, receipt_email, receipt_phone, updated_at
FROM app_settings
WHERE id = 1;

SELECT '=== MIGRATION SUCCESSFUL ===' AS final_message;

COMMIT;
