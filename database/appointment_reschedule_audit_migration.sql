-- Track appointment reschedules in a dedicated audit table.
CREATE TABLE IF NOT EXISTS appointment_reschedule_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(255) NOT NULL,
  doctor_name VARCHAR(255),
  original_date DATE NOT NULL,
  new_date DATE NOT NULL,
  reason TEXT NOT NULL,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_reschedule_logs_location_id
ON appointment_reschedule_logs(location_id);

CREATE INDEX IF NOT EXISTS idx_appointment_reschedule_logs_appointment_id
ON appointment_reschedule_logs(appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointment_reschedule_logs_created_at
ON appointment_reschedule_logs(created_at DESC);

ALTER TABLE appointment_reschedule_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_access_appointment_reschedule_logs" ON appointment_reschedule_logs;
CREATE POLICY "anon_full_access_appointment_reschedule_logs" ON appointment_reschedule_logs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
