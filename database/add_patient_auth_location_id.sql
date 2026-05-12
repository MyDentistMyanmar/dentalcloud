ALTER TABLE patient_auth
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

UPDATE patient_auth pa
SET location_id = p.location_id
FROM patients p
WHERE pa.patient_id = p.id
  AND (pa.location_id IS NULL OR pa.location_id IS DISTINCT FROM p.location_id);

CREATE INDEX IF NOT EXISTS idx_patient_auth_location_id ON patient_auth(location_id);
