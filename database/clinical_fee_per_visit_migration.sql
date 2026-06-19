-- ============================================================================
-- MIGRATION: Per-visit clinical fees for new and returning patients
-- ============================================================================
-- Purpose:
-- 1) Replace the registration-only fee with a fee charged when an appointment
--    is completed.
-- 2) Support separate first-visit and returning-patient prices.
-- 3) Persist apply/skip decisions on each appointment.
-- 4) Apply each fee atomically and at most once.
--
-- Safe to run multiple times.
-- ============================================================================

BEGIN;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS clinical_fee_new_patient_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS clinical_fee_returning_patient_amount DECIMAL(12,2);

UPDATE app_settings
SET
  clinical_fee_new_patient_amount = COALESCE(clinical_fee_new_patient_amount, clinical_fee_amount, 0),
  clinical_fee_returning_patient_amount = COALESCE(clinical_fee_returning_patient_amount, clinical_fee_amount, 0)
WHERE id = 1;

ALTER TABLE app_settings
  ALTER COLUMN clinical_fee_new_patient_amount SET DEFAULT 0,
  ALTER COLUMN clinical_fee_returning_patient_amount SET DEFAULT 0,
  DROP CONSTRAINT IF EXISTS app_settings_clinical_fee_new_patient_amount_check,
  DROP CONSTRAINT IF EXISTS app_settings_clinical_fee_returning_patient_amount_check;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_clinical_fee_new_patient_amount_check
    CHECK (clinical_fee_new_patient_amount >= 0),
  ADD CONSTRAINT app_settings_clinical_fee_returning_patient_amount_check
    CHECK (clinical_fee_returning_patient_amount >= 0);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS clinical_fee_status VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS clinical_fee_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clinical_fee_patient_category VARCHAR(20),
  ADD COLUMN IF NOT EXISTS clinical_fee_applied_at TIMESTAMP WITH TIME ZONE;

-- Historical completed appointments predate per-visit charging and must never
-- be charged retroactively.
UPDATE appointments
SET clinical_fee_status = 'NOT_APPLICABLE'
WHERE status = 'Completed'
  AND COALESCE(clinical_fee_status, 'PENDING') = 'PENDING';

UPDATE appointments
SET
  clinical_fee_status = COALESCE(clinical_fee_status, 'PENDING'),
  clinical_fee_amount = COALESCE(clinical_fee_amount, 0);

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_clinical_fee_status_check,
  DROP CONSTRAINT IF EXISTS appointments_clinical_fee_amount_check,
  DROP CONSTRAINT IF EXISTS appointments_clinical_fee_patient_category_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_clinical_fee_status_check
    CHECK (clinical_fee_status IN ('PENDING', 'APPLIED', 'SKIPPED', 'NOT_APPLICABLE')),
  ADD CONSTRAINT appointments_clinical_fee_amount_check
    CHECK (clinical_fee_amount >= 0),
  ADD CONSTRAINT appointments_clinical_fee_patient_category_check
    CHECK (
      clinical_fee_patient_category IS NULL
      OR clinical_fee_patient_category IN ('NEW', 'RETURNING')
    );

CREATE INDEX IF NOT EXISTS idx_appointments_patient_completed_visit
  ON appointments (patient_id, date, time)
  WHERE status = 'Completed';

CREATE OR REPLACE FUNCTION complete_appointment_with_clinical_fee(
  p_appointment_id UUID,
  p_skip_clinical_fee BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  appointment_id UUID,
  fee_status VARCHAR,
  fee_amount DECIMAL,
  patient_category VARCHAR,
  new_balance DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment appointments%ROWTYPE;
  v_patient patients%ROWTYPE;
  v_settings app_settings%ROWTYPE;
  v_is_returning BOOLEAN := FALSE;
  v_category VARCHAR(20);
  v_fee DECIMAL(12,2) := 0;
  v_fee_status VARCHAR(20) := 'NOT_APPLICABLE';
BEGIN
  SELECT *
  INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- A completed appointment with a final fee decision is idempotent.
  IF v_appointment.status = 'Completed'
     AND v_appointment.clinical_fee_status IN ('APPLIED', 'SKIPPED', 'NOT_APPLICABLE') THEN
    SELECT patient.balance INTO new_balance
    FROM patients patient
    WHERE patient.id = v_appointment.patient_id;

    appointment_id := v_appointment.id;
    fee_status := v_appointment.clinical_fee_status;
    fee_amount := COALESCE(v_appointment.clinical_fee_amount, 0);
    patient_category := v_appointment.clinical_fee_patient_category;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_appointment.patient_id IS NULL THEN
    UPDATE appointments
    SET
      status = 'Completed',
      clinical_fee_status = 'NOT_APPLICABLE',
      clinical_fee_amount = 0,
      clinical_fee_patient_category = NULL,
      clinical_fee_applied_at = NULL
    WHERE id = v_appointment.id;

    appointment_id := v_appointment.id;
    fee_status := 'NOT_APPLICABLE';
    fee_amount := 0;
    patient_category := NULL;
    new_balance := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_patient
  FROM patients
  WHERE id = v_appointment.patient_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  SELECT *
  INTO v_settings
  FROM app_settings
  WHERE id = 1;

  SELECT EXISTS (
    SELECT 1
    FROM appointments previous
    WHERE previous.patient_id = v_appointment.patient_id
      AND previous.id <> v_appointment.id
      AND previous.status = 'Completed'
      AND (
        previous.date < v_appointment.date
        OR (previous.date = v_appointment.date AND previous.time < v_appointment.time)
      )
  ) OR EXISTS (
    SELECT 1
    FROM treatments previous_treatment
    WHERE previous_treatment.patient_id = v_appointment.patient_id
      AND previous_treatment.date < v_appointment.date
  )
  INTO v_is_returning;

  v_category := CASE WHEN v_is_returning THEN 'RETURNING' ELSE 'NEW' END;

  IF p_skip_clinical_fee THEN
    v_fee_status := 'SKIPPED';
  ELSIF COALESCE(v_settings.clinical_fee_enabled, FALSE) THEN
    v_fee := CASE
      WHEN v_is_returning THEN COALESCE(v_settings.clinical_fee_returning_patient_amount, 0)
      ELSE COALESCE(v_settings.clinical_fee_new_patient_amount, 0)
    END;

    IF v_fee > 0 THEN
      UPDATE patients
      SET balance = ROUND((COALESCE(balance, 0) + v_fee)::NUMERIC, 2)
      WHERE id = v_patient.id
      RETURNING * INTO v_patient;

      v_fee_status := 'APPLIED';
    END IF;
  END IF;

  UPDATE appointments
  SET
    status = 'Completed',
    clinical_fee_status = v_fee_status,
    clinical_fee_amount = CASE WHEN v_fee_status = 'APPLIED' THEN v_fee ELSE 0 END,
    clinical_fee_patient_category = v_category,
    clinical_fee_applied_at = CASE WHEN v_fee_status = 'APPLIED' THEN NOW() ELSE NULL END
  WHERE id = v_appointment.id;

  appointment_id := v_appointment.id;
  fee_status := v_fee_status;
  fee_amount := CASE WHEN v_fee_status = 'APPLIED' THEN v_fee ELSE 0 END;
  patient_category := v_category;
  new_balance := v_patient.balance;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION complete_appointment_with_clinical_fee(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_appointment_with_clinical_fee(UUID, BOOLEAN) TO anon, authenticated;

COMMIT;

SELECT
  'migration_ok' AS status,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings'
      AND column_name = 'clinical_fee_new_patient_amount'
  ) AS has_new_patient_fee,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings'
      AND column_name = 'clinical_fee_returning_patient_amount'
  ) AS has_returning_patient_fee,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments'
      AND column_name = 'clinical_fee_status'
  ) AS has_appointment_fee_tracking;
