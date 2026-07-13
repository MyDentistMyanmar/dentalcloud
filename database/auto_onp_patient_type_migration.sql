-- Add Settings > General toggle for automatic ONP patient type conversion.
-- When enabled in the app, patients registered at least one month ago are
-- changed to ONP during patient data refresh.

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS auto_onp_patient_type_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE app_settings
SET auto_onp_patient_type_enabled = COALESCE(auto_onp_patient_type_enabled, FALSE)
WHERE id = 1;

NOTIFY pgrst, 'reload schema';
