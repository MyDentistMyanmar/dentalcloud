-- ============================================================================
-- APP NAME MIGRATION
-- ============================================================================
-- This migration adds the `app_name` column to the `app_settings` table,
-- allowing custom branding of the application title (default: "DentalCloud Pro").
--
-- Safe to run multiple times — all statements use IF NOT EXISTS / idempotent checks.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ADD app_name COLUMN TO app_settings
-- ----------------------------------------------------------------------------
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS app_name VARCHAR(255) DEFAULT 'DentalCloud Pro';

-- ----------------------------------------------------------------------------
-- 2. ENSURE DEFAULT ROW EXISTS
-- ----------------------------------------------------------------------------
INSERT INTO app_settings (id, app_name)
VALUES (1, 'DentalCloud Pro')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. BACKFILL NULL app_name ON EXISTING ROW
-- ----------------------------------------------------------------------------
UPDATE app_settings
SET app_name = COALESCE(app_name, 'DentalCloud Pro')
WHERE id = 1;

-- ----------------------------------------------------------------------------
-- 4. VERIFICATION
-- ----------------------------------------------------------------------------
SELECT '=== APP NAME MIGRATION COMPLETE ===' AS status;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'app_settings' AND column_name = 'app_name';

SELECT id, app_name, created_at, updated_at
FROM app_settings
WHERE id = 1;

SELECT '=== MIGRATION SUCCESSFUL ===' AS final_message;

COMMIT;
