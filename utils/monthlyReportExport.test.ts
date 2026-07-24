import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { MonthlyReport, MonthlyReportMetadata } from './monthlyReport';
import { buildMonthlyReportExcelWorkbook } from './monthlyReportExport';

const metadata: MonthlyReportMetadata = {
  dateFrom: '2026-07-01',
  dateTo: '2026-07-31',
  locationName: 'Yangon Main',
  currency: 'MMK',
  generatedAt: new Date('2026-08-01T09:30:00Z')
};

const report: MonthlyReport = {
  rows: [{
    treatmentId: 'treatment-1', date: '2026-07-10', patientId: 'patient-1', patientName: 'Aye Aye', age: 35,
    phone: '0912345', city: 'Yangon', patientType: 'Walk-in', treatment: 'Crown', doctor: 'Doctor One',
    cost: 100000, payment: 60000, balance: 40000, materialCost: 10000, labCost: 5000, doctorCost: 20000,
    totalCost: 35000, netProfit: 65000, netMargin: 0.65
  }],
  summary: {
    treatmentCount: 1, patientCount: 1, production: 100000, payment: 60000, balance: 40000,
    materialCost: 10000, labCost: 5000, doctorCost: 20000, totalCost: 35000, netProfit: 65000,
    netMargin: 0.65, collectionRate: 0.6
  },
  byTreatment: [{ name: 'Crown', treatments: 1, patients: 1, production: 100000, payment: 60000, totalCost: 35000, netProfit: 65000, netMargin: 0.65 }],
  byDoctor: [{ name: 'Doctor One', treatments: 1, patients: 1, production: 100000, payment: 60000, totalCost: 35000, netProfit: 65000, netMargin: 0.65 }],
  byPatientType: [{ name: 'Walk-in', treatments: 1, patients: 1, production: 100000, payment: 60000, totalCost: 35000, netProfit: 65000, netMargin: 0.65 }]
};

describe('monthly report Excel workbook', () => {
  it('builds a structured, readable workbook with professional report sections', async () => {
    const workbook = await buildMonthlyReportExcelWorkbook(report, metadata);

    expect(workbook.SheetNames).toEqual([
      'Executive Summary', 'Treatment Detail', 'By Treatment', 'By Clinician', 'By Patient Type'
    ]);

    const summary = workbook.Sheets['Executive Summary'];
    expect(summary.A1.v).toBe('MONTHLY TREATMENT & PROFITABILITY REPORT');
    expect(summary.A5.v).toBe('REPORT VOLUME');
    expect(summary.D5.v).toBe('REVENUE & COLLECTIONS');
    expect(summary.G5.v).toBe('COSTS & PROFITABILITY');
    expect(summary.E6.z).toBe('#,##0" Ks"');
    expect(summary.E9.z).toBe('0.0%');
    expect(summary.H11.z).toBe('0.0%');
    expect(summary['!merges']).toHaveLength(8);
    expect(summary['!freeze']).toMatchObject({ ySplit: 4, topLeftCell: 'A5' });

    const detail = workbook.Sheets['Treatment Detail'];
    expect(detail.A4.v).toBe('Treatment Date');
    expect(detail.B4.v).toBe('Patient Name');
    expect(detail.I4.v).toBe('Treatment Production');
    expect(detail.A6.v).toBe('REPORT TOTAL');
    expect(detail.I5.z).toBe('#,##0" Ks"');
    expect(detail.Q5.z).toBe('0.0%');
    expect(detail['!autofilter']).toEqual({ ref: 'A4:Q5' });
    expect(detail['!freeze']).toMatchObject({ ySplit: 4, topLeftCell: 'A5' });
    expect(detail['!cols'][6].wch).toBe(32);

    const clinician = workbook.Sheets['By Clinician'];
    expect(clinician.A1.v).toBe('CLINICIAN PERFORMANCE');
    expect(clinician.A4.v).toBe('Clinician');
    expect(clinician.A6.v).toBe('REPORT TOTAL');
  });

  it('preserves report labels and numeric formats in the written XLSX file', async () => {
    const workbook = await buildMonthlyReportExcelWorkbook(report, metadata);
    const file = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
    const reopened = XLSX.read(file, { type: 'buffer', cellNF: true });
    const detail = reopened.Sheets['Treatment Detail'];

    expect(detail.B5.v).toBe('Aye Aye');
    expect(detail.I5.v).toBe(100000);
    expect(detail.I5.z).toBe('#,##0" Ks"');
    expect(detail.Q5.v).toBe(0.65);
    expect(detail.Q5.z).toBe('0.0%');
    expect(detail.A6.v).toBe('REPORT TOTAL');
    expect(reopened.Props?.Title).toBe('Monthly Treatment & Profitability Report');
  });

  it('keeps empty reporting periods structured and filterable', async () => {
    const emptyReport: MonthlyReport = {
      rows: [],
      summary: {
        treatmentCount: 0, patientCount: 0, production: 0, payment: 0, balance: 0, materialCost: 0,
        labCost: 0, doctorCost: 0, totalCost: 0, netProfit: 0, netMargin: 0, collectionRate: 0
      },
      byTreatment: [],
      byDoctor: [],
      byPatientType: []
    };
    const workbook = await buildMonthlyReportExcelWorkbook(emptyReport, metadata);
    const detail = workbook.Sheets['Treatment Detail'];

    expect(detail.A4.v).toBe('Treatment Date');
    expect(detail.A5.v).toBe('REPORT TOTAL');
    expect(detail.I5.v).toBe(0);
    expect(detail.I5.z).toBe('#,##0" Ks"');
    expect(detail['!autofilter']).toEqual({ ref: 'A4:Q4' });
  });
});