/**
 * Renderer Types
 *
 * Type definitions for FactPack rendering.
 */

import type { TOKEN_BUDGETS } from './constants.js';

/**
 * Token budget tier names.
 */
export type TokenBudget = keyof typeof TOKEN_BUDGETS;

/**
 * Output format for rendered FactPack.
 */
export type OutputFormat = 'xml-compact';

/**
 * Options for rendering FactPack to page_brief.
 */
export interface RenderOptions {
  /** Output format (currently only xml-compact) */
  format: OutputFormat;

  /** Token budget tier */
  budget: TokenBudget;

  /** Include <state> section (default: true) */
  include_state?: boolean;

  /** Maximum actions to include (overrides default) */
  max_actions?: number;

  /** Include URL in state (default: true) */
  include_url?: boolean;
}

/**
 * Result of page_brief rendering.
 */
export interface PageBriefResult {
  /** The rendered XML-compact page brief */
  page_brief: string;

  /** Estimated token count */
  page_brief_tokens: number;

  /** Was truncation applied? */
  was_truncated: boolean;

  /** Original token count before truncation (if truncated) */
  original_tokens?: number;
}

/**
 * Section render result (before budget application).
 */
export interface RenderedSection {
  /** Section name (for identification) */
  name: string;

  /** Rendered content */
  content: string;

  /** Priority for truncation (lower = cut first) */
  truncation_priority: number;

  /** Can this section be truncated? */
  can_truncate: boolean;

  /** Minimum content if truncated (for sections that can be partially truncated) */
  truncated_content?: string;
}

/**
 * Truncation context passed to section renderers.
 */
export interface TruncationContext {
  /** Current total tokens */
  current_tokens: number;

  /** Target token limit */
  target_tokens: number;

  /** Hard cap */
  cap_tokens: number;

  /** Which sections have been truncated */
  truncated_sections: string[];
}
