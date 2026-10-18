/**
 * Bounded separators between characters — used in Mongo/JS regex.
 * `{0,2}` avoids catastrophic backtracking that `*` caused on large metafield JSON.
 */
const OPTIONAL_SEPARATORS = "[^A-Za-z0-9]{0,2}";

/** Trailing size/revision like d12, A13, D14 on TRW-style numbers. */
const VARIANT_SUFFIX = /[a-zA-Z]\d{2}$/;

/** Single search: 4 chars or fewer is a direct/exact lookup. */
export const DIRECT_SEARCH_MAX = 4;

/** Partial (yellow) matching starts at 5 alphanumeric characters. */
export const PARTIAL_MATCH_MIN = 5;

export const MIN_PARTIAL_RUN = PARTIAL_MATCH_MIN;

/** Same as PHP: preg_replace('~[^A-Za-z0-9]~', '', $term) */
export function stripPartSeparators(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "");
}

/** Ignore manufacturer prefixes/suffixes like A12345 or 12345A. */
export function stripAffixLetters(value: string): string {
  return value.replace(/^[a-zA-Z]+/, "").replace(/[a-zA-Z]+$/, "");
}

/** Strip d12 / A13-style ending so L20SV8100d13 can still hit L20SV8100d12. */
export function stripVariantSuffix(value: string): string {
  return value.replace(VARIANT_SUFFIX, "");
}

export function sanitizeSearchTerm(value: string): string {
  return stripPartSeparators(value.trim());
}

export function normalizePartNumber(value: string): string {
  return sanitizeSearchTerm(value).toLowerCase();
}

export function expandSearchTerms(term: string): string[] {
  const full = sanitizeSearchTerm(term);
  return full ? [full] : [];
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

/** Number as its own token inside JSON / mixed text. */
export function partNumberTokenRegexSource(term: string): string {
  const src = partNumberRegexSource(term);
  if (!src) return "";
  return `(^|[^A-Za-z0-9])${src}([^A-Za-z0-9]|$)`;
}

/**
 * Reverse direction: shorter codes contained in the query.
 * Prefix + suffix only (covers "abcdef" / "bcdefg" for "abcdefg") —
 * all middle windows made Mongo scan huge OEM JSON with dozens of regexes.
 */
export function reverseSearchSubstrings(
  term: string,
  minLen = PARTIAL_MATCH_MIN,
): string[] {
  const stripped = sanitizeSearchTerm(term);
  if (stripped.length <= minLen) return [];
  const out = new Set<string>();
  for (let len = minLen; len < stripped.length; len++) {
    out.add(stripped.slice(0, len));
    out.add(stripped.slice(stripped.length - len));
  }
  return [...out];
}

/** Token match without per-character optional separators (much cheaper). */
export function partNumberTokenLiteralRegexSource(term: string): string {
  const stripped = sanitizeSearchTerm(term);
  if (!stripped) return "";
  return `(^|[^A-Za-z0-9])${escapeRegex(stripped)}([^A-Za-z0-9]|$)`;
}

/**
 * Mongo patterns for one search term (single or one tag of a multi search).
 * ≤4: exact/token only. ≥5: full term as substring + prefix/suffix tokens.
 */
export function mongoPartSearchRegexes(term: string): string[] {
  const full = sanitizeSearchTerm(term);
  if (!full) return [];

  if (full.length <= DIRECT_SEARCH_MAX) {
    return [partNumberTokenLiteralRegexSource(full)].filter(Boolean);
  }

  const regexes = [partNumberRegexSource(full)];
  for (const sub of reverseSearchSubstrings(full)) {
    regexes.push(partNumberTokenLiteralRegexSource(sub));
  }
  return regexes.filter(Boolean);
}

/** Cheap candidate regexes for large JSON metafields (no reverse windows). */
export function mongoJsonSearchRegexes(term: string): string[] {
  const full = sanitizeSearchTerm(term);
  if (!full) return [];
  if (full.length <= DIRECT_SEARCH_MAX) {
    return [partNumberTokenLiteralRegexSource(full)].filter(Boolean);
  }
  return [partNumberRegexSource(full)].filter(Boolean);
}

export function joinRegexAlternation(sources: string[]): string {
  return sources
    .filter(Boolean)
    .map((p) => `(${p})`)
    .join("|");
}

export function partNumbersEqual(a: string, b: string): boolean {
  const na = normalizePartNumber(a);
  const nb = normalizePartNumber(b);
  return na.length > 0 && na === nb;
}

/**
 * Green = exact, yellow = bidirectional contains, red/null = no match.
 * Search "abcdefg":
 *   abcdefg green; abcdefgx / xabcdefg / abcdef / bcdefg yellow; xxxx none.
 */
export function classifyPartMatch(
  value: string,
  term: string,
): "exact" | "partial" | null {
  const v = normalizePartNumber(value);
  const t = normalizePartNumber(term);
  if (!v || !t) return null;
  if (v === t) return "exact";
  if (t.length <= DIRECT_SEARCH_MAX) return null;
  if (v.includes(t)) return "partial";
  if (v.length >= PARTIAL_MATCH_MIN && t.includes(v)) return "partial";
  return null;
}

export function partNumberContains(haystack: string, needle: string): boolean {
  return classifyPartMatch(haystack, needle) != null;
}

export function bestMatchType(
  values: Array<string | null | undefined>,
  terms: string[],
): "exact" | "partial" | undefined {
  const fields = values.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (fields.length === 0 || terms.length === 0) return undefined;

  let partial = false;
  for (const term of terms) {
    for (const field of fields) {
      const match = classifyPartMatch(field, term);
      if (match === "exact") return "exact";
      if (match === "partial") partial = true;
    }
  }
  return partial ? "partial" : undefined;
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
