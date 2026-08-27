/** Separators commonly found in OEM / competitor part numbers. */
const PART_SEPARATORS = /[\s,_*#.\-\/]+/g;

/** Optional separators between characters — used in Mongo/JS regex. */
const OPTIONAL_SEPARATORS = "[\\s,_*#.\\-\\/]*";

export function stripPartSeparators(value: string): string {
  return value.replace(PART_SEPARATORS, "");
}

export function normalizePartNumber(value: string): string {
  return stripPartSeparators(value).toLowerCase();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex source that matches a part number regardless of dots, dashes, spaces.
 * "0952100" matches "095.2100", "095-2100", "095 2100", etc.
 */
export function partNumberRegexSource(term: string): string {
  const stripped = stripPartSeparators(term);
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
