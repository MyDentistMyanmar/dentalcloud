import type { Appointment } from '../types';

const appointmentStatusOrder: Record<Appointment['status'], number> = {
  Scheduled: 0,
  Completed: 1,
  Cancelled: 2
};

export const compareAppointmentStatus = (a: Appointment, b: Appointment) =>
  appointmentStatusOrder[a.status] - appointmentStatusOrder[b.status];