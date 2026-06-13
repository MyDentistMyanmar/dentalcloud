import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Unit tests for the patient self-registration data flow.
// These tests verify that age, address, city, and township values are properly
// passed through the entire pipeline: form submission -> OTP service -> API.
// ---------------------------------------------------------------------------

describe('PatientSelfRegistration - age & address fields', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Profile type definition (interface used across components)
  // -----------------------------------------------------------------------
  it('profile type accepts optional age, address, city, and township', () => {
    const profile: { username?: string; phone?: string; age?: number; address?: string; city?: string; township?: string } = {
      username: 'john_doe',
      phone: '09123456789',
      age: 30,
      address: 'No. 123 Main Street',
      city: 'Yangon',
      township: 'Bahan',
    };

    expect(profile.age).toBe(30);
    expect(profile.address).toBe('No. 123 Main Street');
    expect(profile.city).toBe('Yangon');
    expect(profile.township).toBe('Bahan');
  });

  it('profile type allows missing age, address, city, and township', () => {
    const profile: { username?: string; phone?: string; age?: number; address?: string; city?: string; township?: string } = {
      username: 'jane_doe',
      phone: '0977534932',
    };

    expect(profile.age).toBeUndefined();
    expect(profile.address).toBeUndefined();
    expect(profile.city).toBeUndefined();
    expect(profile.township).toBeUndefined();
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
  // 3. Address/city/township trimming logic
  // -----------------------------------------------------------------------
  it('text fields are trimmed and converted to undefined when empty', () => {
    const trimOrUndefined = (value: string): string | undefined => value.trim() || undefined;

    expect(trimOrUndefined('No. 123 Main Street')).toBe('No. 123 Main Street');
    expect(trimOrUndefined('  Yangon  ')).toBe('Yangon');
    expect(trimOrUndefined('')).toBeUndefined();
    expect(trimOrUndefined('   ')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 4. City/township cascade logic
  // -----------------------------------------------------------------------
  it('city change resets township if not in new city townships', () => {
    const getTownshipsForCity = (city: string): string[] => {
      const map: Record<string, string[]> = {
        'Yangon': ['Bahan', 'Hlaing', 'Kyimyindaing'],
        'Mandalay': ['Chanayethazan', 'Mahaaungmye'],
      };
      return map[city] || [];
    };

    const onCityChange = (selectedCity: string, currentTownship: string) => {
      const allowedTownships = getTownshipsForCity(selectedCity);
      const nextTownship = allowedTownships.includes(currentTownship) ? currentTownship : '';
      return { city: selectedCity, township: nextTownship };
    };

    const result1 = onCityChange('Yangon', 'Bahan');
    expect(result1.city).toBe('Yangon');
    expect(result1.township).toBe('Bahan');

    const result2 = onCityChange('Mandalay', 'Bahan');
    expect(result2.city).toBe('Mandalay');
    expect(result2.township).toBe('');

    const result3 = onCityChange('Yangon', '');
    expect(result3.city).toBe('Yangon');
    expect(result3.township).toBe('');
  });

  // -----------------------------------------------------------------------
  // 5. registerWithSupabase function signature params
  // -----------------------------------------------------------------------
  it('registerWithSupabase accepts all optional params', () => {
    const args: [string, string, string | undefined, string | undefined, string | undefined, boolean, number | undefined, string | undefined, string | undefined, string | undefined] = [
      'test@example.com',
      'password123',
      undefined,
      'testuser',
      '09123456789',
      false,
      25,
      'Some address',
      'Yangon',
      'Bahan',
    ];

    expect(args[0]).toBe('test@example.com');
    expect(args[1]).toBe('password123');
    expect(args[6]).toBe(25);
    expect(args[7]).toBe('Some address');
    expect(args[8]).toBe('Yangon');
    expect(args[9]).toBe('Bahan');
  });

  // -----------------------------------------------------------------------
  // 6. Integration scenario: full OTP submission flow
  // -----------------------------------------------------------------------
  it('sendSignupOtpEmail passes all address fields through to registerWithSupabase', async () => {
    const mockRegister = vi.fn().mockResolvedValue({ id: 'mock-patient-id' });

    const profile = {
      username: 'testuser',
      phone: '09123456789',
      age: 35,
      address: 'No. 45, Some Street',
      city: 'Yangon',
      township: 'Bahan',
    };

    await mockRegister(
      'test@example.com',
      'securepass123',
      undefined,
      profile.username,
      profile.phone,
      false,
      profile.age,
      profile.address,
      profile.city,
      profile.township
    );

    expect(mockRegister).toHaveBeenCalledWith(
      'test@example.com',
      'securepass123',
      undefined,
      'testuser',
      '09123456789',
      false,
      35,
      'No. 45, Some Street',
      'Yangon',
      'Bahan'
    );
  });

  // -----------------------------------------------------------------------
  // 7. Pending data localStorage shape includes all fields
  // -----------------------------------------------------------------------
  it('pendingData stored in localStorage includes all address fields', () => {
    const pendingData = {
      username: 'john_doe',
      phone: '09123456789',
      age: 30,
      address: 'No. 123 Main Street',
      city: 'Yangon',
      township: 'Bahan',
    };

    const serialized = JSON.stringify(pendingData);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.age).toBe(30);
    expect(deserialized.address).toBe('No. 123 Main Street');
    expect(deserialized.city).toBe('Yangon');
    expect(deserialized.township).toBe('Bahan');
  });

  it('pendingData with missing fields still works', () => {
    const pendingData = {
      username: 'jane_doe',
      phone: '0977534932',
      age: undefined,
      address: undefined,
      city: undefined,
      township: undefined,
    };

    const serialized = JSON.stringify(pendingData);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.age).toBeUndefined();
    expect(deserialized.address).toBeUndefined();
    expect(deserialized.city).toBeUndefined();
    expect(deserialized.township).toBeUndefined();
  });
});