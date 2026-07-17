import { describe, expect, it } from 'vitest';
import type { Appointment, ClinicalRecord, MedicineSale, Patient, PaymentRecord } from '../types';
import { buildPatientReport } from './patientReport';

const patient: Patient = {
  id: 'patient-1', location_id: 'location-1', name: 'Mya Mya', email: '', phone: '091234', balance: 250, loyalty_points: 0
};
const appointment = (overrides: Partial<Appointment>): Appointment => ({
  id: 'appointment-1', location_id: 'location-1', patient_id: patient.id, date: '2026-07-10', time: '09:00',
  type: 'Checkup', status: 'Completed', doctor_id: 'doctor-1', doctor_name: 'Aung', ...overrides
});
const treatment = (overrides: Partial<ClinicalRecord>): ClinicalRecord => ({
  id: 'treatment-1', location_id: 'location-1', patient_id: patient.id, doctor_id: 'doctor-1', doctor_name: 'Aung',
  treatment_type_id: null, teeth: [11], description: 'Filling', cost: 1000, date: '2026-07-10', ...overrides
});
const medicine = (overrides: Partial<MedicineSale>): MedicineSale => ({
  id: 'medicine-sale-1', location_id: 'location-1', patient_id: patient.id, medicine_id: 'medicine-1',
  medicine_name: 'Amoxicillin', medicine_unit: 'capsules', quantity: 2, unit_price: 100, total_price: 200,
  date: '2026-07-11', ...overrides
});
const payment = (overrides: Partial<PaymentRecord>): PaymentRecord => ({
  id: 'payment-1', location_id: 'location-1', patientId: patient.id, amount: 500, date: '2026-07-11',
  type: 'PARTIAL', remainingBalance: 700, ...overrides
});

describe('buildPatientReport', () => {
  it('counts unique care dates as visits and excludes scheduled or cancelled-only dates', () => {
    const report = buildPatientReport({
      patient,
      appointments: [
        appointment({ id: 'complete', date: '2026-07-10' }),
        appointment({ id: 'scheduled', date: '2026-07-20', status: 'Scheduled' }),
        appointment({ id: 'cancelled', date: '2026-07-21', status: 'Cancelled' })
      ],
      treatments: [treatment({ date: '2026-07-10' })],
      medicineSales: [medicine({ date: '2026-07-11' })],
      payments: [], doctors: [], currency: 'USD'
    });

    expect(report.visitDates).toEqual(['2026-07-11', '2026-07-10']);
    expect(report.firstVisitDate).toBe('2026-07-10');
    expect(report.lastVisitDate).toBe('2026-07-11');
    expect(report.appointmentStatus).toEqual([
      { name: 'Completed', value: 1 }, { name: 'Scheduled', value: 1 }, { name: 'Cancelled', value: 1 }
    ]);
  });

  it('separates paid money, care value, applied service fees, and current debt', () => {
    const report = buildPatientReport({
      patient,
      appointments: [appointment({ clinical_fee_status: 'APPLIED', clinical_fee_amount: 50 })],
      treatments: [treatment({ cost: 1000 })], medicineSales: [medicine({ total_price: 200 })],
      payments: [payment({ amount: 500 }), payment({ id: 'payment-2', amount: 300 })], doctors: [], currency: 'USD'
    });

    expect(report.totalPaid).toBe(800);
    expect(report.treatmentValue).toBe(1000);
    expect(report.medicineValue).toBe(200);
    expect(report.serviceFeeValue).toBe(50);
    expect(report.careValue).toBe(1250);
    expect(report.currentDebt).toBe(250);
  });

  it('does not present restricted payment history as zero', () => {
    const report = buildPatientReport({
      patient, appointments: [], treatments: [], medicineSales: [], payments: [], doctors: [], currency: 'MMK', paymentsAvailable: false
    });
    expect(report.totalPaid).toBeNull();
  });

  it('filters other patients and aggregates repeated treatments, medicines, and doctor activity', () => {
    const report = buildPatientReport({
      patient,
      appointments: [appointment({}), appointment({ id: 'other-appointment', patient_id: 'patient-2' })],
      treatments: [treatment({}), treatment({ id: 'treatment-2', description: 'filling', date: '2026-07-12', cost: 500 })],
      medicineSales: [medicine({}), medicine({ id: 'sale-2', quantity: 1, total_price: 100, date: '2026-07-12' })],
      payments: [payment({}), payment({ id: 'other-payment', patientId: 'patient-2', amount: 999 })],
      doctors: [], currency: 'USD'
    });

    expect(report.treatments).toEqual([{ name: 'Filling', count: 2, total: 1500, dates: ['2026-07-12', '2026-07-10'] }]);
    expect(report.medicines).toEqual([{ id: 'medicine-1', name: 'Amoxicillin', unit: 'capsules', quantity: 3, total: 300, dates: ['2026-07-12', '2026-07-11'] }]);
    expect(report.doctors[0]).toMatchObject({ name: 'Aung', appointmentCount: 1, treatmentCount: 2 });
    expect(report.totalPaid).toBe(500);
    expect(report.timeline).toHaveLength(5);
  });
});