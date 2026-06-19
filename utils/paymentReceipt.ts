import type { Patient, PaymentRecord, PaymentReceiptSnapshot, PaymentMethod } from '../types';
import type { Currency } from './currency';
import { normalizePaymentMethod } from './paymentMethods';
import { resolveReceiptHeaderTitle } from './receiptPreferences';

type ReceiptClinicContext = {
  appName: string;
  receiptHeaderTitle?: string;
  receiptInfo?: { email: string; phone: string };
  currency: Currency;
};

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizePaymentMethodValue = (value: unknown): PaymentMethod => normalizePaymentMethod(value);

export const normalizePaymentReceiptSnapshot = (value: unknown): PaymentReceiptSnapshot | null => {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, any>;
  const receiptNumber = normalizeString(raw.receiptNumber);
  const receiptDate = normalizeString(raw.receiptDate);
  const currency = raw.currency === 'MMK' ? 'MMK' : raw.currency === 'USD' ? 'USD' : null;
  const method = normalizePaymentMethodValue(raw.payment?.method);
  const status = raw.payment?.status === 'FULL' ? 'FULL' : raw.payment?.status === 'PARTIAL' ? 'PARTIAL' : null;

  if (!receiptNumber || !receiptDate || !currency || !status) return null;

  return {
    version: 1,
    receiptType: 'PAYMENT',
    receiptNumber,
    receiptDate,
    createdAt: normalizeString(raw.createdAt) || null,
    currency,
    clinic: {
      appName: normalizeString(raw.clinic?.appName) || 'DentalCloud Pro',
      headerTitle: normalizeString(raw.clinic?.headerTitle) || 'DentalCloud Pro',
      email: normalizeString(raw.clinic?.email),
      phone: normalizeString(raw.clinic?.phone)
    },
    patient: {
      id: normalizeString(raw.patient?.id),
      name: normalizeString(raw.patient?.name) || 'Unknown Patient',
      email: normalizeString(raw.patient?.email),
      phone: normalizeString(raw.patient?.phone),
      patientUniqueId: normalizeString(raw.patient?.patientUniqueId)
    },
    payment: {
      amountPaid: normalizeNumber(raw.payment?.amountPaid),
      method,
      status,
      balanceBefore: normalizeNumber(raw.payment?.balanceBefore),
      balanceAfter: normalizeNumber(raw.payment?.balanceAfter),
      recordedByUserName: normalizeString(raw.payment?.recordedByUserName) || null
    }
  };
};

export const buildPaymentReceiptSnapshot = (params: {
  patient: Patient;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  receiptNumber: string;
  balanceBefore: number;
  balanceAfter: number;
  paymentStatus: 'FULL' | 'PARTIAL';
  createdAt?: string | null;
  recordedByUserName?: string | null;
  clinic: ReceiptClinicContext;
}): PaymentReceiptSnapshot => {
  const clinicEmail = normalizeString(params.clinic.receiptInfo?.email);
  const clinicPhone = normalizeString(params.clinic.receiptInfo?.phone);
  const normalizedAppName = normalizeString(params.clinic.appName) || 'DentalCloud Pro';

  return {
    version: 1,
    receiptType: 'PAYMENT',
    receiptNumber: params.receiptNumber,
    receiptDate: params.paymentDate,
    createdAt: params.createdAt || null,
    currency: params.clinic.currency,
    clinic: {
      appName: normalizedAppName,
      headerTitle: resolveReceiptHeaderTitle(params.clinic.receiptHeaderTitle, normalizedAppName),
      email: clinicEmail,
      phone: clinicPhone
    },
    patient: {
      id: params.patient.id,
      name: params.patient.name,
      email: normalizeString(params.patient.email),
      phone: normalizeString(params.patient.phone),
      patientUniqueId: normalizeString(params.patient.patient_unique_id)
    },
    payment: {
      amountPaid: Math.max(0, normalizeNumber(params.amountPaid)),
      method: normalizePaymentMethodValue(params.paymentMethod),
      status: params.paymentStatus,
      balanceBefore: Math.max(0, normalizeNumber(params.balanceBefore)),
      balanceAfter: Math.max(0, normalizeNumber(params.balanceAfter)),
      recordedByUserName: normalizeString(params.recordedByUserName) || null
    }
  };
};

export const buildLegacyPaymentReceiptSnapshot = (
  payment: PaymentRecord,
  clinic: ReceiptClinicContext
): PaymentReceiptSnapshot => {
  const paymentDate = normalizeString(payment.date) || normalizeString(payment.createdAt).slice(0, 10);
  const receiptNumber = normalizeString(payment.receiptNumber) || `REC-${payment.id}`;
  const balanceAfter = Math.max(0, normalizeNumber(payment.remainingBalance));
  const balanceBefore = Math.max(balanceAfter, normalizeNumber(payment.balanceBefore ?? balanceAfter + normalizeNumber(payment.amount)));

  return {
    version: 1,
    receiptType: 'PAYMENT',
    receiptNumber,
    receiptDate: paymentDate,
    createdAt: payment.createdAt || null,
    currency: clinic.currency,
    clinic: {
      appName: normalizeString(clinic.appName) || 'DentalCloud Pro',
      headerTitle: resolveReceiptHeaderTitle(clinic.receiptHeaderTitle, clinic.appName || 'DentalCloud Pro'),
      email: normalizeString(clinic.receiptInfo?.email),
      phone: normalizeString(clinic.receiptInfo?.phone)
    },
    patient: {
      id: payment.patientId,
      name: normalizeString(payment.patient_name) || 'Unknown Patient'
    },
    payment: {
      amountPaid: Math.max(0, normalizeNumber(payment.amount)),
      method: normalizePaymentMethodValue(payment.paymentMethod),
      status: payment.type === 'FULL' ? 'FULL' : 'PARTIAL',
      balanceBefore,
      balanceAfter,
      recordedByUserName: normalizeString(payment.createdByUserName) || null
    }
  };
};
