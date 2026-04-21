-- Enable admin <-> doctor conversations in messaging
-- Run this in Supabase SQL editor before using doctor chat from admin panel.

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS doctor_user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_doctor_user_id_fkey'
  ) THEN
    ALTER TABLE conversations
    ADD CONSTRAINT conversations_doctor_user_id_fkey
    FOREIGN KEY (doctor_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Old schema had UNIQUE(patient_id, admin_id). Drop it so we can support doctor-user threads too.
ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_patient_id_admin_id_key;

-- Ensure each conversation is either patient+admin OR doctor_user+admin (not both, not none).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_participant_check'
  ) THEN
    ALTER TABLE conversations
    ADD CONSTRAINT conversations_participant_check
    CHECK (
      (patient_id IS NOT NULL AND doctor_user_id IS NULL) OR
      (patient_id IS NULL AND doctor_user_id IS NOT NULL)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_doctor_user_id
ON conversations(doctor_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_patient_admin_unique
ON conversations(patient_id, admin_id)
WHERE patient_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_doctor_admin_unique
ON conversations(doctor_user_id, admin_id)
WHERE doctor_user_id IS NOT NULL;
