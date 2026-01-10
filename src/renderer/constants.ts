/**
 * Renderer Constants
 *
 * Token budget configuration for page_brief rendering.
 */

/**
 * Token budget tiers for different use cases.
 * - target: Ideal token count to stay under
 * - cap: Hard limit, will truncate to meet this
 */
export const TOKEN_BUDGETS = {
  /** Compact: For embedding in large prompts */
  compact: { target: 400, cap: 800 },

  /** Standard: Default for all page loads */
  standard: { target: 1000, cap: 2000 },

  /** Detailed: Full context when explicitly requested */
  detailed: { target: 2500, cap: 5000 },
} as const;

/** Default budget tier */
export const DEFAULT_BUDGET = 'standard' as const;

/** Maximum token cap across all tiers */
export const MAX_TOKEN_CAP = 5000;

/** Default number of actions to include */
export const DEFAULT_MAX_ACTIONS = 12;

/** Minimum actions to keep during truncation */
export const MIN_ACTIONS_ON_TRUNCATE = 5;

/** Characters per token (rough estimate for truncation) */
export const CHARS_PER_TOKEN = 4;
