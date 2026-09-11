-- Run after both payment-bound MLS migrations:
-- 20260911000000_payment_bound_mls.sql
-- 20260911010000_harden_payment_bound_mls.sql
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patient_material_costs'
      AND column_name = 'payment_id'
  ) AS has_payment_cost_link,
  to_regprocedure('public.replace_payment_costs(uuid,jsonb,uuid,text,uuid)') IS NOT NULL
    AS has_replace_payment_costs,
  to_regprocedure('public.process_patient_payment_with_mls(uuid,numeric,text,uuid[],date,jsonb,text,uuid,text,jsonb,text,uuid)') IS NOT NULL
    AS has_atomic_single_payment_mls,
  to_regprocedure('public.process_patient_split_payment_with_mls(uuid,numeric,jsonb,uuid[],date,jsonb,text,uuid,text,jsonb,text,uuid)') IS NOT NULL
    AS has_atomic_split_payment_mls,
  to_regprocedure('public.get_pending_mls_commission_recalculations(uuid,text)') IS NOT NULL
    AS has_pending_recovery_rpc;

-- Must return the parent guard plus both payment hardening triggers.
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'enforce_patient_material_cost_parent',
    'mark_new_payment_as_payment_bound_mls',
    'prevent_payment_below_mls_total'
  )
ORDER BY trigger_name, event_manipulation;

-- Must return zero rows: direct payment_id and audit parent must agree.
SELECT costs.id, costs.payment_id, audit.source_id AS audit_payment_id
FROM public.patient_material_costs costs
JOIN public.audit_logs audit ON audit.id = costs.audit_log_id
WHERE audit.source_type = 'payment'
  AND costs.payment_id IS DISTINCT FROM audit.source_id;

-- Must return zero rows: payment MLS cannot exceed its collected amount.
SELECT payment.id, payment.payment_date,
  COALESCE(SUM(costs.total_amount), 0) AS mls_total,
  COALESCE(payment.cleared_amount, payment.amount) AS collected_amount
FROM public.payments payment
JOIN public.audit_logs audit
  ON audit.source_type = 'payment' AND audit.source_id = payment.id
LEFT JOIN public.patient_material_costs costs ON costs.audit_log_id = audit.id
GROUP BY payment.id, payment.payment_date, payment.cleared_amount, payment.amount
HAVING COALESCE(SUM(costs.total_amount), 0) > COALESCE(payment.cleared_amount, payment.amount);

-- Verify dashboard index and payment-date ledger values are present.
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'doctor_commission_entries'
  AND indexdef ILIKE '%doctor_id%payment_date%';
