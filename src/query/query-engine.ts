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

import type {
  BaseSnapshot,
  ReadableNode,
  NodeKind,
  SemanticRegion,
} from '../snapshot/snapshot.types.js';
import type {
  FindElementsRequest,
  FindElementsResponse,
  MatchedNode,
  MatchReason,
  DisambiguationSuggestion,
  LabelFilter,
  StateConstraint,
  TextMatchMode,
  FuzzyMatchOptions,
} from './types/query.types.js';
import { normalizeText, tokenizeForMatching, fuzzyTokensMatch } from '../lib/text-utils.js';

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
 * Scoring weights for relevance calculation.
 * Values represent the maximum contribution each signal can add to the score.
 */
const SCORING_WEIGHTS = {
  labelMatch: {
    exact: 0.4,
    contains: 0.3,
    fuzzy: 0.25, // Base, multiplied by fuzzy match quality
  },
  kindMatch: 0.15,
  regionMatch: 0.12,
  stateMatch: 0.03, // Per matching state property (max ~0.27 for 9 props)
  groupMatch: 0.08,
  headingMatch: 0.08,
  visibility: 0.02,
} as const;

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
    let labelScores: Map<string, number> | undefined;

    // Apply filters in order of expected selectivity (most selective first)

    // Filter by kind
    if (request.kind !== undefined) {
      candidates = this.filterByKind(candidates, request.kind);
    }

    // Filter by label (with fuzzy support)
    if (request.label !== undefined) {
      const { mode, text, caseSensitive, fuzzyOptions } = this.normalizeLabelFilter(request.label);

      if (mode === 'fuzzy') {
        const result = this.filterByLabelFuzzy(candidates, text, caseSensitive, fuzzyOptions);
        candidates = result.nodes;
        labelScores = result.scores;
      } else {
        candidates = this.filterByLabel(candidates, request.label);
      }
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

    // Score all candidates
    const scoredMatches: MatchedNode[] = candidates.map((node) => {
      const { relevance, reasons } = this.scoreMatch(node, request, labelScores?.get(node.node_id));
      return { node, relevance, match_reasons: reasons };
    });

    // Apply min_score filter
    let filteredMatches = scoredMatches;
    if (request.min_score !== undefined) {
      filteredMatches = scoredMatches.filter((m) => (m.relevance ?? 0) >= request.min_score!);
    }

    // Sort by relevance if requested
    if (request.sort_by_relevance) {
      filteredMatches.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
    }

    // Record total before applying limit
    const totalMatched = filteredMatches.length;

    // Apply limit
    const limitedMatches = filteredMatches.slice(0, limit);

    // Generate suggestions if requested and results are ambiguous
    let suggestions: DisambiguationSuggestion[] | undefined;
    if (request.include_suggestions && totalMatched > 1) {
      suggestions = this.generateSuggestions(limitedMatches, request);
      if (suggestions.length === 0) suggestions = undefined;
    }

    return {
      matches: limitedMatches,
      stats: {
        total_matched: totalMatched,
        query_time_ms: performance.now() - startTime,
        nodes_evaluated: this.snapshot.nodes.length,
      },
      suggestions,
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
    fuzzyOptions?: FuzzyMatchOptions;
  } {
    if (typeof filter === 'string') {
      return { text: filter, mode: 'contains', caseSensitive: false };
    }
    return {
      text: filter.text,
      mode: filter.mode ?? 'contains',
      caseSensitive: filter.caseSensitive ?? false,
      fuzzyOptions: filter.fuzzyOptions,
    };
  }

  // ===========================================================================
  // Fuzzy Matching
  // ===========================================================================

  /**
   * Filter nodes by fuzzy label matching.
   * Returns matched nodes and a map of node_id -> match score for relevance calculation.
   */
  private filterByLabelFuzzy(
    nodes: ReadableNode[],
    text: string,
    caseSensitive: boolean,
    options: FuzzyMatchOptions = {}
  ): { nodes: ReadableNode[]; scores: Map<string, number> } {
    const scores = new Map<string, number>();
    const normalizedQuery = normalizeText(caseSensitive ? text : text.toLowerCase());
    const queryTokens = tokenizeForMatching(normalizedQuery, 10, 2);

    if (queryTokens.length === 0) {
      return { nodes: [], scores };
    }

    const matched = nodes.filter((n) => {
      const normalizedLabel = normalizeText(caseSensitive ? n.label : n.label.toLowerCase());
      const labelTokens = tokenizeForMatching(normalizedLabel, 10, 2);

      const result = fuzzyTokensMatch(labelTokens, queryTokens, {
        minTokenOverlap: options.minTokenOverlap ?? 0.5,
        prefixMatch: options.prefixMatch ?? true,
        minSimilarity: options.minSimilarity ?? 0.8,
      });

      if (result.isMatch) {
        scores.set(n.node_id, result.score);
      }
      return result.isMatch;
    });

    return { nodes: matched, scores };
  }

  // ===========================================================================
  // Relevance Scoring
  // ===========================================================================

  /**
   * Calculate relevance score and match reasons for a node.
   *
   * @param node - The node to score
   * @param request - The original query request
   * @param labelMatchScore - Pre-computed label match score (for fuzzy matching)
   * @returns Relevance score (0-1) and list of reasons
   */
  private scoreMatch(
    node: ReadableNode,
    request: FindElementsRequest,
    labelMatchScore?: number
  ): { relevance: number; reasons: MatchReason[] } {
    let relevance = 0;
    const reasons: MatchReason[] = [];

    // Label scoring
    if (request.label !== undefined) {
      const { mode } = this.normalizeLabelFilter(request.label);
      let labelContribution: number;

      if (mode === 'fuzzy' && labelMatchScore !== undefined) {
        // Fuzzy: base weight * match quality
        labelContribution = SCORING_WEIGHTS.labelMatch.fuzzy * labelMatchScore;
      } else if (mode === 'exact') {
        labelContribution = SCORING_WEIGHTS.labelMatch.exact;
      } else {
        labelContribution = SCORING_WEIGHTS.labelMatch.contains;
      }

      relevance += labelContribution;
      reasons.push({
        type: 'label',
        description: `Label "${this.truncateLabel(node.label)}" matches query`,
        score_contribution: labelContribution,
      });
    }

    // Kind scoring
    if (request.kind !== undefined) {
      relevance += SCORING_WEIGHTS.kindMatch;
      reasons.push({
        type: 'kind',
        description: `Kind "${node.kind}" matches filter`,
        score_contribution: SCORING_WEIGHTS.kindMatch,
      });
    }

    // Region scoring
    if (request.region !== undefined) {
      relevance += SCORING_WEIGHTS.regionMatch;
      reasons.push({
        type: 'region',
        description: `Region "${node.where.region}" matches filter`,
        score_contribution: SCORING_WEIGHTS.regionMatch,
      });
    }

    // State scoring (per matched property)
    if (request.state !== undefined && node.state) {
      const matchedStates = Object.keys(request.state).filter(
        (k) =>
          request.state![k as keyof StateConstraint] !== undefined &&
          request.state![k as keyof StateConstraint] === node.state![k as keyof StateConstraint]
      );
      const stateContribution = matchedStates.length * SCORING_WEIGHTS.stateMatch;
      if (stateContribution > 0) {
        relevance += stateContribution;
        reasons.push({
          type: 'state',
          description: `States match: ${matchedStates.join(', ')}`,
          score_contribution: stateContribution,
        });
      }
    }

    // Group scoring
    if (request.group_id !== undefined) {
      relevance += SCORING_WEIGHTS.groupMatch;
      reasons.push({
        type: 'group',
        description: `Group "${node.where.group_id}" matches`,
        score_contribution: SCORING_WEIGHTS.groupMatch,
      });
    }

    // Heading context scoring
    if (request.heading_context !== undefined) {
      relevance += SCORING_WEIGHTS.headingMatch;
      reasons.push({
        type: 'heading',
        description: `Heading context "${node.where.heading_context}" matches`,
        score_contribution: SCORING_WEIGHTS.headingMatch,
      });
    }

    // Visibility bonus (always applied if node is visible)
    if (node.state?.visible) {
      relevance += SCORING_WEIGHTS.visibility;
    }

    // Normalize to 0-1 range based on what was actually queried
    // This gives higher scores when fewer filters are used but all match
    const maxPossible = this.calculateMaxPossibleScore(request);
    const normalizedRelevance = maxPossible > 0 ? Math.min(1, relevance / maxPossible) : 0;

    return { relevance: normalizedRelevance, reasons };
  }

  /**
   * Calculate the maximum possible score given the request filters.
   */
  private calculateMaxPossibleScore(request: FindElementsRequest): number {
    let max = SCORING_WEIGHTS.visibility; // Always possible

    if (request.label !== undefined) {
      const { mode } = this.normalizeLabelFilter(request.label);
      max += SCORING_WEIGHTS.labelMatch[mode];
    }
    if (request.kind !== undefined) max += SCORING_WEIGHTS.kindMatch;
    if (request.region !== undefined) max += SCORING_WEIGHTS.regionMatch;
    if (request.state !== undefined) {
      const stateCount = Object.keys(request.state).filter(
        (k) => request.state![k as keyof StateConstraint] !== undefined
      ).length;
      max += stateCount * SCORING_WEIGHTS.stateMatch;
    }
    if (request.group_id !== undefined) max += SCORING_WEIGHTS.groupMatch;
    if (request.heading_context !== undefined) max += SCORING_WEIGHTS.headingMatch;

    return max;
  }

  /**
   * Truncate a label for display in reasons.
   */
  private truncateLabel(label: string, maxLength = 30): string {
    if (label.length <= maxLength) return label;
    return label.slice(0, maxLength - 1) + '…';
  }

  // ===========================================================================
  // Disambiguation Suggestions
  // ===========================================================================

  /**
   * Generate disambiguation suggestions when query matches multiple elements.
   * Suggests refinements that would narrow down the results.
   */
  private generateSuggestions(
    matches: MatchedNode[],
    request: FindElementsRequest
  ): DisambiguationSuggestion[] {
    const suggestions: DisambiguationSuggestion[] = [];
    const nodes = matches.map((m) => m.node);

    // Only generate suggestions if we have multiple matches
    if (matches.length < 2) return suggestions;

    // 1. Suggest refining by kind if matches have different kinds
    if (request.kind === undefined) {
      const kindCounts = this.countByAttribute(nodes, (n) => n.kind);
      if (kindCounts.size > 1) {
        for (const [kind, count] of kindCounts) {
          if (count < matches.length) {
            suggestions.push({
              type: 'refine_kind',
              message: `Add kind: "${kind}" to narrow to ${count} result(s)`,
              refinement: { kind },
              expected_matches: count,
            });
          }
        }
      }
    }

    // 2. Suggest refining by region if matches span multiple regions
    if (request.region === undefined) {
      const regionCounts = this.countByAttribute(nodes, (n) => n.where.region);
      if (regionCounts.size > 1) {
        for (const [region, count] of regionCounts) {
          if (count < matches.length && region !== 'unknown') {
            suggestions.push({
              type: 'refine_region',
              message: `Add region: "${region}" to narrow to ${count} result(s)`,
              refinement: { region },
              expected_matches: count,
            });
          }
        }
      }
    }

    // 3. Suggest refining by group_id if matches have different groups
    if (request.group_id === undefined) {
      const groupCounts = this.countByAttribute(nodes, (n) => n.where.group_id);
      groupCounts.delete(undefined); // Remove nodes without groups
      if (groupCounts.size >= 1) {
        for (const [groupId, count] of groupCounts) {
          if (groupId !== undefined) {
            suggestions.push({
              type: 'refine_group',
              message: `Add group_id: "${groupId}" to narrow to ${count} result(s)`,
              refinement: { group_id: groupId },
              expected_matches: count,
            });
          }
        }
      }
    }

    // 4. Suggest adding state filters
    if (request.state === undefined) {
      const enabledCount = nodes.filter((n) => n.state?.enabled).length;
      if (enabledCount > 0 && enabledCount < matches.length) {
        suggestions.push({
          type: 'add_state',
          message: `Add state: { enabled: true } to narrow to ${enabledCount} result(s)`,
          refinement: { state: { enabled: true } },
          expected_matches: enabledCount,
        });
      }

      const visibleCount = nodes.filter((n) => n.state?.visible).length;
      if (visibleCount > 0 && visibleCount < matches.length) {
        suggestions.push({
          type: 'add_state',
          message: `Add state: { visible: true } to narrow to ${visibleCount} result(s)`,
          refinement: { state: { visible: true } },
          expected_matches: visibleCount,
        });
      }
    }

    // 5. Suggest refining label to exact match if using contains/fuzzy
    if (request.label !== undefined) {
      const { mode, text } = this.normalizeLabelFilter(request.label);
      if (mode !== 'exact') {
        const normalizedText = normalizeText(text.toLowerCase());
        const exactCount = nodes.filter(
          (n) => normalizeText(n.label.toLowerCase()) === normalizedText
        ).length;
        if (exactCount > 0 && exactCount < matches.length) {
          suggestions.push({
            type: 'refine_label',
            message: `Use exact label match to narrow to ${exactCount} result(s)`,
            refinement: { label: { text, mode: 'exact' } },
            expected_matches: exactCount,
          });
        }
      }
    }

    // Sort by expected_matches (prefer suggestions that narrow most effectively)
    // and limit to top 5
    return suggestions
      .filter((s) => s.expected_matches > 0 && s.expected_matches < matches.length)
      .sort((a, b) => a.expected_matches - b.expected_matches)
      .slice(0, 5);
  }

  /**
   * Count nodes by a given attribute.
   */
  private countByAttribute<T>(
    nodes: ReadableNode[],
    getter: (node: ReadableNode) => T
  ): Map<T, number> {
    const counts = new Map<T, number>();
    for (const node of nodes) {
      const value = getter(node);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
  }
}
