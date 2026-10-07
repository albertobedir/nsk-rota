/** Separators commonly found in OEM / competitor part numbers. */
const PART_SEPARATORS = /[\s,_*#.\-\/]+/g;

/**
 * Bounded separators between characters — used in Mongo/JS regex.
 * `{0,2}` avoids catastrophic backtracking that `*` caused on large metafield JSON.
 */
const OPTIONAL_SEPARATORS = "[\\s,_*#.\\-\\/]{0,2}";

/** Trailing size/revision like d12, A13, D14 on TRW-style numbers. */
const VARIANT_SUFFIX = /[a-zA-Z]\d{2}$/;

export function stripPartSeparators(value: string): string {
  return value.replace(PART_SEPARATORS, "");
}

/** Ignore manufacturer prefixes/suffixes like A12345 or 12345A. */
export function stripAffixLetters(value: string): string {
  return value.replace(/^[a-zA-Z]+/, "").replace(/[a-zA-Z]+$/, "");
}

/** Strip d12 / A13-style ending so L20SV8100d13 can still hit L20SV8100d12. */
export function stripVariantSuffix(value: string): string {
  return value.replace(VARIANT_SUFFIX, "");
}

/** Strip separators and leading/trailing letters so search can partial-match digits. */
export function sanitizeSearchTerm(value: string): string {
  return stripAffixLetters(stripPartSeparators(value.trim()));
}

export function normalizePartNumber(value: string): string {
  return sanitizeSearchTerm(value).toLowerCase();
}

function digitsOnly(value: string): string {
  return normalizePartNumber(value).replace(/[a-z]/g, "");
}

/**
 * Full term plus core without the d12/A13 suffix, for Mongo and UI matching.
 */
export function expandSearchTerms(term: string): string[] {
  const full = sanitizeSearchTerm(term);
  if (!full) return [];
  const stem = stripVariantSuffix(full);
  if (stem && stem !== full && stem.length >= 4) {
    return [full, stem];
  }
  return [full];
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
  if (n.length > 0 && h.includes(n)) return true;

  const hd = digitsOnly(haystack);
  const nd = digitsOnly(needle);
  if (nd.length > 0 && hd.includes(nd)) return true;

  const nStem = stripVariantSuffix(n);
  if (nStem.length >= 4 && nStem !== n && h.includes(nStem)) return true;

  return false;
}
