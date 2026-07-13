import type { ClinicalRecord } from '../types';
import { calculateDoctorEarnings } from './doctorCommission';

const roundMoney = (amount: number): number => Math.round(amount * 100) / 100;

export const calculateMaterialAdjustedDoctorEarnings = (
  records: ClinicalRecord[],
  getMaterialCost: (treatmentId: string) => number
): number => {
  const total = records.reduce((sum, record) => {
    const treatmentAmount = Math.max(0, Number(record.cost || 0));
    const materialCost = Math.max(0, Number(getMaterialCost(record.id) || 0));
    const commissionBase = Math.max(0, treatmentAmount - materialCost);

    if (record.doctor_commission_percentage !== null && record.doctor_commission_percentage !== undefined) {
      return sum + calculateDoctorEarnings({
        cost: commissionBase,
        specialization: record.doctor_specialization,
        commissionRate: record.doctor_commission_percentage,
        commissionPerVisit: record.doctor_commission_per_visit
      });
    }

    const storedDoctorEarnings = Math.max(0, Number(record.doctorEarnings || 0));
    const proportionalEarnings = treatmentAmount > 0
      ? storedDoctorEarnings * (commissionBase / treatmentAmount)
      : 0;
    return sum + proportionalEarnings;
  }, 0);

  return roundMoney(total);
};

export const calculateMaterialNetProfit = (
  records: ClinicalRecord[],
  getMaterialCost: (treatmentId: string) => number
): number => {
  const treatmentAmount = records.reduce((sum, record) => sum + Math.max(0, Number(record.cost || 0)), 0);
  const materialCost = records.reduce((sum, record) => sum + Math.max(0, Number(getMaterialCost(record.id) || 0)), 0);
  const doctorEarnings = calculateMaterialAdjustedDoctorEarnings(records, getMaterialCost);
  return roundMoney(treatmentAmount - materialCost - doctorEarnings);
};
