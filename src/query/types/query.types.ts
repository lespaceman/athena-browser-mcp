/**
 * Query Engine Types
 *
 * Request/Response schemas for semantic element queries.
 * Supports filtering by kind, label, region, state, and structural attributes.
 */

import type { NodeKind, SemanticRegion, ReadableNode } from '../../snapshot/snapshot.types.js';

// ============================================================================
// Text Matching
// ============================================================================

/**
 * Text matching mode for label queries.
 */
export type TextMatchMode = 'exact' | 'contains' | 'fuzzy';

/**
 * Options for fuzzy matching behavior
 */
export interface FuzzyMatchOptions {
  /** Minimum token overlap ratio (0-1) for a match. Default: 0.5 */
  minTokenOverlap?: number;
  /** Enable prefix matching for tokens. Default: true */
  prefixMatch?: boolean;
  /** Minimum edit distance similarity (0-1) for similar tokens. Default: 0.8 */
  minSimilarity?: number;
}

/**
 * Label filter configuration
 */
export interface LabelFilter {
  /** Text to match against node labels */
  text: string;
  /** Matching mode (default: 'contains') */
  mode?: TextMatchMode;
  /** Case sensitivity (default: false) */
  caseSensitive?: boolean;
  /** Options for fuzzy matching (only used when mode is 'fuzzy') */
  fuzzyOptions?: FuzzyMatchOptions;
}

// ============================================================================
// State Constraints
// ============================================================================

/**
 * State constraint for filtering nodes by their interactive state
 */
export interface StateConstraint {
  /** Node must be visible */
  visible?: boolean;
  /** Node must be enabled */
  enabled?: boolean;
  /** Node must be checked (checkboxes/radios/switches) */
  checked?: boolean;
  /** Node must be expanded (accordions/dropdowns) */
  expanded?: boolean;
  /** Node must be selected (tabs/options) */
  selected?: boolean;
  /** Node must be focused */
  focused?: boolean;
  /** Node must be required */
  required?: boolean;
  /** Node must be invalid */
  invalid?: boolean;
  /** Node must be readonly */
  readonly?: boolean;
}

// ============================================================================
// Request Schema
// ============================================================================

/**
 * Request to find elements in a snapshot
 */
export interface FindElementsRequest {
  /** Filter by NodeKind (single or array) */
  kind?: NodeKind | NodeKind[];

  /** Filter by label text (string for contains, or LabelFilter for options) */
  label?: string | LabelFilter;

  /** Filter by semantic region (single or array) */
  region?: SemanticRegion | SemanticRegion[];

  /** Filter by state constraints */
  state?: StateConstraint;

  /** Filter by group identifier (exact match) */
  group_id?: string;

  /** Filter by heading context (exact match) */
  heading_context?: string;

  /** Maximum number of results (default: 10) */
  limit?: number;

  /** Minimum relevance score (0-1) to include in results */
  min_score?: number;

  /** Sort results by relevance (default: false, maintains document order) */
  sort_by_relevance?: boolean;

  /** Include disambiguation suggestions when results are ambiguous */
  include_suggestions?: boolean;

  // Future: spatial constraint for position-based queries
  // spatial?: SpatialConstraint;
}

// ============================================================================
// Response Schema
// ============================================================================

/**
 * Reason why a node matched the query
 */
export interface MatchReason {
  /** Type of match criterion */
  type: 'kind' | 'label' | 'region' | 'state' | 'group' | 'heading';
  /** Human-readable description */
  description: string;
  /** How much this criterion contributed to relevance (0-1) */
  score_contribution: number;
}

/**
 * A matched node from the query
 */
export interface MatchedNode {
  /** The matched node */
  node: ReadableNode;
  /** Relevance score (0-1, 1 = perfect match) */
  relevance?: number;
  /** Explanations for why this node matched */
  match_reasons?: MatchReason[];
}

/**
 * Query execution statistics
 */
export interface QueryStats {
  /** Total nodes that passed all filters (before limit) */
  total_matched: number;
  /** Query execution time in milliseconds */
  query_time_ms: number;
  /** Number of nodes evaluated */
  nodes_evaluated: number;
}

/**
 * Disambiguation suggestion when query is ambiguous
 */
export interface DisambiguationSuggestion {
  /** Type of refinement suggested */
  type: 'refine_kind' | 'refine_region' | 'refine_label' | 'add_state' | 'refine_group';
  /** Human-readable suggestion message */
  message: string;
  /** Query refinement to apply */
  refinement: Partial<FindElementsRequest>;
  /** How many matches this refinement would reduce to */
  expected_matches: number;
}

/**
 * Response from find elements query
 */
export interface FindElementsResponse {
  /** Matched nodes (limited by request.limit) */
  matches: MatchedNode[];
  /** Query execution statistics */
  stats: QueryStats;
  /** Disambiguation suggestions when query matches multiple similar elements */
  suggestions?: DisambiguationSuggestion[];
}

// ============================================================================
// Future Types (Placeholders)
// ============================================================================

// /**
//  * Spatial constraint for position-based queries
//  */
// export interface SpatialConstraint {
//   nearNodeId?: string;
//   nearBbox?: BBox;
//   maxDistance?: number;
// }
