/**
 * Element Scoring and Ranking Engine
 *
 * Multi-signal scoring system for ranking discovered elements
 * by relevance to user intent.
 */

export type RankingMode = 'balanced' | 'semantic-first' | 'visual-first';

export interface ScoringSignals {
  role?: string;
  hasName: boolean;
  hasLabel: boolean;
  hasCssSelector: boolean;
  hasXpathSelector: boolean;
  hasAxSelector: boolean;
  bboxArea: number;
}

export interface ScoredCandidate<T> {
  item: T;
  relevance: number;
  signals: ScoringSignals;
}

export interface ScoreOptions {
  /** Filter/prioritize by ARIA roles */
  roles?: string[];
  /** Ranking strategy */
  rankingMode?: RankingMode;
}

/**
 * Score an element based on multiple signals
 */
export function scoreElement<T>(
  item: T,
  getRole: (item: T) => string | undefined,
  getName: (item: T) => string | undefined,
  getLabel: (item: T) => string | undefined,
  getSelectors: (item: T) => { css?: string; xpath?: string; ax?: string },
  getBbox: (item: T) => { w: number; h: number } | undefined,
  options: ScoreOptions = {}
): ScoredCandidate<T> {
  const normalizedRoles = (options.roles ?? []).map((role) => role.toLowerCase());
  const rankingMode = options.rankingMode ?? 'balanced';

  let relevance = 0;
  const role = getRole(item)?.toLowerCase();

  // Role matching
  if (normalizedRoles.length === 0 && role) {
    relevance += 0.5; // Any role is a positive signal
  }
  if (role && normalizedRoles.includes(role)) {
    relevance += 2; // Exact role match is strong
  }

  // Name/label presence and length
  const name = getName(item);
  const label = getLabel(item);
  const nameLen = name?.trim().length ?? 0;
  const labelLen = label?.trim().length ?? 0;

  if (nameLen > 0) relevance += Math.min(1.5, nameLen / 20);
  if (labelLen > 0) relevance += Math.min(1, labelLen / 30);

  // Selector availability
  const selectors = getSelectors(item);
  if (selectors.css) relevance += 0.3;
  if (selectors.xpath) relevance += 0.2;
  if (selectors.ax) relevance += 0.1;

  // Ranking mode boosts
  if (rankingMode === 'semantic-first' && role) relevance += 0.5;
  const bbox = getBbox(item);
  if (rankingMode === 'visual-first' && bbox) relevance += 0.5;

  return {
    item,
    relevance,
    signals: {
      role: role ?? 'unknown',
      hasName: nameLen > 0,
      hasLabel: labelLen > 0,
      hasCssSelector: Boolean(selectors.css),
      hasXpathSelector: Boolean(selectors.xpath),
      hasAxSelector: Boolean(selectors.ax),
      bboxArea: bbox ? bbox.w * bbox.h : 0,
    },
  };
}

/**
 * Deduplicate scored candidates by a key function
 */
export function dedupeByKey<T>(
  candidates: ScoredCandidate<T>[],
  getKey: (item: T) => string
): ScoredCandidate<T>[] {
  const seen = new Map<string, ScoredCandidate<T>>();

  for (const candidate of candidates) {
    const key = getKey(candidate.item);
    const existing = seen.get(key);
    if (!existing || candidate.relevance > existing.relevance) {
      seen.set(key, candidate);
    }
  }

  return Array.from(seen.values());
}

/**
 * Rank candidates by relevance (descending)
 */
export function rankByRelevance<T>(candidates: ScoredCandidate<T>[]): ScoredCandidate<T>[] {
  return [...candidates].sort((a, b) => b.relevance - a.relevance);
}
