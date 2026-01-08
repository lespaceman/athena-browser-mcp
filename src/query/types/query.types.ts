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
 * Future: add 'fuzzy' | 'semantic' modes
 */
export type TextMatchMode = 'exact' | 'contains';

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

  // Future: spatial constraint for position-based queries
  // spatial?: SpatialConstraint;

  // Future: minimum relevance score (0-1)
  // min_score?: number;
}

// ============================================================================
// Response Schema
// ============================================================================

/**
 * A matched node from the query
 */
export interface MatchedNode {
  /** The matched node */
  node: ReadableNode;

  // Future: relevance score (0-1)
  // relevance?: number;

  // Future: explanations for why this node matched
  // why?: MatchReason[];
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
 * Response from find elements query
 */
export interface FindElementsResponse {
  /** Matched nodes (limited by request.limit) */
  matches: MatchedNode[];
  /** Query execution statistics */
  stats: QueryStats;

  // Future: disambiguation suggestions if query is ambiguous
  // suggestions?: DisambiguationSuggestion[];
}

// ============================================================================
// Future Types (Placeholders)
// ============================================================================

// /**
//  * Reason why a node matched the query
//  */
// export interface MatchReason {
//   type: 'kind' | 'label' | 'region' | 'state' | 'group' | 'heading' | 'spatial';
//   description: string;
//   score_contribution: number;
// }

// /**
//  * Disambiguation suggestion when query is ambiguous
//  */
// export interface DisambiguationSuggestion {
//   type: 'refine_kind' | 'refine_region' | 'refine_label' | 'add_state';
//   message: string;
//   refinement: Partial<FindElementsRequest>;
// }

// /**
//  * Spatial constraint for position-based queries
//  */
// export interface SpatialConstraint {
//   nearNodeId?: string;
//   nearBbox?: BBox;
//   maxDistance?: number;
// }
