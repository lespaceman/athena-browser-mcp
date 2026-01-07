/**
 * Text Normalization and Processing Utilities
 *
 * Pure utility functions for text processing, normalization,
 * and string matching used in element discovery.
 */

/**
 * Normalize text for matching:
 * - Unicode NFKC normalization
 * - Remove zero-width/invisible characters
 * - Collapse whitespace
 */
export function normalizeText(text: string): string {
  return (
    text
      .normalize('NFKC')
      // Remove zero-width/invisible characters
      // eslint-disable-next-line no-misleading-character-class
      .replace(/[\u200B-\u200D\uFEFF\u034F\u2060\u180E]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Sanitize accessible name/label hint for selector building
 * Returns undefined if the result is empty or too short
 */
export function sanitizeAccessibleHint(value: string, maxLength = 160): string | undefined {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;

  const tokens = normalized.split(' ').filter(Boolean).slice(0, 12);
  if (tokens.length === 0) return undefined;

  return truncate(tokens.join(' '), maxLength);
}

/**
 * Truncate string with ellipsis
 */
export function truncate(value: string, max = 120): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Escape string for CSS attribute selector
 */
export function escapeAttributeValue(value: string, maxLength = 120): string {
  return truncate(normalizeText(value), maxLength).replace(/["\\]/g, '\\$&');
}

/**
 * Escape string for XPath string literal
 * XPath doesn't have a standard escape mechanism, so we handle quotes carefully
 */
export function escapeXPathValue(value: string): string {
  if (value.includes("'")) {
    if (value.includes('"')) {
      // Contains both - use concat() to build the string
      const parts = value.split("'");
      return 'concat(' + parts.map((part) => `'${part}'`).join(', "\'", ') + ')';
    }
    // Contains only single quotes - wrap in double quotes
    return `"${value}"`;
  }
  // No single quotes - use as-is (caller wraps in single quotes)
  return value;
}

/**
 * Tokenize text for XPath matching
 * Takes first few significant words to avoid overly specific selectors
 */
export function tokenizeForMatching(text: string, maxTokens = 3, minLength = 2): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter((word) => word.length > minLength);
  return words.slice(0, maxTokens);
}

/**
 * Check if two strings match using fuzzy token-based comparison
 */
export function fuzzyTokenMatch(text: string, query: string, minMatchTokens = 2): boolean {
  const textTokens = new Set(tokenizeForMatching(text.toLowerCase(), 10, 2));
  const queryTokens = tokenizeForMatching(query.toLowerCase(), 5, 2);

  if (queryTokens.length === 0) return false;

  let matchCount = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      matchCount++;
    }
  }

  return matchCount >= Math.min(minMatchTokens, queryTokens.length);
}
