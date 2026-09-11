-- Move new MLS writes from treatments to individual payment transactions.
-- Legacy treatment audit rows remain readable and are intentionally not guessed
-- onto historical partial payments.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('public.payments') IS NULL
     OR to_regclass('public.audit_logs') IS NULL
     OR to_regclass('public.patient_material_costs') IS NULL
     OR to_regclass('public.expenses') IS NULL
     OR to_regclass('public.pending_commission_recalculations') IS NULL THEN
    RAISE EXCEPTION 'Payment-bound MLS prerequisites are missing; transaction was not applied.';
  END IF;
END;
$$;

ALTER TABLE public.patient_material_costs
  ADD COLUMN IF NOT EXISTS payment_id UUID;

ALTER TABLE public.patient_material_costs
  DROP CONSTRAINT IF EXISTS patient_material_costs_payment_id_fkey;
ALTER TABLE public.patient_material_costs
  ADD CONSTRAINT patient_material_costs_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.patient_material_costs
  VALIDATE CONSTRAINT patient_material_costs_payment_id_fkey;

CREATE INDEX IF NOT EXISTS idx_patient_material_costs_payment_type
  ON public.patient_material_costs (payment_id, cost_type)
  WHERE payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_patient_material_cost_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_source_type TEXT;
  v_source_id UUID;
BEGIN
  SELECT source_type, source_id
  INTO v_source_type, v_source_id
  FROM public.audit_logs
  WHERE id = NEW.audit_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MLS audit parent was not found.';
  END IF;

  IF v_source_type = 'payment' THEN
    IF NEW.payment_id IS NULL OR NEW.payment_id <> v_source_id THEN
      RAISE EXCEPTION 'Payment MLS cost must reference its payment audit parent.';
    END IF;
  ELSIF NEW.payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only payment MLS audit rows may contain payment_id.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_patient_material_cost_parent
  ON public.patient_material_costs;
CREATE TRIGGER enforce_patient_material_cost_parent
BEFORE INSERT OR UPDATE OF audit_log_id, payment_id
ON public.patient_material_costs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_patient_material_cost_parent();

CREATE OR REPLACE FUNCTION public.replace_payment_costs(
  p_payment_id UUID,
  p_items JSONB,
  p_user_id UUID,
  p_session_token TEXT,
  p_request_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_audit_log_id UUID;
  v_actor_username TEXT;
  v_total NUMERIC(12,2);
  v_material_total NUMERIC(12,2);
  v_lab_total NUMERIC(12,2);
  v_special_doctor_total NUMERIC(12,2);
  v_material_names TEXT;
  v_lab_names TEXT;
  v_special_doctor_names TEXT;
  v_patient_name TEXT;
  v_treatment_label TEXT;
  v_items JSONB;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment was not found.'; END IF;

  SELECT u.username INTO v_actor_username
  FROM public.users u
  JOIN public.staff_auth_sessions s ON s.user_id = u.id
  WHERE u.id = p_user_id
    AND s.session_token::TEXT = btrim(COALESCE(p_session_token, ''))
    AND s.revoked_at IS NULL
    AND s.expires_at > NOW()
    AND (
      u.role = 'admin'
      OR (
        u.role = 'normal'
        AND u.doctor_id IS NULL
        AND jsonb_typeof(u.allowed_tabs) = 'array'
        AND u.allowed_tabs ? 'material-cost'
        AND (u.location_id IS NULL OR u.location_id = v_payment.location_id)
      )
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A valid staff session with Treatment Costs permission is required.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Cost items must be a JSON array.';
  END IF;
  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'A maximum of 100 MLS cost items is allowed.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) raw(item)
    WHERE jsonb_typeof(raw.item) <> 'object'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items)
      item(material_name TEXT, cost_type TEXT, cost_amount NUMERIC, quantity NUMERIC)
    WHERE btrim(COALESCE(item.material_name, '')) = ''
      OR char_length(btrim(item.material_name)) > 255
      OR item.cost_type NOT IN ('material', 'lab', 'special_doctor')
      OR item.cost_amount IS NULL OR item.cost_amount <= 0
      OR item.quantity IS NULL OR item.quantity <= 0
  ) THEN
    RAISE EXCEPTION 'Every MLS item requires a valid name, type, positive cost, and positive quantity.';
  END IF;

  SELECT COALESCE(round(SUM(item.cost_amount * item.quantity), 2), 0)
  INTO v_total
  FROM jsonb_to_recordset(p_items)
    item(material_name TEXT, cost_type TEXT, cost_amount NUMERIC, quantity NUMERIC);

  IF v_total > COALESCE(v_payment.cleared_amount, v_payment.amount) THEN
    RAISE EXCEPTION 'Payment MLS costs cannot exceed the amount collected in this payment.';
  END IF;

  INSERT INTO public.audit_logs (
    source_type, source_id, location_id, patient_id, payment_id
  ) VALUES (
    'payment', v_payment.id, v_payment.location_id, v_payment.patient_id, v_payment.id
  )
  ON CONFLICT (source_type, source_id) DO UPDATE
  SET location_id = EXCLUDED.location_id,
      patient_id = EXCLUDED.patient_id,
      payment_id = EXCLUDED.payment_id,
      doctor_id = NULL,
      treatment_id = NULL,
      updated_at = NOW()
  RETURNING id INTO v_audit_log_id;

  DELETE FROM public.patient_material_costs
  WHERE audit_log_id = v_audit_log_id;

  INSERT INTO public.patient_material_costs (
    audit_log_id, payment_id, material_name, cost_type, cost_amount,
    quantity, created_by, created_by_name
  )
  SELECT v_audit_log_id, v_payment.id, btrim(item.material_name),
    item.cost_type, round(item.cost_amount, 2), item.quantity,
    p_user_id, v_actor_username
  FROM jsonb_to_recordset(p_items)
    item(material_name TEXT, cost_type TEXT, cost_amount NUMERIC, quantity NUMERIC);

  SELECT
    COALESCE(SUM(total_amount) FILTER (WHERE cost_type = 'material'), 0),
    COALESCE(SUM(total_amount) FILTER (WHERE cost_type = 'lab'), 0),
    COALESCE(SUM(total_amount) FILTER (WHERE cost_type = 'special_doctor'), 0),
    COALESCE(string_agg(material_name, ', ' ORDER BY created_at) FILTER (WHERE cost_type = 'material'), ''),
    COALESCE(string_agg(material_name, ', ' ORDER BY created_at) FILTER (WHERE cost_type = 'lab'), ''),
    COALESCE(string_agg(material_name, ', ' ORDER BY created_at) FILTER (WHERE cost_type = 'special_doctor'), '')
  INTO v_material_total, v_lab_total, v_special_doctor_total,
    v_material_names, v_lab_names, v_special_doctor_names
  FROM public.patient_material_costs
  WHERE audit_log_id = v_audit_log_id;

  SELECT COALESCE(name, 'Unknown patient') INTO v_patient_name
  FROM public.patients WHERE id = v_payment.patient_id;

  SELECT COALESCE(string_agg(description, ' + ' ORDER BY date, id), 'Payment')
  INTO v_treatment_label
  FROM public.treatments
  WHERE id = ANY(COALESCE(v_payment.treatment_ids, '{}'::UUID[]));

  DELETE FROM public.expenses
  WHERE source_id = v_audit_log_id
    AND source_type IN ('material_cost', 'lab_cost', 'special_doctor_cost');

  IF v_material_total > 0 THEN
    INSERT INTO public.expenses (location_id, description, amount, category, date, source_type, source_id, is_system_generated)
    VALUES (v_payment.location_id, 'Material cost - ' || v_patient_name || ' - ' || v_treatment_label || CASE WHEN v_material_names <> '' THEN ' (' || v_material_names || ')' ELSE '' END, v_material_total, 'Material Cost', v_payment.payment_date, 'material_cost', v_audit_log_id, true);
  END IF;
  IF v_lab_total > 0 THEN
    INSERT INTO public.expenses (location_id, description, amount, category, date, source_type, source_id, is_system_generated)
    VALUES (v_payment.location_id, 'Lab cost - ' || v_patient_name || ' - ' || v_treatment_label || CASE WHEN v_lab_names <> '' THEN ' (' || v_lab_names || ')' ELSE '' END, v_lab_total, 'Lab Cost', v_payment.payment_date, 'lab_cost', v_audit_log_id, true);
  END IF;
  IF v_special_doctor_total > 0 THEN
    INSERT INTO public.expenses (location_id, description, amount, category, date, source_type, source_id, is_system_generated)
    VALUES (v_payment.location_id, 'Special doctor cost - ' || v_patient_name || ' - ' || v_treatment_label || CASE WHEN v_special_doctor_names <> '' THEN ' (' || v_special_doctor_names || ')' ELSE '' END, v_special_doctor_total, 'Special Doctor Cost', v_payment.payment_date, 'special_doctor_cost', v_audit_log_id, true);
  END IF;

  INSERT INTO public.pending_commission_recalculations (patient_id, request_token, requested_at)
  VALUES (v_payment.patient_id, p_request_token, NOW())
  ON CONFLICT (patient_id) DO UPDATE
  SET request_token = EXCLUDED.request_token, requested_at = EXCLUDED.requested_at;

  SELECT COALESCE(jsonb_agg(to_jsonb(costs) ORDER BY costs.created_at, costs.id), '[]'::JSONB)
  INTO v_items
  FROM public.patient_material_costs costs
  WHERE costs.audit_log_id = v_audit_log_id;

  RETURN jsonb_build_object(
    'audit_log_id', v_audit_log_id,
    'payment_id', v_payment.id,
    'material_total', v_material_total,
    'lab_total', v_lab_total,
    'special_doctor_total', v_special_doctor_total,
    'total_amount', v_material_total + v_lab_total + v_special_doctor_total,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_payment_costs(UUID, JSONB, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_payment_costs(UUID, JSONB, UUID, TEXT, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_patient_payment_with_mls(
  p_patient_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_treatment_ids UUID[],
  p_payment_date DATE,
  p_receipt_snapshot JSONB,
  p_submission_key TEXT,
  p_created_by_user_id UUID,
  p_created_by_user_name TEXT,
  p_mls_items JSONB,
  p_session_token TEXT,
  p_request_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT to_jsonb(result) INTO v_result
  FROM public.process_patient_payment(
    p_patient_id, p_amount, p_payment_method, p_treatment_ids,
    p_payment_date, p_receipt_snapshot, p_submission_key,
    p_created_by_user_id, p_created_by_user_name
  ) result
  LIMIT 1;

  IF v_result IS NULL THEN RAISE EXCEPTION 'Payment was not recorded.'; END IF;
  PERFORM public.replace_payment_costs(
    (v_result->>'id')::UUID, p_mls_items, p_created_by_user_id,
    p_session_token, p_request_token
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.process_patient_payment_with_mls(UUID, NUMERIC, TEXT, UUID[], DATE, JSONB, TEXT, UUID, TEXT, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_patient_payment_with_mls(UUID, NUMERIC, TEXT, UUID[], DATE, JSONB, TEXT, UUID, TEXT, JSONB, TEXT, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_patient_split_payment_with_mls(
  p_patient_id UUID,
  p_amount NUMERIC,
  p_allocations JSONB,
  p_treatment_ids UUID[],
  p_payment_date DATE,
  p_receipt_snapshot JSONB,
  p_submission_key TEXT,
  p_created_by_user_id UUID,
  p_created_by_user_name TEXT,
  p_mls_items JSONB,
  p_session_token TEXT,
  p_request_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT to_jsonb(result) INTO v_result
  FROM public.process_patient_split_payment(
    p_patient_id, p_amount, p_allocations, p_treatment_ids,
    p_payment_date, p_receipt_snapshot, p_submission_key,
    p_created_by_user_id, p_created_by_user_name
  ) result
  LIMIT 1;

  IF v_result IS NULL THEN RAISE EXCEPTION 'Payment was not recorded.'; END IF;
  PERFORM public.replace_payment_costs(
    (v_result->>'id')::UUID, p_mls_items, p_created_by_user_id,
    p_session_token, p_request_token
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.process_patient_split_payment_with_mls(UUID, NUMERIC, JSONB, UUID[], DATE, JSONB, TEXT, UUID, TEXT, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_patient_split_payment_with_mls(UUID, NUMERIC, JSONB, UUID[], DATE, JSONB, TEXT, UUID, TEXT, JSONB, TEXT, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
