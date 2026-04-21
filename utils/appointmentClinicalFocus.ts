export interface AppointmentClinicalFocus {
  clinicalFocus: string;
  targetTeeth: number[];
  notes: string;
}

const FOCUS_PREFIX = 'Clinical Focus:';
const TEETH_PREFIX = 'Target Teeth:';
const NOTES_PREFIX = 'Notes:';

const parseTeeth = (value: string): number[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value));

export const parseAppointmentClinicalFocus = (rawNotes?: string | null): AppointmentClinicalFocus => {
  const notesText = (rawNotes || '').trim();
  if (!notesText) {
    return { clinicalFocus: '', targetTeeth: [], notes: '' };
  }

  const lines = notesText.split(/\r?\n/).map((line) => line.trim());
  const focusLine = lines.find((line) => line.startsWith(FOCUS_PREFIX));
  const teethLine = lines.find((line) => line.startsWith(TEETH_PREFIX));
  const notesIndex = lines.findIndex((line) => line.startsWith(NOTES_PREFIX));

  const clinicalFocus = focusLine ? focusLine.slice(FOCUS_PREFIX.length).trim() : '';
  const targetTeeth = teethLine ? parseTeeth(teethLine.slice(TEETH_PREFIX.length).trim()) : [];

  if (focusLine || teethLine || notesIndex >= 0) {
    const parsedNotes = notesIndex >= 0
      ? [lines[notesIndex].slice(NOTES_PREFIX.length).trim(), ...lines.slice(notesIndex + 1)]
          .join('\n')
          .trim()
      : '';
    return {
      clinicalFocus,
      targetTeeth,
      notes: parsedNotes
    };
  }

  // Legacy plain-text notes (before structured format).
  return {
    clinicalFocus: '',
    targetTeeth: [],
    notes: notesText
  };
};

export const buildAppointmentClinicalFocusNotes = (data: AppointmentClinicalFocus): string => {
  const cleanedFocus = data.clinicalFocus.trim();
  const cleanedTeeth = Array.from(new Set(data.targetTeeth)).sort((a, b) => a - b);
  const cleanedNotes = data.notes.trim();

  const lines: string[] = [];
  if (cleanedFocus) lines.push(`${FOCUS_PREFIX} ${cleanedFocus}`);
  if (cleanedTeeth.length > 0) lines.push(`${TEETH_PREFIX} ${cleanedTeeth.join(', ')}`);
  if (cleanedNotes) lines.push(`${NOTES_PREFIX} ${cleanedNotes}`);

  return lines.join('\n').trim();
};
