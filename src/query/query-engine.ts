/**
 * Query Engine
 *
 * Simple filter-based engine for querying BaseSnapshot data.
 * Supports filtering by kind, label, region, state, group_id, and heading_context.
 *
 * Future enhancements:
 * - Fuzzy/semantic label matching
 * - Relevance scoring
 * - Disambiguation suggestions
 */

import type { BaseSnapshot, ReadableNode, NodeKind, SemanticRegion } from '../snapshot/snapshot.types.js';
import type {
  FindElementsRequest,
  FindElementsResponse,
  MatchedNode,
  LabelFilter,
  StateConstraint,
  TextMatchMode,
} from './types/query.types.js';
import { normalizeText } from '../lib/text-utils.js';

/**
 * Query engine options
 */
export interface QueryEngineOptions {
  /** Default limit for find() results (default: 10) */
  defaultLimit?: number;

  // Future: custom scoring weights
  // weights?: Partial<ScoringWeights>;

  // Future: build indices eagerly
  // eagerIndexing?: boolean;
}

/**
 * Query engine for BaseSnapshot data
 */
export class QueryEngine {
  private readonly snapshot: BaseSnapshot;
  private readonly nodeMap: Map<string, ReadableNode>;
  private readonly defaultLimit: number;

  /**
   * Create a query engine for a snapshot
   */
  constructor(snapshot: BaseSnapshot, options: QueryEngineOptions = {}) {
    this.snapshot = snapshot;
    this.nodeMap = new Map(snapshot.nodes.map((n) => [n.node_id, n]));
    this.defaultLimit = options.defaultLimit ?? 10;
  }

  /**
   * Find elements matching the request
   */
  find(request: FindElementsRequest = {}): FindElementsResponse {
    const startTime = performance.now();
    const limit = request.limit ?? this.defaultLimit;

    let candidates = [...this.snapshot.nodes];

    // Apply filters in order of expected selectivity (most selective first)

    // Filter by kind
    if (request.kind !== undefined) {
      candidates = this.filterByKind(candidates, request.kind);
    }

    // Filter by label
    if (request.label !== undefined) {
      candidates = this.filterByLabel(candidates, request.label);
    }

    // Filter by region
    if (request.region !== undefined) {
      candidates = this.filterByRegion(candidates, request.region);
    }

    // Filter by state
    if (request.state !== undefined) {
      candidates = this.filterByState(candidates, request.state);
    }

    // Filter by group_id (exact match)
    if (request.group_id !== undefined) {
      candidates = candidates.filter((n) => n.where.group_id === request.group_id);
    }

    // Filter by heading_context (exact match)
    if (request.heading_context !== undefined) {
      candidates = candidates.filter((n) => n.where.heading_context === request.heading_context);
    }

    // Record total before applying limit
    const totalMatched = candidates.length;

    // Apply limit
    const limitedCandidates = candidates.slice(0, limit);

    // Build response
    const matches: MatchedNode[] = limitedCandidates.map((node) => ({ node }));

    return {
      matches,
      stats: {
        total_matched: totalMatched,
        query_time_ms: performance.now() - startTime,
        nodes_evaluated: this.snapshot.nodes.length,
      },
    };
  }

  /**
   * Get a single element by node_id
   */
  getById(nodeId: string): ReadableNode | undefined {
    return this.nodeMap.get(nodeId);
  }

  /**
   * Get snapshot metadata
   */
  getSnapshotInfo(): { snapshot_id: string; node_count: number } {
    return {
      snapshot_id: this.snapshot.snapshot_id,
      node_count: this.snapshot.nodes.length,
    };
  }

  /**
   * Get all nodes (respects limit)
   */
  getAllNodes(limit?: number): ReadableNode[] {
    const effectiveLimit = limit ?? this.defaultLimit;
    return this.snapshot.nodes.slice(0, effectiveLimit);
  }

  // ===========================================================================
  // Private filter methods
  // ===========================================================================

  /**
   * Filter nodes by kind(s)
   */
  private filterByKind(nodes: ReadableNode[], kind: NodeKind | NodeKind[]): ReadableNode[] {
    const kinds = Array.isArray(kind) ? kind : [kind];
    return nodes.filter((n) => kinds.includes(n.kind));
  }

  /**
   * Filter nodes by label text
   */
  private filterByLabel(nodes: ReadableNode[], filter: string | LabelFilter): ReadableNode[] {
    const { text, mode, caseSensitive } = this.normalizeLabelFilter(filter);

    if (!text) {
      return nodes;
    }

    return nodes.filter((n) => this.matchLabel(n.label, text, mode, caseSensitive));
  }

  /**
   * Check if a label matches the search text
   */
  private matchLabel(
    label: string,
    searchText: string,
    mode: TextMatchMode,
    caseSensitive: boolean
  ): boolean {
    const normalizedLabel = normalizeText(caseSensitive ? label : label.toLowerCase());
    const normalizedSearch = normalizeText(caseSensitive ? searchText : searchText.toLowerCase());

    switch (mode) {
      case 'exact':
        return normalizedLabel === normalizedSearch;
      case 'contains':
      default:
        return normalizedLabel.includes(normalizedSearch);
    }

    // Future: fuzzy matching
    // case 'fuzzy':
    //   return fuzzyTokenMatch(normalizedLabel, normalizedSearch);
  }

  /**
   * Filter nodes by region(s)
   */
  private filterByRegion(
    nodes: ReadableNode[],
    region: SemanticRegion | SemanticRegion[]
  ): ReadableNode[] {
    const regions = Array.isArray(region) ? region : [region];
    return nodes.filter((n) => regions.includes(n.where.region));
  }

  /**
   * Filter nodes by state constraints
   */
  private filterByState(nodes: ReadableNode[], constraint: StateConstraint): ReadableNode[] {
    return nodes.filter((n) => this.matchState(n, constraint));
  }

  /**
   * Check if a node matches all state constraints
   */
  private matchState(node: ReadableNode, constraint: StateConstraint): boolean {
    // Nodes without state don't match state constraints
    if (!node.state) {
      return false;
    }

    // Check each constraint field
    for (const [key, requiredValue] of Object.entries(constraint)) {
      if (requiredValue === undefined) {
        continue;
      }

      const actualValue = node.state[key as keyof StateConstraint];

      // If the constraint is set but the node doesn't have this state property,
      // it doesn't match (unless we're checking for false and it's undefined)
      if (actualValue === undefined) {
        // undefined is treated as false for boolean constraints
        if (requiredValue === false) {
          continue;
        }
        return false;
      }

      if (actualValue !== requiredValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Normalize a label filter to its constituent parts
   */
  private normalizeLabelFilter(filter: string | LabelFilter): {
    text: string;
    mode: TextMatchMode;
    caseSensitive: boolean;
  } {
    if (typeof filter === 'string') {
      return { text: filter, mode: 'contains', caseSensitive: false };
    }
    return {
      text: filter.text,
      mode: filter.mode ?? 'contains',
      caseSensitive: filter.caseSensitive ?? false,
    };
  }

  // ===========================================================================
  // Future: Semantic search hooks
  // ===========================================================================

  // TODO: Add fuzzy matching support
  // private filterByLabelFuzzy(nodes: ReadableNode[], text: string): ReadableNode[] {
  //   return nodes.filter(n => fuzzyTokenMatch(n.label, text));
  // }

  // TODO: Add relevance scoring
  // private scoreMatch(node: ReadableNode, request: FindElementsRequest): number {
  //   // Return 0-1 relevance score based on match quality
  // }

  // TODO: Add disambiguation suggestions
  // private generateSuggestions(
  //   matches: MatchedNode[],
  //   request: FindElementsRequest
  // ): DisambiguationSuggestion[] {
  //   // Generate suggestions when query is ambiguous
  // }
}
