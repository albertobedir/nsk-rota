export const PO_NOTE_PREFIX = "PO Number:";

export function formatPoNoteLine(poNumber: string): string {
  return `${PO_NOTE_PREFIX} ${poNumber.trim()}`;
}

export function noteAlreadyHasPoNumber(
  note: string | null | undefined,
  poNumber?: string | null,
): boolean {
  if (!note) return false;
  const trimmedPo = poNumber?.trim();
  if (trimmedPo && note.includes(trimmedPo)) return true;
  return /(^|\n)\s*PO Number:/i.test(note);
}

export function appendPoNumberToNote(
  note: string | null | undefined,
  poNumber: string,
): string {
  const trimmed = poNumber.trim();
  if (!trimmed) return note ?? "";
  if (noteAlreadyHasPoNumber(note, trimmed)) {
    return note ?? formatPoNoteLine(trimmed);
  }

  const line = formatPoNoteLine(trimmed);
  const existing = note?.trim();
  return existing ? `${line}\n${existing}` : line;
}
