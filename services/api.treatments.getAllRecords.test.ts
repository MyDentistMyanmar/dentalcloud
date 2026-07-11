import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state: any = { calls: [], rows: [] };

  const createTreatmentQuery = () => {
    const query: any = {
      order: vi.fn((column: string, options?: any) => {
        state.calls.push({ action: 'order', column, options });
        return query;
      }),
      limit: vi.fn((count: number) => {
        state.calls.push({ action: 'limit', count });
        return query;
      }),
      eq: vi.fn((column: string, value: string) => {
        state.calls.push({ action: 'eq', column, value });
        return query;
      }),
      then: (resolve: any) => Promise.resolve({ data: state.rows, error: null }).then(resolve)
    };
    return query;
  };

  state.from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      state.calls.push({ table, action: 'select', columns });
      return createTreatmentQuery();
    })
  }));

  return state;
});

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from, rpc: vi.fn() },
  supabaseUrl: '',
  supabaseAnonKey: ''
}));

import { api } from './api';

describe('treatments.getAllRecords', () => {
  beforeEach(() => {
    supabaseMock.calls = [];
    supabaseMock.rows = [];
    supabaseMock.from.mockClear();
  });

  it('keeps the default recent-record limit for performance', async () => {
    await api.treatments.getAllRecords('location-1');

    expect(supabaseMock.calls).toContainEqual({ action: 'limit', count: 50 });
  });

  it('does not apply the recent-record limit when audit log asks for all records', async () => {
    await api.treatments.getAllRecords('location-1', { limit: null });

    expect(supabaseMock.calls).toContainEqual({ table: 'treatments', action: 'select', columns: '*, patients(name, balance, patient_type), doctors(name)' });
    expect(supabaseMock.calls).not.toContainEqual({ action: 'limit', count: 50 });
    expect(supabaseMock.calls).toContainEqual({ action: 'eq', column: 'location_id', value: 'location-1' });
  });
});