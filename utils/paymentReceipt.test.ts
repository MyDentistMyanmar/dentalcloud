import { describe, expect, it } from 'vitest';
import type { Patient, PaymentRecord } from '../types';
import {
  buildLegacyPaymentReceiptSnapshot,
  buildPaymentReceiptSnapshot,
  normalizePaymentReceiptSnapshot
} from './paymentReceipt';

describe('paymentReceipt', () => {
  const clinic = {
    appName: 'My Dentist',
    receiptHeaderTitle: 'Official Payment Receipt',
    receiptInfo: {
      email: 'clinic@example.com',
      phone: '09-123456789'
    },
    currency: 'MMK' as const
  };

  it('builds an immutable payment receipt snapshot from payment facts', () => {
    const patient: Patient = {
      id: 'patient-1',
      location_id: 'branch-1',
      name: 'Aye Aye',
      email: 'aye@example.com',
      phone: '091111111',
      balance: 15000,
      loyalty_points: 0,
      patient_unique_id: 'P-1001'
    };

    expect(
      buildPaymentReceiptSnapshot({
        patient,
        amountPaid: 5000,
        paymentMethod: 'CASH',
        paymentDate: '2026-06-19',
        receiptNumber: 'REC-20260619-000001',
        balanceBefore: 20000,
        balanceAfter: 15000,
        paymentStatus: 'PARTIAL',
        createdAt: '2026-06-19T08:30:00Z',
        recordedByUserName: 'Nurse May',
        clinic
      })
    ).toEqual({
      version: 1,
      receiptType: 'PAYMENT',
      receiptNumber: 'REC-20260619-000001',
      receiptDate: '2026-06-19',
      createdAt: '2026-06-19T08:30:00Z',
      currency: 'MMK',
      clinic: {
        appName: 'My Dentist',
        headerTitle: 'Official Payment Receipt',
        email: 'clinic@example.com',
        phone: '09-123456789'
      },
      patient: {
        id: 'patient-1',
        name: 'Aye Aye',
        email: 'aye@example.com',
        phone: '091111111',
        patientUniqueId: 'P-1001'
      },
      payment: {
        amountPaid: 5000,
        method: 'CASH',
        status: 'PARTIAL',
        balanceBefore: 20000,
        balanceAfter: 15000,
        recordedByUserName: 'Nurse May'
      }
    });
  });

  it('builds a safe legacy payment receipt snapshot when stored snapshot is unavailable', () => {
    const payment: PaymentRecord = {
      id: 'payment-1',
      patientId: 'patient-1',
      patient_name: 'Aye Aye',
      amount: 8000,
      date: '2026-06-19',
      type: 'FULL',
      balanceBefore: 8000,
      remainingBalance: 0,
      paymentMethod: 'KPAY',
      receiptNumber: 'REC-20260619-000002',
      createdByUserName: 'Nurse Hla'
    };

    expect(buildLegacyPaymentReceiptSnapshot(payment, clinic).payment).toEqual({
      amountPaid: 8000,
      method: 'KPAY',
      status: 'FULL',
      balanceBefore: 8000,
      balanceAfter: 0,
      recordedByUserName: 'Nurse Hla'
    });
  });

  it('normalizes persisted receipt snapshot JSON', () => {
    expect(
      normalizePaymentReceiptSnapshot({
        version: 1,
        receiptType: 'PAYMENT',
        receiptNumber: 'REC-20260619-000003',
        receiptDate: '2026-06-19',
        currency: 'MMK',
        clinic: {
          appName: ' My Dentist ',
          headerTitle: ' Receipt ',
          email: ' clinic@example.com ',
          phone: ' 09-222222 '
        },
        patient: {
          id: 'patient-2',
          name: '  Ko Ko  '
        },
        payment: {
          amountPaid: '12000',
          method: 'cash',
          status: 'PARTIAL',
          balanceBefore: '20000',
          balanceAfter: 8000
        }
      })
    ).toEqual({
      version: 1,
      receiptType: 'PAYMENT',
      receiptNumber: 'REC-20260619-000003',
      receiptDate: '2026-06-19',
      createdAt: null,
      currency: 'MMK',
      clinic: {
        appName: 'My Dentist',
        headerTitle: 'Receipt',
        email: 'clinic@example.com',
        phone: '09-222222'
      },
      patient: {
        id: 'patient-2',
        name: 'Ko Ko',
        email: '',
        phone: '',
        patientUniqueId: ''
      },
      payment: {
        amountPaid: 12000,
        method: 'CASH',
        status: 'PARTIAL',
        balanceBefore: 20000,
        balanceAfter: 8000,
        recordedByUserName: null
      }
    });
  });
});
