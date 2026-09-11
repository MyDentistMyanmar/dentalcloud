import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const setup = readFileSync(fileURLToPath(new URL('./complete_database_setup.sql', import.meta.url)), 'utf8');

describe('complete database setup', () => {
  it('includes the current consolidated production schema for fresh clinics', () => {
    [
      'CREATE TABLE doctor_commission_entries',
      'CREATE TABLE audit_logs',
      'CREATE TABLE patient_material_costs',
      'commission_type_snapshot',
      'treatment_ids UUID[]',
      'BEGIN CONSOLIDATED: supabase\\migrations\\20260905000004_add_special_doctor_treatment_costs.sql',
      'BEGIN CONSOLIDATED: supabase\\migrations\\20260911000000_payment_bound_mls.sql',
      'BEGIN CONSOLIDATED: supabase\\migrations\\20260911010000_harden_payment_bound_mls.sql',
      'CREATE OR REPLACE FUNCTION public.replace_payment_costs',
      'CREATE TRIGGER mark_new_payment_as_payment_bound_mls',
      'CREATE TRIGGER prevent_payment_below_mls_total',
      'CREATE OR REPLACE FUNCTION public.get_pending_mls_commission_recalculations'
    ].forEach((schemaFeature) => {
      expect(setup).toContain(schemaFeature);
    });
  });

  it('does not include one-time historical repair scripts', () => {
    expect(setup).not.toContain('manual_20260802_01_recalculate_historical_percentage_commissions_by_visit.sql');
    expect(setup).not.toContain('manual_20260802_02_correct_historical_percentage_commissions_by_visit_group.sql');
  });
});
