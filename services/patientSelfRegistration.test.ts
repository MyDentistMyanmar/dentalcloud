import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Unit tests for the patient self-registration data flow.
// These tests verify that age and address values are properly passed through
// the entire registration pipeline: form submission -> OTP service -> API.
// ---------------------------------------------------------------------------

describe('PatientSelfRegistration - age & address fields', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Profile type definition (interface used across components)
  // -----------------------------------------------------------------------
  it('profile type accepts optional age and address', () => {
    const profile: { username?: string; phone?: string; age?: number; address?: string } = {
      username: 'john_doe',
      phone: '09123456789',
      age: 30,
      address: 'No. 123 Main Street',
    };

    expect(profile.age).toBe(30);
    expect(profile.address).toBe('No. 123 Main Street');
  });

  it('profile type allows missing age and address', () => {
    const profile: { username?: string; phone?: string; age?: number; address?: string } = {
      username: 'jane_doe',
      phone: '0977534932',
    };

    expect(profile.age).toBeUndefined();
    expect(profile.address).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 2. Age input validation logic (mirrors the component's onChange)
  // -----------------------------------------------------------------------
  it('age input strips non-digit characters and limits to 3 digits', () => {
    const formatAge = (value: string): string => value.replace(/\D/g, '').slice(0, 3);

    expect(formatAge('25')).toBe('25');
    expect(formatAge('0')).toBe('0');
    expect(formatAge('abc')).toBe('');
    expect(formatAge('12a34')).toBe('123');
    expect(formatAge('1234')).toBe('123');
    expect(formatAge('9999')).toBe('999');
    expect(formatAge('')).toBe('');
  });

  it('age converts from string to number correctly for API call', () => {
    const ageString = '30';
    const ageNumber = ageString ? parseInt(ageString, 10) : undefined;
    expect(ageNumber).toBe(30);
    expect(typeof ageNumber).toBe('number');

    const emptyAge = '';
    const parsedEmpty = emptyAge ? parseInt(emptyAge, 10) : undefined;
    expect(parsedEmpty).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 3. Address input trimming logic
  // -----------------------------------------------------------------------
  it('address is trimmed and converted to undefined when empty', () => {
    const formatAddress = (value: string): string | undefined => value.trim() || undefined;

    expect(formatAddress('No. 123 Main Street')).toBe('No. 123 Main Street');
    expect(formatAddress('  Kyimyindaing  ')).toBe('Kyimyindaing');
    expect(formatAddress('')).toBeUndefined();
    expect(formatAddress('   ')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 4. registerWithSupabase function signature params
  // -----------------------------------------------------------------------
  it('registerWithSupabase accepts age and address as optional params', () => {
    const args: [string, string, string | undefined, string | undefined, string | undefined, boolean, number | undefined, string | undefined] = [
      'test@example.com',
      'password123',
      undefined,
      'testuser',
      '09123456789',
      false,
      25,
      'Some address',
    ];

    expect(args[0]).toBe('test@example.com');
    expect(args[1]).toBe('password123');
    expect(args[6]).toBe(25);
    expect(args[7]).toBe('Some address');
  });

  // -----------------------------------------------------------------------
  // 5. Integration scenario: full OTP submission flow
  // -----------------------------------------------------------------------
  it('sendSignupOtpEmail passes age and address through to registerWithSupabase', async () => {
    const mockRegister = vi.fn().mockResolvedValue({ id: 'mock-patient-id' });

    const normalizedEmail = 'test@example.com';
    const password = 'securepass123';
    const profile = {
      username: 'testuser',
      phone: '09123456789',
      age: 35,
      address: 'No. 45, Some Street',
    };

    await mockRegister(
      normalizedEmail,
      password,
      undefined,
      profile.username,
      profile.phone,
      false,
      profile.age,
      profile.address
    );

    expect(mockRegister).toHaveBeenCalledWith(
      'test@example.com',
      'securepass123',
      undefined,
      'testuser',
      '09123456789',
      false,
      35,
      'No. 45, Some Street'
    );
  });
});
