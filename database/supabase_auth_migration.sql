-- Supabase Auth Integration Migration
-- Run this SQL in your Supabase SQL Editor to enable Supabase Auth integration

-- 1. Add Supabase user ID reference to patient_auth table
ALTER TABLE patient_auth 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

-- 2. Create index for faster lookups on supabase_user_id
CREATE INDEX IF NOT EXISTS idx_patient_auth_supabase_user_id 
ON patient_auth(supabase_user_id);

-- 3. (Optional) Create a function to auto-link Supabase Auth users to patient_auth
-- This trigger runs when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_supabase_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Update patient_auth with the Supabase user ID if email matches
  UPDATE patient_auth 
  SET supabase_user_id = NEW.id
  WHERE email = NEW.email
    AND supabase_user_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger to auto-link users (optional, but helpful)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_supabase_user();

-- 5. Note: Make sure RLS is properly configured for patient_auth table
-- If you're using RLS, you may need to add policies like:
/*
-- Allow authenticated users to read their own auth record
CREATE POLICY "Users can view own patient_auth" ON patient_auth
  FOR SELECT
  USING (
    supabase_user_id = auth.uid()
    OR email = auth.email()
  );

-- Allow service role to manage patient_auth
CREATE POLICY "Service role can manage patient_auth" ON patient_auth
  USING (true)
  WITH CHECK (true);
*/

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'patient_auth' 
ORDER BY ordinal_position;
