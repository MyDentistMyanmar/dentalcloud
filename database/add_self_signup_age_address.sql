-- ============================================================================
-- MIGRATION: Add age and address to patient self-signup flow
-- ============================================================================
-- This migration ensures the patients table has the age and address columns
-- needed for the enhanced patient self-registration form.
-- 
-- These columns already exist in the complete_database_setup.sql schema,
-- but this migration ensures they exist in existing databases as well.
-- ============================================================================

-- Add age column if it doesn't exist
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN patients.age IS 'Patient age in years (including self-signup)';
COMMENT ON COLUMN patients.address IS 'Street address (including self-signup)';

-- Verification
SELECT 'Migration completed successfully!' as status;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'patients' 
  AND column_name IN ('age', 'address')
ORDER BY column_name;
