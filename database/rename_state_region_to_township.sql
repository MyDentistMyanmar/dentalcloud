-- ============================================================================
-- MIGRATION: Rename state_region to township in patients table
-- ============================================================================
-- This migration renames the state_region column to township to better
-- reflect the administrative division used in Myanmar.
-- 
-- Run this script to update an existing database without losing data.
-- The column data will be preserved during the rename.
-- ============================================================================

-- Rename the column from state_region to township
ALTER TABLE patients 
RENAME COLUMN state_region TO township;

-- Update the index name to reflect the new column name
DROP INDEX IF EXISTS idx_patients_state_region;
CREATE INDEX IF NOT EXISTS idx_patients_township ON patients(township);

-- Update the comment for documentation
COMMENT ON COLUMN patients.township IS 'Township in Myanmar';

-- Verification
SELECT 'Migration completed successfully! Column state_region renamed to township.' as status;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'patients' 
  AND column_name IN ('age', 'address', 'city', 'township', 'patient_type')
ORDER BY column_name;
