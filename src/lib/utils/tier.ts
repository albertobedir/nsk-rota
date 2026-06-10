/**
 * Dynamically extract and compute tier from tag array.
 * Supports any tier number (tier-1, tier-2, tier-3, tier-4, etc.)
 *
 * Handles variations like:
 * - "tier-3", "tier 3", "tier3", "Tier-3", "Tier 3"
 * - Returns normalized format: "tier-3", "tier-2", etc. or null
 */
export const computeTier = (tgs: string[] = []): string | null => {
  try {
    if (!tgs || tgs.length === 0) return null;

    const normalized = tgs
      .map((s) =>
        String(s ?? "")
          .toLowerCase()
          .trim(),
      )
      .map((s) => s.replace(/[\s_]+/g, "-"));

    // Extract tier number from normalized tags
    // Matches "tier-1", "tier-2", "tier-3", "tier-4", etc.
    const tierMatch = normalized.find((s) => /^tier-\d+$/.test(s));
    if (tierMatch) {
      return tierMatch;
    }

    // Alternative: check for "tier" followed by number without dash
    // Matches "tier1", "tier2", "tier3", etc.
    for (const s of normalized) {
      const match = s.match(/^tier(\d+)$/);
      if (match) {
        return `tier-${match[1]}`;
      }
    }

    return null;
  } catch {
    return null;
  }
};
