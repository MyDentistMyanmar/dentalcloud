import { Appointment, ClinicalRecord, Doctor, Expense, Medicine, Patient } from '../types';
import { Currency } from './currency';
import { formatTeethWithPosition } from './toothNumbering';

type ExcelRow = Record<string, string | number>;

const buildWorksheet = async (rows: ExcelRow[], headers: string[]) => {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });

  worksheet['!cols'] = headers.map((header) => {
    const headerLength = header.length;
    const valueLength = rows.reduce((max, row) => {
      const value = row[header];
      return Math.max(max, String(value ?? '').length);
    }, headerLength);

    return { wch: Math.min(Math.max(valueLength + 2, 12), 40) };
  });

  return { XLSX, worksheet };
};

const saveWorkbook = async (rows: ExcelRow[], headers: string[], sheetName: string, fileName: string) => {
  const { XLSX, worksheet } = await buildWorksheet(rows, headers);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
};

export const exportPatientsToExcel = async (patients: Patient[], currency: Currency) => {
  const headers = ['Patient Name', 'Phone', 'Email', 'Medical Status', 'Balance', 'Portal Access', 'Loyalty Points'];
  const rows = patients.map((patient) => ({
    'Patient Name': patient.name,
    Phone: patient.phone,
    Email: patient.email || 'N/A',
    'Medical Status': patient.medicalHistory ? 'Review Required' : 'No Alerts',
    Balance: patient.balance || 0,
    'Portal Access': patient.has_account ? 'Active' : 'No Access',
    'Loyalty Points': patient.loyalty_points || 0
  }));

  await saveWorkbook(rows, headers, 'Patients', `patient-directory-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportAppointmentsToExcel = async (appointments: Appointment[]) => {
  const headers = ['Date', 'Time', 'Patient', 'Type', 'Doctor', 'Status', 'Notes'];
  const rows = appointments
    .slice()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .map((appointment) => ({
      Date: appointment.date,
      Time: appointment.time,
      Patient: appointment.patient_name || 'Unknown',
      Type: appointment.type || 'Checkup',
      Doctor: appointment.doctor_name ? `Dr. ${appointment.doctor_name}` : 'N/A',
      Status: appointment.status,
      Notes: appointment.notes || ''
    }));

  await saveWorkbook(rows, headers, 'Appointments', `appointments-report-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportClinicalRecordsToExcel = async (records: ClinicalRecord[], currency: Currency) => {
  const headers = ['Date', 'Patient', 'Doctor', 'Treatment', 'Teeth', 'Amount'];
  const rows = records.map((record) => ({
    Date: record.date,
    Patient: record.patient_name || 'Unknown',
    Doctor: record.doctor_name ? `Dr. ${record.doctor_name}` : 'N/A',
    Treatment: record.description,
    Teeth: record.teeth && record.teeth.length > 0 ? formatTeethWithPosition(record.teeth) : 'General',
    Amount: record.cost || 0
  }));

  await saveWorkbook(rows, headers, 'Clinical Records', `clinical-records-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportDoctorsToExcel = async (doctors: Doctor[]) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const headers = ['Doctor Name', 'Specialization', 'Phone', 'Email', 'Schedule'];
  const rows = doctors.map((doctor) => ({
    'Doctor Name': `Dr. ${doctor.name}`,
    Specialization: doctor.specialization || 'General',
    Phone: doctor.phone || 'N/A',
    Email: doctor.email || 'N/A',
    Schedule: doctor.schedules.length === 0
      ? 'No schedule set'
      : doctor.schedules
          .map(schedule => `${dayNames[schedule.day_of_week]} ${schedule.start_time}-${schedule.end_time}`)
          .join(' | ')
  }));

  await saveWorkbook(rows, headers, 'Doctors', `doctors-directory-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportInventoryToExcel = async (medicines: Medicine[], currency: Currency) => {
  const headers = ['Medicine', 'Category', 'Description', 'Unit', 'Price', 'Stock', 'Min Stock', 'Inventory Value'];
  const rows = medicines.map((medicine) => ({
    Medicine: medicine.name,
    Category: medicine.category || 'N/A',
    Description: medicine.description || '',
    Unit: medicine.unit,
    Price: medicine.price || 0,
    Stock: medicine.stock || 0,
    'Min Stock': medicine.min_stock ?? '',
    'Inventory Value': (medicine.price || 0) * (medicine.stock || 0)
  }));

  await saveWorkbook(rows, headers, 'Inventory', `inventory-report-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportExpensesToExcel = async (expenses: Expense[], currency: Currency) => {
  const headers = ['Date', 'Description', 'Category', 'Amount'];
  const rows = expenses.map((expense) => ({
    Date: expense.date,
    Description: expense.description,
    Category: expense.category || 'Uncategorized',
    Amount: expense.amount || 0
  }));

  await saveWorkbook(rows, headers, 'Expenses', `expenses-${new Date().toISOString().split('T')[0]}.xlsx`);
};
