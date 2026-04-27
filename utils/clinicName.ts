const CLINIC_NAME_KEY = 'dc_clinic_name';
const DEFAULT_CLINIC_NAME = 'DentalCloud Pro';

export function getClinicName(): string {
  try {
    const stored = localStorage.getItem(CLINIC_NAME_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed === 'string' && parsed.trim()) {
        return parsed.trim();
      }
    }
  } catch (error) {
    // Ignore parse errors
  }
  return DEFAULT_CLINIC_NAME;
}

export function saveClinicName(name: string): void {
  localStorage.setItem(CLINIC_NAME_KEY, JSON.stringify(name.trim() || DEFAULT_CLINIC_NAME));
}

export function getClinicShortName(): string {
  const fullName = getClinicName();
  // Return just the first word or a shortened version for tight spaces
  return fullName;
}
