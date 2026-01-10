/**
 * Action Selector
 *
 * Selects and scores key actions from a BaseSnapshot.
 *
 * Design: Generic First, Specific Second
 * 1. Score ALL interactive elements generically (works on any page)
 * 2. Optionally categorize actions (may return 'generic')
 * 3. Select top actions above threshold
 */

import type { BaseSnapshot, ReadableNode, NodeKind, Viewport } from '../snapshot/snapshot.types.js';
import { QueryEngine } from '../query/query-engine.js';
import { normalizeText } from '../lib/text-utils.js';
import type {
  ActionSelectionResult,
  SelectedAction,
  ActionSignal,
  ActionCategory,
  DialogDetectionResult,
  FormDetectionResult,
  PageClassification,
} from './types.js';

// ============================================================================
// Scoring Configuration
// ============================================================================

/** Default options */
const DEFAULT_MAX_ACTIONS = 12;
const DEFAULT_MIN_SCORE = 0.2;

/** Interactive kinds to consider */
const INTERACTIVE_KINDS: NodeKind[] = [
  'button',
  'link',
  'input',
  'checkbox',
  'radio',
  'select',
  'combobox',
  'tab',
  'menuitem',
];

// ============================================================================
// Category Patterns
// ============================================================================

/** Patterns for cart-related actions */
const CART_PATTERNS = [
  /\badd to cart\b/i,
  /\badd to bag\b/i,
  /\badd to basket\b/i,
  /\bbuy now\b/i,
  /\bpurchase\b/i,
  /\bcheckout\b/i,
  /\bproceed to/i,
  /\bview cart\b/i,
  /\bview bag\b/i,
];

/** Patterns for auth-related actions */
const AUTH_PATTERNS = [
  /\bsign in\b/i,
  /\blog in\b/i,
  /\blogin\b/i,
  /\bsign up\b/i,
  /\bsignup\b/i,
  /\bregister\b/i,
  /\bcreate account\b/i,
  /\bsign out\b/i,
  /\blog out\b/i,
  /\blogout\b/i,
];

/** Patterns for primary CTA actions */
const PRIMARY_CTA_PATTERNS = [
  /\bsubmit\b/i,
  /\bconfirm\b/i,
  /\bcontinue\b/i,
  /\bnext\b/i,
  /\bsave\b/i,
  /\bdone\b/i,
  /\bget started\b/i,
  /\bstart\b/i,
  /\bapply\b/i,
  /\bsend\b/i,
  /\bsubscribe\b/i,
  /\bjoin\b/i,
  /\btry\b/i,
  /\bdownload\b/i,
];

/** Patterns for secondary CTA actions */
const SECONDARY_CTA_PATTERNS = [
  /\blearn more\b/i,
  /\bread more\b/i,
  /\bview\b/i,
  /\bsee\b/i,
  /\bexplore\b/i,
  /\bdiscover\b/i,
  /\bbrowse\b/i,
  /\bdetails\b/i,
  /\bmore info\b/i,
];

/** Patterns for search actions */
const SEARCH_PATTERNS = [/\bsearch\b/i, /\bfind\b/i];

/** Patterns for media control actions */
const MEDIA_PATTERNS = [/\bplay\b/i, /\bpause\b/i, /\bstop\b/i, /\bmute\b/i, /\bvolume\b/i];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if label matches any pattern.
 */
function matchesPatterns(label: string, patterns: RegExp[]): boolean {
  const normalized = normalizeText(label);
  return patterns.some((p) => p.test(normalized));
}

/**
 * Check if node is above the fold.
 */
function isAboveFold(node: ReadableNode, viewport: Viewport): boolean {
  const bbox = node.layout.bbox;
  // Consider above fold if top of element is within viewport
  return bbox.y < viewport.height && bbox.y >= 0;
}

/**
 * Calculate element area.
 */
function getElementArea(node: ReadableNode): number {
  const bbox = node.layout.bbox;
  return bbox.w * bbox.h;
}

/**
 * Categorize an action based on its label and context.
 */
function categorizeAction(
  node: ReadableNode,
  isFormSubmit: boolean,
  isInDialog: boolean
): { category: ActionCategory; confidence: number } {
  const label = node.label;

  // Check patterns in order of specificity

  // Cart actions (highest priority for commerce)
  if (matchesPatterns(label, CART_PATTERNS)) {
    return { category: 'cart-action', confidence: 0.9 };
  }

  // Auth actions
  if (matchesPatterns(label, AUTH_PATTERNS)) {
    return { category: 'auth-action', confidence: 0.85 };
  }

  // Search actions
  if (matchesPatterns(label, SEARCH_PATTERNS)) {
    return { category: 'search', confidence: 0.8 };
  }

  // Media controls
  if (matchesPatterns(label, MEDIA_PATTERNS)) {
    return { category: 'media-control', confidence: 0.85 };
  }

  // Form submit (contextual)
  if (isFormSubmit) {
    return { category: 'form-submit', confidence: 0.9 };
  }

  // Dialog action (contextual)
  if (isInDialog) {
    return { category: 'dialog-action', confidence: 0.8 };
  }

  // Primary CTA patterns
  if (matchesPatterns(label, PRIMARY_CTA_PATTERNS)) {
    return { category: 'primary-cta', confidence: 0.75 };
  }

  // Secondary CTA patterns
  if (matchesPatterns(label, SECONDARY_CTA_PATTERNS)) {
    return { category: 'secondary-cta', confidence: 0.7 };
  }

  // Navigation (links in nav region)
  if (node.kind === 'link' && (node.where.region === 'nav' || node.where.region === 'header')) {
    return { category: 'navigation', confidence: 0.7 };
  }

  // Generic fallback
  return { category: 'generic', confidence: 0.3 };
}

/**
 * Score an action based on various signals.
 */
function scoreAction(
  node: ReadableNode,
  viewport: Viewport,
  medianArea: number,
  formSubmitIds: Set<string>,
  dialogNodeIds: Set<string>
): { score: number; signals: ActionSignal[] } {
  const signals: ActionSignal[] = [];
  let score = 0;

  // Must be visible (baseline)
  if (node.state?.visible) {
    score += 0.1;
    signals.push({ type: 'visible', weight: 0.1 });
  } else {
    // Not visible - return low score
    return { score: 0, signals: [{ type: 'not-visible', weight: 0 }] };
  }

  // Enabled state
  if (node.state?.enabled ?? true) {
    score += 0.1;
    signals.push({ type: 'enabled', weight: 0.1 });
  }

  // Above fold (high value)
  if (isAboveFold(node, viewport)) {
    score += 0.25;
    signals.push({ type: 'above-fold', weight: 0.25 });
  }

  // Main region
  if (node.where.region === 'main') {
    score += 0.15;
    signals.push({ type: 'main-region', weight: 0.15 });
  } else if (node.where.region === 'header') {
    score += 0.1;
    signals.push({ type: 'header-region', weight: 0.1 });
  }

  // Button kind (usually more important than links)
  if (node.kind === 'button') {
    score += 0.15;
    signals.push({ type: 'button-kind', weight: 0.15 });
  }

  // Has meaningful label
  if (node.label && node.label.trim().length > 0) {
    score += 0.1;
    signals.push({ type: 'has-label', weight: 0.1 });

    // Action verb in label
    const label = normalizeText(node.label);
    if (
      matchesPatterns(label, PRIMARY_CTA_PATTERNS) ||
      matchesPatterns(label, CART_PATTERNS) ||
      matchesPatterns(label, AUTH_PATTERNS)
    ) {
      score += 0.15;
      signals.push({ type: 'action-verb', weight: 0.15 });
    }
  }

  // Large element (above median)
  const area = getElementArea(node);
  if (area > medianArea) {
    score += 0.1;
    signals.push({ type: 'large-element', weight: 0.1 });
  }

  // Form submit button bonus
  if (formSubmitIds.has(node.node_id)) {
    score += 0.2;
    signals.push({ type: 'form-submit', weight: 0.2 });
  }

  // Dialog action bonus
  if (dialogNodeIds.has(node.node_id)) {
    score += 0.15;
    signals.push({ type: 'dialog-action', weight: 0.15 });
  }

  return { score, signals };
}

/**
 * Calculate median element area from nodes.
 */
function calculateMedianArea(nodes: ReadableNode[]): number {
  const areas = nodes.map(getElementArea).sort((a, b) => a - b);
  if (areas.length === 0) return 0;
  const mid = Math.floor(areas.length / 2);
  return areas.length % 2 !== 0 ? areas[mid] : (areas[mid - 1] + areas[mid]) / 2;
}

/**
 * Collect form submit button IDs.
 */
function collectFormSubmitIds(formResult?: FormDetectionResult): Set<string> {
  const ids = new Set<string>();
  if (formResult) {
    for (const form of formResult.forms) {
      if (form.submit_button) {
        ids.add(form.submit_button.node_id);
      }
    }
  }
  return ids;
}

/**
 * Collect dialog action node IDs.
 */
function collectDialogNodeIds(dialogResult?: DialogDetectionResult): Set<string> {
  const ids = new Set<string>();
  if (dialogResult) {
    for (const dialog of dialogResult.dialogs) {
      for (const action of dialog.actions) {
        ids.add(action.node_id);
      }
    }
  }
  return ids;
}

// ============================================================================
// Main Selection Function
// ============================================================================

/**
 * Options for action selection.
 */
export interface ActionSelectionOptions {
  /** Max actions to return (default: 12) */
  max_actions?: number;

  /** Min score threshold (default: 0.2) */
  min_action_score?: number;

  /** Form detection result for context */
  forms?: FormDetectionResult;

  /** Dialog detection result for context */
  dialogs?: DialogDetectionResult;

  /** Page classification for context */
  pageType?: PageClassification;
}

/**
 * Select key actions from a BaseSnapshot.
 *
 * @param snapshot - The snapshot to analyze
 * @param options - Selection options
 * @returns Selection result with top actions and metadata
 */
export function selectKeyActions(
  snapshot: BaseSnapshot,
  options: ActionSelectionOptions = {}
): ActionSelectionResult {
  const startTime = performance.now();
  const engine = new QueryEngine(snapshot);

  const maxActions = options.max_actions ?? DEFAULT_MAX_ACTIONS;
  const minScore = options.min_action_score ?? DEFAULT_MIN_SCORE;

  // Collect context
  const formSubmitIds = collectFormSubmitIds(options.forms);
  const dialogNodeIds = collectDialogNodeIds(options.dialogs);

  // Step 1: Collect all interactive candidates
  const candidates: ReadableNode[] = [];
  for (const kind of INTERACTIVE_KINDS) {
    const matches = engine.find({
      kind,
      state: { visible: true },
      limit: 100,
    });
    candidates.push(...matches.matches.map((m) => m.node));
  }

  // Deduplicate (in case of overlapping queries)
  const seenIds = new Set<string>();
  const uniqueCandidates = candidates.filter((node) => {
    if (seenIds.has(node.node_id)) return false;
    seenIds.add(node.node_id);
    return true;
  });

  // Step 2: Calculate median area for scoring
  const medianArea = calculateMedianArea(uniqueCandidates);

  // Step 3: Score each candidate
  const scored: {
    node: ReadableNode;
    score: number;
    signals: ActionSignal[];
    category: ActionCategory;
    categoryConfidence: number;
  }[] = [];

  for (const node of uniqueCandidates) {
    const { score, signals } = scoreAction(
      node,
      snapshot.viewport,
      medianArea,
      formSubmitIds,
      dialogNodeIds
    );

    // Skip below threshold
    if (score < minScore) continue;

    const isFormSubmit = formSubmitIds.has(node.node_id);
    const isInDialog = dialogNodeIds.has(node.node_id);
    const { category, confidence: categoryConfidence } = categorizeAction(
      node,
      isFormSubmit,
      isInDialog
    );

    scored.push({
      node,
      score,
      signals,
      category,
      categoryConfidence,
    });
  }

  // Step 4: Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Step 5: Select top actions
  const topScored = scored.slice(0, maxActions);

  // Step 6: Build result
  const actions: SelectedAction[] = topScored.map((item) => ({
    node_id: item.node.node_id,
    backend_node_id: item.node.backend_node_id,
    label: item.node.label,
    kind: item.node.kind,
    region: item.node.where.region,
    locator: item.node.find?.primary ?? '',
    enabled: item.node.state?.enabled ?? true,
    score: item.score,
    signals: item.signals,
    category: item.category,
    category_confidence: item.categoryConfidence,
  }));

  // Step 7: Identify primary CTA
  let primaryCta: SelectedAction | undefined;
  const ctaCategories: ActionCategory[] = [
    'primary-cta',
    'cart-action',
    'form-submit',
    'auth-action',
  ];

  for (const action of actions) {
    if (ctaCategories.includes(action.category)) {
      primaryCta = action;
      break;
    }
  }

  // If no specific CTA found, use highest-scored button
  primaryCta ??= actions.find((a) => a.kind === 'button');

  const selectionTimeMs = performance.now() - startTime;

  return {
    actions,
    primary_cta: primaryCta,
    meta: {
      candidates_evaluated: uniqueCandidates.length,
      selection_time_ms: selectionTimeMs,
    },
  };
}
