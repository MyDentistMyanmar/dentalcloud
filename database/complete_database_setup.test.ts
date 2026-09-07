import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const setup = readFileSync(fileURLToPath(new URL('./complete_database_setup.sql', import.meta.url)), 'utf8');

describe('complete database setup', () => {
  it('includes every current non-manual Supabase migration for fresh clinics', () => {
    [
      '20260803000000_add_doctor_commission_type.sql',
      '20260804033408_validate_reconciled_payment_allocations.sql',
      '20260804044527_enforce_two_way_reconciled_treatment_links.sql',
      '20260805000000_add_appointment_list_index.sql',
      '20260806042759_optimize_audit_log_queries.sql',
      '20260806213848_atomic_treatment_sales_patient_delete.sql',
      '20260807044648_undo_treatment_atomic.sql',
      '20260808000000_add_medicine_sale_discounts.sql',
      '20260808100000_undo_medicine_sale_atomic.sql',
      '20260809000000_visit_doctor_correction.sql'
    ].forEach((migration) => {
      expect(setup).toContain(`BEGIN CONSOLIDATED: supabase\\migrations\\${migration}`);
    });
  });

  it('does not include one-time historical repair scripts', () => {
    expect(setup).not.toContain('manual_20260802_01_recalculate_historical_percentage_commissions_by_visit.sql');
    expect(setup).not.toContain('manual_20260802_02_correct_historical_percentage_commissions_by_visit_group.sql');
  });
});
