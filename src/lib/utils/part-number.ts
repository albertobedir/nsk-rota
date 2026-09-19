/** Separators commonly found in OEM / competitor part numbers. */
const PART_SEPARATORS = /[\s,_*#.\-\/]+/g;

/**
 * Bounded separators between characters — used in Mongo/JS regex.
 * `{0,2}` avoids catastrophic backtracking that `*` caused on large metafield JSON.
 */
const OPTIONAL_SEPARATORS = "[\\s,_*#.\\-\\/]{0,2}";

export function stripPartSeparators(value: string): string {
  return value.replace(PART_SEPARATORS, "");
}

/** Ignore manufacturer prefixes/suffixes like A12345 or 12345A. */
export function stripAffixLetters(value: string): string {
  return value.replace(/^[a-zA-Z]+/, "").replace(/[a-zA-Z]+$/, "");
}

/** Strip separators and leading/trailing letters so search can partial-match digits. */
export function sanitizeSearchTerm(value: string): string {
  return stripAffixLetters(stripPartSeparators(value.trim()));
}

export function normalizePartNumber(value: string): string {
  return sanitizeSearchTerm(value).toLowerCase();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex source that matches a part number regardless of dots, dashes, spaces.
 * "0952100" matches "095.2100", "095-2100", "095 2100", etc.
 */
export function partNumberRegexSource(term: string): string {
  const stripped = sanitizeSearchTerm(term);
  if (!stripped) return "";
  return stripped.split("").map(escapeRegex).join(OPTIONAL_SEPARATORS);
}

export function partNumbersEqual(a: string, b: string): boolean {
  const na = normalizePartNumber(a);
  const nb = normalizePartNumber(b);
  return na.length > 0 && na === nb;
}

export function partNumberContains(haystack: string, needle: string): boolean {
  const h = normalizePartNumber(haystack);
  const n = normalizePartNumber(needle);
  return n.length > 0 && h.includes(n);
}
