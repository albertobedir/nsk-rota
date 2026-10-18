/** Separators commonly found in OEM / competitor part numbers. */
const PART_SEPARATORS = /[\s,_*#.\-\/]+/g;

/**
 * Bounded separators between characters — used in Mongo/JS regex.
 * `{0,2}` avoids catastrophic backtracking that `*` caused on large metafield JSON.
 */
const OPTIONAL_SEPARATORS = "[\\s,_*#.\\-\\/]{0,2}";

/** Trailing size/revision like d12, A13, D14 on TRW-style numbers. */
const VARIANT_SUFFIX = /[a-zA-Z]\d{2}$/;

/** Minimum consecutive alphanumeric run for a partial (non-exact) match. */
export const MIN_PARTIAL_RUN = 5;

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

/** Strip punctuation/separators only — letters stay in the search term. */
export function sanitizeSearchTerm(value: string): string {
  return stripPartSeparators(value.trim());
}

export function normalizePartNumber(value: string): string {
  return sanitizeSearchTerm(value).toLowerCase();
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

/**
 * Full sanitized term plus every window of MIN_PARTIAL_RUN chars.
 * Used so "192876S" can still find "192876" in Mongo.
 */
export function sequentialSearchWindows(
  term: string,
  minLen = MIN_PARTIAL_RUN,
): string[] {
  const stripped = sanitizeSearchTerm(term);
  if (!stripped) return [];
  if (stripped.length < minLen) return [stripped];

  const windows = new Set<string>([stripped]);
  for (let i = 0; i <= stripped.length - minLen; i++) {
    windows.add(stripped.slice(i, i + minLen));
  }
  return [...windows];
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

/** Whole-field match: "29013527" does not match "29015069". */
export function partNumberExactRegexSource(term: string): string {
  const src = partNumberRegexSource(term);
  if (!src) return "";
  return `^\\s*${src}\\s*$`;
}

/** True when this catalog row is the product for a URL/search code. */
export function productMatchesCode(product: any, code: string): boolean {
  const needle = String(code ?? "").trim();
  if (!needle) return false;
  if (String(product?.shopifyId ?? "") === needle) return true;

  const raw = product?.raw ?? {};
  const metafields = Array.isArray(raw.metafields) ? raw.metafields : [];
  const rota = metafields.find((m: { key?: string }) => m?.key === "rota_no")
    ?.value;
  if (rota && partNumbersEqual(String(rota), needle)) return true;

  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  if (
    variants.some(
      (v: { sku?: string; id?: string | number }) =>
        (v?.sku && partNumbersEqual(String(v.sku), needle)) ||
        String(v?.id ?? "") === needle,
    )
  ) {
    return true;
  }

  const nNeedle = normalizePartNumber(needle);
  if (!nNeedle) return false;

  const nTitle = normalizePartNumber(String(raw.title ?? ""));
  if (nTitle.includes(nNeedle)) return true;

  const nHandle = normalizePartNumber(String(raw.handle ?? ""));
  if (nHandle.includes(nNeedle)) return true;

  return false;
}

export function partNumbersEqual(a: string, b: string): boolean {
  const na = normalizePartNumber(a);
  const nb = normalizePartNumber(b);
  return na.length > 0 && na === nb;
}

function hasSequentialRun(
  haystack: string,
  needle: string,
  minLen = MIN_PARTIAL_RUN,
): boolean {
  if (!haystack || !needle) return false;
  if (needle.length >= minLen && haystack.includes(needle)) return true;
  if (haystack.length >= minLen && needle.includes(haystack)) return true;
  if (needle.length < minLen || haystack.length < minLen) return false;

  const shorter = needle.length <= haystack.length ? needle : haystack;
  const longer = needle.length <= haystack.length ? haystack : needle;
  for (let i = 0; i <= shorter.length - minLen; i++) {
    if (longer.includes(shorter.slice(i, i + minLen))) return true;
  }
  return false;
}

export function partNumberContains(haystack: string, needle: string): boolean {
  const h = normalizePartNumber(haystack);
  const n = normalizePartNumber(needle);
  if (!h || !n) return false;
  if (h === n) return true;
  if (n.length < MIN_PARTIAL_RUN) return h.includes(n);
  return hasSequentialRun(h, n);
}
