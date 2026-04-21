-- Add doctor password and doctor-linked staff login support
-- Run this in Supabase SQL editor.

ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS password VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS doctor_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_doctor_id_fkey'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_doctor_id_unique_idx
ON users(doctor_id)
WHERE doctor_id IS NOT NULL;
