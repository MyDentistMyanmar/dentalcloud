import { describe, expect, it } from 'vitest';
import type { Appointment } from '../types';
import { compareAppointmentStatus } from './appointmentSorting';

const appointment = (status: Appointment['status']): Appointment => ({
  id: status,
  location_id: 'loc-1',
  patient_id: 'patient-1',
  patient_name: 'Patient',
  date: '2026-07-04',
  time: '09:00',
  type: 'Checkup',
  status
});

describe('appointment sorting', () => {
  it('groups scheduled, completed, then cancelled appointments', () => {
    expect([
      appointment('Cancelled'),
      appointment('Completed'),
      appointment('Scheduled')
    ].sort(compareAppointmentStatus).map((item) => item.status)).toEqual([
      'Scheduled',
      'Completed',
      'Cancelled'
    ]);
  });
});