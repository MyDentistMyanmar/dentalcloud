import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260911000000_payment_bound_mls.sql', import.meta.url),
  'utf8'
);

describe('payment-bound MLS migration', () => {
  it('binds costs to payments and keeps payment creation plus MLS atomic', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS payment_id UUID');
    expect(migration).toContain('REFERENCES public.payments(id) ON DELETE CASCADE');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.replace_payment_costs');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.process_patient_payment_with_mls');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.process_patient_split_payment_with_mls');
    expect(migration).toContain("'payment', v_payment.id");
    expect(migration).toContain('v_payment.payment_date');
  });

  it('validates staff access, cost values, and public execution grants', () => {
    expect(migration).toContain('staff_auth_sessions');
    expect(migration).toContain("item.cost_type NOT IN ('material', 'lab', 'special_doctor')");
    expect(migration).toContain('v_total > COALESCE(v_payment.cleared_amount, v_payment.amount)');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.replace_payment_costs');
  });
});
