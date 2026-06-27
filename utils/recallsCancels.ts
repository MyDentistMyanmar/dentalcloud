import type { Appointment } from '../types';

export const appointmentPatientName = (appointment: Appointment) => appointment.patient_name || appointment.guest_name || 'Unknown';

export const buildRecallsCancelsLists = (appointments: Appointment[], todayKey: string) => ({
  recalls: appointments
    .filter(appointment => appointment.patient_id && appointment.status === 'Scheduled' && appointment.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
  late: appointments
    .filter(appointment => appointment.status === 'Scheduled' && appointment.date < todayKey)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
  cancelled: appointments
    .filter(appointment => appointment.status === 'Cancelled')
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
});