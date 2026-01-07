/**
 * Reusable algorithms and utilities extracted from the original implementation
 *
 * These modules contain pure, framework-agnostic code that can be used
 * in the new BaseSnapshot/Query Engine implementation.
 */

// Constants for element discovery
export {
  INTERACTIVE_ROLES,
  INTERACTIVE_TAGS,
  ARIA_INPUT_ROLES,
  CLICK_HANDLER_ATTRIBUTES,
  GENERIC_TAGS,
} from './constants.js';

// Semantic region resolution
export {
  resolveRegion,
  getRegisteredRegions,
  STRUCTURED_REGION_SELECTORS,
  type NamedRegion,
  type RegionResolution,
} from './regions.js';

// Element scoring and ranking
export {
  scoreElement,
  dedupeByKey,
  rankByRelevance,
  type RankingMode,
  type ScoringSignals,
  type ScoredCandidate,
  type ScoreOptions,
} from './scoring.js';

// Text processing utilities
export {
  normalizeText,
  sanitizeAccessibleHint,
  truncate,
  escapeAttributeValue,
  escapeXPathValue,
  tokenizeForMatching,
  fuzzyTokenMatch,
} from './text-utils.js';

// Selector building utilities
export {
  buildRoleSelector,
  buildAriaLabelSelector,
  buildNameSelector,
  buildTextContentXPath,
  buildAxSelector,
  combineRoleAndAttribute,
  isLikelyHtmlNameAttribute,
} from './selectors.js';
