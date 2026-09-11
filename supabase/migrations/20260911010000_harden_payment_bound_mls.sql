-- Harden the payment-bound MLS rollout without reclassifying historical payments.
-- Payments inserted after this migration receive an explicit zero-MLS audit marker.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('public.payments') IS NULL
     OR to_regclass('public.audit_logs') IS NULL
     OR to_regclass('public.patient_material_costs') IS NULL
     OR to_regclass('public.pending_commission_recalculations') IS NULL
     OR to_regprocedure('public.replace_payment_costs(uuid,jsonb,uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Payment-bound MLS migration must be installed before its hardening migration.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_new_payment_as_payment_bound_mls()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    source_type, source_id, location_id, patient_id, payment_id
  ) VALUES (
    'payment', NEW.id, NEW.location_id, NEW.patient_id, NEW.id
  )
  ON CONFLICT (source_type, source_id) DO UPDATE
  SET location_id = EXCLUDED.location_id,
      patient_id = EXCLUDED.patient_id,
      payment_id = EXCLUDED.payment_id,
      doctor_id = NULL,
      treatment_id = NULL,
      updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_new_payment_as_payment_bound_mls ON public.payments;
CREATE TRIGGER mark_new_payment_as_payment_bound_mls
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.mark_new_payment_as_payment_bound_mls();

CREATE OR REPLACE FUNCTION public.prevent_payment_below_mls_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mls_total NUMERIC(12,2);
  v_collected_amount NUMERIC(12,2);
BEGIN
  v_collected_amount := round(COALESCE(NEW.cleared_amount, NEW.amount, 0)::NUMERIC, 2);
  SELECT COALESCE(round(SUM(cost.total_amount), 2), 0)
  INTO v_mls_total
  FROM public.audit_logs audit
  JOIN public.patient_material_costs cost ON cost.audit_log_id = audit.id
  WHERE audit.source_type = 'payment'
    AND audit.source_id = NEW.id;

  IF v_mls_total > v_collected_amount THEN
    RAISE EXCEPTION 'Corrected payment amount (%) cannot be less than its MLS costs (%)',
      v_collected_amount, v_mls_total;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_payment_below_mls_total ON public.payments;
CREATE TRIGGER prevent_payment_below_mls_total
BEFORE UPDATE OF amount, cleared_amount ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_payment_below_mls_total();

CREATE OR REPLACE FUNCTION public.get_pending_mls_commission_recalculations(
  p_user_id UUID,
  p_session_token TEXT
)
RETURNS TABLE(patient_id UUID, request_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.staff_auth_sessions session ON session.user_id = u.id
    WHERE u.id = p_user_id
      AND session.session_token::TEXT = btrim(COALESCE(p_session_token, ''))
      AND session.revoked_at IS NULL
      AND session.expires_at > NOW()
      AND (
        u.role = 'admin'
        OR (
          u.role = 'normal'
          AND u.doctor_id IS NULL
          AND jsonb_typeof(u.allowed_tabs) = 'array'
          AND u.allowed_tabs ? 'material-cost'
        )
      )
  ) THEN
    RAISE EXCEPTION 'A valid staff session with Treatment Costs permission is required.';
  END IF;

  RETURN QUERY
  SELECT pending.patient_id, pending.request_token
  FROM public.pending_commission_recalculations pending
  JOIN public.patients patient ON patient.id = pending.patient_id
  JOIN public.users actor ON actor.id = p_user_id
  WHERE actor.role = 'admin'
     OR actor.location_id IS NULL
     OR actor.location_id = patient.location_id
  ORDER BY pending.requested_at
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_new_payment_as_payment_bound_mls() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_payment_below_mls_total() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pending_mls_commission_recalculations(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_mls_commission_recalculations(UUID, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
