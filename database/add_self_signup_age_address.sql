-- ============================================================================
-- MIGRATION: Add age and address to patient self-signup flow
-- ============================================================================
-- This migration ensures the patients table has the age and address columns
-- needed for the enhanced patient self-registration form.
-- 
-- These columns already exist in the complete_database_setup.sql schema,
-- but this migration ensures they exist in existing databases as well.
-- ============================================================================

-- Add columns if they don't exist
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS township VARCHAR(100);

-- Add index for city for location-based queries
CREATE INDEX IF NOT EXISTS idx_patients_city ON patients(city);

-- Add comments for documentation
COMMENT ON COLUMN patients.age IS 'Patient age in years (including self-signup)';
COMMENT ON COLUMN patients.address IS 'Street address (including self-signup)';
COMMENT ON COLUMN patients.city IS 'City (including self-signup)';
COMMENT ON COLUMN patients.township IS 'Township (including self-signup)';

-- Verification
SELECT 'Migration completed successfully!' as status;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'patients' 
  AND column_name IN ('age', 'address', 'city', 'township')
ORDER BY column_name;
