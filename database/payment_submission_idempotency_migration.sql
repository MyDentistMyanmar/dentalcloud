-- Adds idempotency protection to payment processing.
-- Run this in Supabase SQL editor for existing deployments.

BEGIN;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS submission_key VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS payments_submission_key_unique
  ON payments (submission_key)
  WHERE submission_key IS NOT NULL;

DROP FUNCTION IF EXISTS process_patient_payment(UUID, DECIMAL, TEXT, UUID[], DATE, JSONB, UUID, TEXT);

CREATE OR REPLACE FUNCTION process_patient_payment(
  p_patient_id UUID,
  p_amount DECIMAL,
  p_payment_method TEXT,
  p_treatment_ids UUID[] DEFAULT '{}',
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_receipt_snapshot JSONB DEFAULT NULL,
  p_submission_key TEXT DEFAULT NULL,
  p_created_by_user_id UUID DEFAULT NULL,
  p_created_by_user_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  location_id UUID,
  patient_id UUID,
  patient_name TEXT,
  amount DECIMAL,
  original_amount DECIMAL,
  cleared_amount DECIMAL,
  balance_before DECIMAL,
  remaining_balance DECIMAL,
  payment_method VARCHAR,
  payment_status VARCHAR,
  treatment_ids UUID[],
  receipt_number VARCHAR,
  payment_date DATE,
  receipt_snapshot JSONB,
  created_by_user_id UUID,
  created_by_user_name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient patients%ROWTYPE;
  v_payment payments%ROWTYPE;
  v_method TEXT := UPPER(BTRIM(COALESCE(p_payment_method, '')));
  v_amount DECIMAL(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_balance_before DECIMAL(12,2);
  v_created_by_user_id UUID;
  v_submission_key TEXT := NULLIF(BTRIM(COALESCE(p_submission_key, '')), '');
  v_service_fee_amount DECIMAL(12,2) := ROUND(COALESCE(NULLIF(BTRIM(COALESCE(p_receipt_snapshot #>> '{payment,serviceFeeAmount}', '')), ''), '0')::NUMERIC, 2);
BEGIN
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than 0'; END IF;
  IF v_service_fee_amount < 0 THEN RAISE EXCEPTION 'Service fee amount cannot be negative'; END IF;
  IF v_method NOT IN ('KPAY', 'WAVEPAY', 'CASH', 'MMQR', 'DEBIT_CARD', 'CREDIT_CARD', 'AYA_PAY', 'UAB_PAY') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  SELECT *
  INTO v_patient
  FROM patients
  WHERE patients.id = p_patient_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patient not found'; END IF;

  IF v_submission_key IS NOT NULL THEN
    SELECT *
    INTO v_payment
    FROM payments
    WHERE payments.submission_key = v_submission_key;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        v_payment.id,
        v_payment.location_id,
        v_payment.patient_id,
        v_patient.name::TEXT,
        v_payment.amount,
        v_payment.original_amount,
        v_payment.cleared_amount,
        v_payment.balance_before,
        v_payment.remaining_balance,
        v_payment.payment_method,
        v_payment.payment_status,
        v_payment.treatment_ids,
        v_payment.receipt_number,
        v_payment.payment_date,
        v_payment.receipt_snapshot,
        v_payment.created_by_user_id,
        v_payment.created_by_user_name,
        v_payment.created_at;
      RETURN;
    END IF;
  END IF;

  IF (COALESCE(v_patient.balance, 0) + v_service_fee_amount) <= 0 THEN RAISE EXCEPTION 'Patient has no outstanding balance'; END IF;
  IF v_amount > (COALESCE(v_patient.balance, 0) + v_service_fee_amount) THEN
    RAISE EXCEPTION 'Payment amount cannot exceed the outstanding balance';
  END IF;

  v_balance_before := ROUND((COALESCE(v_patient.balance, 0) + v_service_fee_amount)::NUMERIC, 2);

  SELECT users.id
  INTO v_created_by_user_id
  FROM users
  WHERE users.id = p_created_by_user_id;

  UPDATE patients
  SET balance = ROUND((v_balance_before - v_amount)::NUMERIC, 2)
  WHERE patients.id = p_patient_id
  RETURNING * INTO v_patient;

  INSERT INTO payments (
    location_id, patient_id, amount, original_amount, cleared_amount, balance_before, remaining_balance,
    payment_method, payment_status, treatment_ids, payment_date, receipt_snapshot, submission_key,
    created_by_user_id, created_by_user_name
  ) VALUES (
    v_patient.location_id, v_patient.id, v_amount, v_amount, v_amount, v_balance_before, COALESCE(v_patient.balance, 0),
    v_method, CASE WHEN COALESCE(v_patient.balance, 0) = 0 THEN 'FULL' ELSE 'PARTIAL' END,
    COALESCE(p_treatment_ids, '{}'), COALESCE(p_payment_date, CURRENT_DATE), p_receipt_snapshot, v_submission_key,
    v_created_by_user_id, NULLIF(BTRIM(COALESCE(p_created_by_user_name, '')), '')
  )
  RETURNING * INTO v_payment;

  RETURN QUERY
  SELECT
    v_payment.id,
    v_payment.location_id,
    v_payment.patient_id,
    v_patient.name::TEXT,
    v_payment.amount,
    v_payment.original_amount,
    v_payment.cleared_amount,
    v_payment.balance_before,
    v_payment.remaining_balance,
    v_payment.payment_method,
    v_payment.payment_status,
    v_payment.treatment_ids,
    v_payment.receipt_number,
    v_payment.payment_date,
    v_payment.receipt_snapshot,
    v_payment.created_by_user_id,
    v_payment.created_by_user_name,
    v_payment.created_at;
END;
$$;

REVOKE ALL ON FUNCTION process_patient_payment(UUID, DECIMAL, TEXT, UUID[], DATE, JSONB, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_patient_payment(UUID, DECIMAL, TEXT, UUID[], DATE, JSONB, TEXT, UUID, TEXT) TO anon, authenticated;

COMMIT;
