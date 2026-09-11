import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(fileURLToPath(new URL('./20260911010000_harden_payment_bound_mls.sql', import.meta.url)), 'utf8');

describe('payment-bound MLS hardening migration', () => {
  it('marks only future payment inserts as payment-bound', () => {
    expect(migration).toContain('CREATE TRIGGER mark_new_payment_as_payment_bound_mls');
    expect(migration).toContain('AFTER INSERT ON public.payments');
    expect(migration).not.toMatch(/INSERT INTO public\.audit_logs[\s\S]*SELECT[\s\S]*FROM public\.payments/);
  });

  it('prevents payment corrections below saved MLS costs', () => {
    expect(migration).toContain('CREATE TRIGGER prevent_payment_below_mls_total');
    expect(migration).toContain('BEFORE UPDATE OF amount, cleared_amount ON public.payments');
    expect(migration).toContain('v_mls_total > v_collected_amount');
  });

  it('exposes pending recalculations only through an authenticated staff RPC', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.get_pending_mls_commission_recalculations');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.get_pending_mls_commission_recalculations');
    expect(migration).toContain('LIMIT 100');
  });
});
