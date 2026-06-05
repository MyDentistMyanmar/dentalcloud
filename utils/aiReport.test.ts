import { describe, expect, it } from 'vitest';
import { ClinicalRecord, Expense, Medicine, MedicineSale, PaymentRecord } from '../types';
import { buildFinancialReport } from './aiReport';

describe('buildFinancialReport', () => {
  it('includes treatments, medicine sales, and collected payments in revenue calculations', () => {
    const treatments: ClinicalRecord[] = [
      {
        id: 'tr_today',
        location_id: 'loc_1',
        patient_id: 'patient_1',
        patient_name: 'Patient One',
        teeth: [18],
        description: 'Filling',
        cost: 1000,
        date: '2026-06-05'
      },
      {
        id: 'tr_week',
        location_id: 'loc_1',
        patient_id: 'patient_2',
        patient_name: 'Patient Two',
        doctor_name: 'Dr. Mya',
        teeth: [21],
        description: 'Scaling',
        cost: 2000,
        date: '2026-06-01'
      },
      {
        id: 'tr_previous_month',
        location_id: 'loc_1',
        patient_id: 'patient_3',
        patient_name: 'Patient Three',
        teeth: [11],
        description: 'Extraction',
        cost: 9999,
        date: '2026-05-20'
      }
    ];

    const expenses: Expense[] = [
      {
        id: 'exp_today',
        location_id: 'loc_1',
        description: 'Supplies',
        amount: 300,
        category: 'Supplies',
        date: '2026-06-05'
      },
      {
        id: 'exp_week',
        location_id: 'loc_1',
        description: 'Utilities',
        amount: 700,
        category: 'Utilities',
        date: '2026-06-02'
      },
      {
        id: 'exp_previous_month',
        location_id: 'loc_1',
        description: 'Old expense',
        amount: 5000,
        category: 'Other',
        date: '2026-05-15'
      }
    ];

    const medicines: Medicine[] = [
      {
        id: 'med_1',
        location_id: 'loc_1',
        name: 'Amoxicillin',
        unit: 'card',
        price: 100,
        stock: 5,
        min_stock: 10
      },
      {
        id: 'med_2',
        location_id: 'loc_1',
        name: 'Ibuprofen',
        unit: 'box',
        price: 250,
        stock: 0,
        min_stock: 5
      }
    ];

    const medicineSales: MedicineSale[] = [
      {
        id: 'sale_today',
        location_id: 'loc_1',
        patient_id: 'patient_1',
        medicine_id: 'med_1',
        quantity: 2,
        unit_price: 500,
        total_price: 1000,
        date: '2026-06-05'
      },
      {
        id: 'sale_week',
        location_id: 'loc_1',
        patient_id: 'patient_2',
        medicine_id: 'med_2',
        quantity: 1,
        unit_price: 1500,
        total_price: 1500,
        date: '2026-06-03'
      }
    ];

    const payments: PaymentRecord[] = [
      {
        id: 'pay_today',
        location_id: 'loc_1',
        patientId: 'patient_1',
        amount: 500,
        date: '2026-06-05',
        type: 'PARTIAL',
        remainingBalance: 500
      },
      {
        id: 'pay_week',
        location_id: 'loc_1',
        patientId: 'patient_2',
        amount: 800,
        date: '2026-06-04',
        type: 'FULL',
        remainingBalance: 0
      }
    ];

    const report = buildFinancialReport(
      treatments,
      expenses,
      medicines,
      'MMK',
      '2026-06-05',
      medicineSales,
      payments
    );

    expect(report.revenueDaily).toBe(2500);
    expect(report.revenueWeekly).toBe(6800);
    expect(report.revenueMonthly).toBe(6800);
    expect(report.expenseDaily).toBe(300);
    expect(report.expenseWeekly).toBe(1000);
    expect(report.expenseMonthly).toBe(1000);
    expect(report.profitMonthly).toBe(5800);
    expect(report.inventoryValue).toBe(500);
    expect(report.lowStockCount).toBe(2);
    expect(report.outOfStockCount).toBe(1);
    expect(report.topDoctors30d).toEqual([
      { name: 'Unassigned Doctor', treatments: 2 },
      { name: 'Dr. Mya', treatments: 1 }
    ]);
  });
});