import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [], insertPayloads: [], singleResults: [], selectResults: [] };

  const createSelectQuery = () => {
    const query: any = {
      order: vi.fn((column: string, options?: any) => {
        state.calls.push({ action: 'order', column, options });
        return query;
      }),
      eq: vi.fn((column: string, value: string) => {
        state.calls.push({ action: 'eq', column, value });
        return query;
      }),
      then: (resolve: any, reject: any) => Promise.resolve(
        state.selectResults.shift() || { data: [], error: null }
      ).then(resolve, reject)
    };
    return query;
  };

  state.from = vi.fn((table: string) => ({
    insert: vi.fn((payload: any) => {
      state.insertPayloads.push({ table, payload });
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => state.singleResults.shift())
        }))
      };
    }),
    select: vi.fn((columns: string) => {
      state.calls.push({ table, action: 'select', columns });
      return createSelectQuery();
    })
  }));
  return state;
});

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('appointmentRescheduleLogs.create', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.insertPayloads = [];
    supabaseMock.singleResults = [];
    supabaseMock.selectResults = [];
    supabaseMock.from.mockClear();
  });

  it('loads reschedule logs with joined patient details so Unknown snapshots are corrected', async () => {
    supabaseMock.selectResults.push({
      data: [
        {
          id: 'log-1',
          appointment_id: 'apt-1',
          location_id: 'loc-1',
          patient_id: null,
          patient_name: 'Unknown',
          doctor_name: null,
          original_date: '2026-06-28',
          new_date: '2026-06-29',
          reason: 'Patient did not arrive',
          admin_user_id: null,
          admin_name: 'Admin',
          created_at: '2026-06-28T00:00:00Z',
          appointments: {
            patient_id: 'pat-1',
            guest_name: null,
            date: '2026-06-29',
            patients: { name: 'Correct Patient', balance: 2500 },
            doctors: { name: 'Hnin' }
          }
        }
      ],
      error: null
    });

    const result = await api.appointmentRescheduleLogs.getAll('loc-1');

    const selectCall = supabaseMock.calls.find((call: any) => call.table === 'appointment_reschedule_logs' && call.action === 'select');
    expect(selectCall.columns).toContain('appointments');
    expect(selectCall.columns).toContain('patients(name, balance)');
    expect(supabaseMock.calls).toContainEqual({ action: 'eq', column: 'location_id', value: 'loc-1' });
    expect(result[0]).toMatchObject({
      patient_id: 'pat-1',
      patient_name: 'Correct Patient',
      doctor_name: 'Hnin',
      patient_balance: 2500,
      appointment_date: '2026-06-29'
    });
  });

  it('drops stale admin_user_id when the optional FK rejects it', async () => {
    supabaseMock.singleResults.push(
      {
        data: null,
        error: { message: 'insert or update on table "appointment_reschedule_logs" violates foreign key constraint "appointment_reschedule_logs_admin_user_id_fkey"' }
      },
      {
        data: {
          id: 'log-1',
          appointment_id: 'apt-1',
          location_id: 'loc-1',
          patient_id: null,
          patient_name: 'Patient',
          doctor_name: null,
          original_date: '2026-06-28',
          new_date: '2026-06-29',
          reason: 'Patient did not arrive',
          admin_user_id: null,
          admin_name: 'Admin',
          created_at: '2026-06-28T00:00:00Z'
        },
        error: null
      }
    );

    const result = await api.appointmentRescheduleLogs.create({
      appointment_id: 'apt-1',
      location_id: 'loc-1',
      patient_name: 'Patient',
      original_date: '2026-06-28',
      new_date: '2026-06-29',
      reason: 'Patient did not arrive',
      admin_user_id: 'deleted-user',
      admin_name: 'Admin'
    });

    expect(supabaseMock.insertPayloads.map((call: any) => call.payload.admin_user_id)).toEqual(['deleted-user', null]);
    expect(result.admin_name).toBe('Admin');
  });
});