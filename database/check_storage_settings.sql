-- ============================================================================
-- DIAGNOSTIC: Check Current Storage Settings
-- ============================================================================
-- Run this to see what's currently configured

SELECT '=== CURRENT APP_SETTINGS ===' as status;

SELECT 
  'S3 URL' as setting, s3_url as value
FROM app_settings WHERE id = 1
UNION ALL
SELECT 'S3 Region', s3_region FROM app_settings WHERE id = 1
UNION ALL
SELECT 'S3 Access Key (first 10 chars)', LEFT(s3_access_key, 10) || '...' FROM app_settings WHERE id = 1
UNION ALL
SELECT 'Storage URL', storage_url FROM app_settings WHERE id = 1
UNION ALL
SELECT 'Storage Bucket', storage_bucket FROM app_settings WHERE id = 1
UNION ALL
SELECT 'Storage Anon Key (first 10 chars)', LEFT(storage_anon_key, 10) || '...' FROM app_settings WHERE id = 1;

-- ============================================================================
-- DIAGNOSTIC: Check Available Storage Buckets
-- ============================================================================
-- This queries Supabase Storage to list buckets
-- Note: This only works if you're connected to the self-hosted Supabase directly

SELECT '=== HOW TO FIX ===' as status;

-- The problem: You're still using S3-compatible API (which has signature issues)
-- The solution: Use the NEW Supabase Storage REST API settings

-- ============================================================================
-- FIX: Clear S3 settings and configure Supabase Storage
-- ============================================================================

-- Option 1: Run this in your MAIN Supabase to clear S3 and set Supabase Storage
UPDATE app_settings SET
  -- Clear S3 settings (these have signature issues)
  s3_url = NULL,
  s3_access_key = NULL,
  s3_secret_key = NULL,
  s3_region = NULL,
  
  -- Set Supabase Storage REST API (recommended - no signature issues!)
  -- Replace with YOUR actual credentials:
  storage_url = 'https://YOUR-SUBDOMAIN.supabase.co',  -- Your self-hosted Supabase URL
  storage_bucket = 'patient_files',                     -- Your bucket name
  storage_anon_key = 'sb_publishable_...',              -- Your anon/publishable key
  storage_service_key = 'sb_secret_...',                -- Your service role key
  
  updated_at = NOW()
WHERE id = 1;

-- Verify the update
SELECT '=== UPDATED SETTINGS ===' as status;
SELECT 
  'S3 URL (should be NULL)', 
  CASE WHEN s3_url IS NULL THEN '✅ NULL (correct)' ELSE '❌ Still set: ' || s3_url END as status
FROM app_settings WHERE id = 1
UNION ALL
SELECT 
  'Storage URL',
  CASE WHEN storage_url IS NOT NULL THEN '✅ Set: ' || storage_url ELSE '❌ NULL (incorrect)' END
FROM app_settings WHERE id = 1
UNION ALL
SELECT 
  'Storage Bucket',
  CASE WHEN storage_bucket IS NOT NULL THEN '✅ Set: ' || storage_bucket ELSE '❌ NULL (incorrect)' END
FROM app_settings WHERE id = 1
UNION ALL
SELECT 
  'Storage Anon Key (first 20 chars)',
  CASE WHEN storage_anon_key IS NOT NULL THEN '✅ Set: ' || LEFT(storage_anon_key, 20) || '...' ELSE '❌ NULL (incorrect)' END
FROM app_settings WHERE id = 1;

SELECT '=== DONE ===' as final_message;
