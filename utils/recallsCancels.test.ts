import { describe, expect, it } from 'vitest';
import type { Appointment } from '../types';
import { appointmentPatientName, buildRecallsCancelsLists } from './recallsCancels';

const appointment = (overrides: Partial<Appointment>): Appointment => ({
  id: overrides.id || Math.random().toString(),
  location_id: 'loc-1',
  date: '2026-06-27',
  time: '09:00',
  type: 'Consult',
  status: 'Scheduled',
  ...overrides
});

describe('recalls and cancels dashboard lists', () => {
  it('splits appointments into recall, late/no-show, and cancelled buckets', () => {
    const { recalls, late, cancelled } = buildRecallsCancelsLists([
      appointment({ id: 'future-patient', patient_id: 'p1', patient_name: 'Patient', date: '2026-06-28' }),
      appointment({ id: 'future-lead', guest_name: 'Lead', date: '2026-06-29' }),
      appointment({ id: 'late-lead', guest_name: 'Late Lead', date: '2026-06-26' }),
      appointment({ id: 'cancelled', patient_name: 'Cancelled', status: 'Cancelled', date: '2026-06-20' }),
      appointment({ id: 'completed', patient_name: 'Done', status: 'Completed', date: '2026-06-20' })
    ], '2026-06-27');

    expect(recalls.map(item => item.id)).toEqual(['future-patient']);
    expect(late.map(item => item.id)).toEqual(['late-lead']);
    expect(cancelled.map(item => item.id)).toEqual(['cancelled']);
  });

  it('uses patient name, then guest name, then Unknown', () => {
    expect(appointmentPatientName(appointment({ patient_name: 'Registered', guest_name: 'Guest' }))).toBe('Registered');
    expect(appointmentPatientName(appointment({ guest_name: 'Guest' }))).toBe('Guest');
    expect(appointmentPatientName(appointment({}))).toBe('Unknown');
  });
});