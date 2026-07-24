import { describe, expect, it } from 'vitest';
import type { PaymentRecord, TreatmentCostSummary } from '../types';
import { buildMonthlyReport, monthlyReportFilename, type MonthlyReportSourceRecord } from './monthlyReport';

const record = (overrides: Partial<MonthlyReportSourceRecord> = {}): MonthlyReportSourceRecord => ({
  id: 'treatment-1', location_id: 'location-1', patient_id: 'patient-1', patient_name: 'Aye Aye',
  patient_age: 35, patient_phone: '0912345', patient_city: 'Yangon', patient_type: 'Walk-in',
  doctor_name: 'Doctor One', teeth: [], description: 'Crown', cost: 100, doctorEarnings: 20, date: '2026-07-10',
  ...overrides
});

const payment = (overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: 'payment-1', patientId: 'patient-1', amount: 60, clearedAmount: 60, treatmentIds: ['treatment-1'],
  date: '2026-07-10', type: 'PARTIAL', remainingBalance: 40, ...overrides
});

const costs = (overrides: Partial<TreatmentCostSummary> = {}): TreatmentCostSummary => ({
  auditLogId: 'audit-1', materialTotal: 10, materialItemCount: 1, labTotal: 5, labItemCount: 1,
  totalAmount: 15, itemCount: 2, ...overrides
});

describe('monthly report', () => {
  it('calculates payment, treatment balance, total cost, and production-based net profit', () => {
    const report = buildMonthlyReport({ records: [record()], payments: [payment()], costSummaries: { 'treatment-1': costs() } });
    expect(report.rows[0]).toMatchObject({ cost: 100, payment: 60, balance: 40, materialCost: 10, labCost: 5, doctorCost: 20, totalCost: 35, netProfit: 65, netMargin: 0.65 });
    expect(report.summary).toMatchObject({ treatmentCount: 1, patientCount: 1, production: 100, payment: 60, balance: 40, totalCost: 35, netProfit: 65, collectionRate: 0.6 });
  });

  it('allocates a shared payment proportionally and never overpays a treatment', () => {
    const report = buildMonthlyReport({
      records: [record(), record({ id: 'treatment-2', cost: 300, description: 'Implant' })],
      payments: [payment({ amount: 200, clearedAmount: 200, treatmentIds: ['treatment-1', 'treatment-2'] })],
      costSummaries: {}
    });
    expect(report.rows.map(row => row.payment)).toEqual([50, 150]);
    expect(report.summary.balance).toBe(200);
  });

  it('deduplicates repeated payments and supports legacy oldest-balance allocation', () => {
    const shared = payment({ treatmentIds: [], date: '2026-07-12' });
    const report = buildMonthlyReport({ records: [record()], payments: [shared, { ...shared }], costSummaries: {} });
    expect(report.rows[0].payment).toBe(60);
  });

  it('reports losses and normalizes missing demographic data', () => {
    const report = buildMonthlyReport({
      records: [record({ patient_age: null, patient_phone: '', patient_city: '', patient_type: null, doctor_name: '', doctorEarnings: 120 })],
      payments: [], costSummaries: {},
    });
    expect(report.rows[0]).toMatchObject({ age: null, phone: 'Not recorded', city: 'Not recorded', patientType: 'Not assigned', doctor: 'Unassigned', netProfit: -20 });
  });

  it('uses the report-scoped doctor earning supplied by the loader', () => {
    const report = buildMonthlyReport({ records: [record({ doctorEarnings: 12.5 })], payments: [], costSummaries: {} });
    expect(report.rows[0]).toMatchObject({ doctorCost: 12.5, totalCost: 12.5, netProfit: 87.5 });
  });

  it('builds ranked analysis groups and safe filenames', () => {
    const report = buildMonthlyReport({ records: [record(), record({ id: 'treatment-2', patient_id: 'patient-2', cost: 200 })], payments: [], costSummaries: {} });
    expect(report.byTreatment[0]).toMatchObject({ name: 'Crown', treatments: 2, patients: 2, production: 300 });
    expect(monthlyReportFilename({ dateFrom: '2026-07-01', dateTo: '2026-07-31', locationName: 'Yangon / Main', currency: 'MMK' }, 'xlsx'))
      .toBe('monthly-report-2026-07-01-to-2026-07-31-yangon-main.xlsx');
  });
});