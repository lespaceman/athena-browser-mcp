/**
 * Dialog Detector
 *
 * Detects dialogs/modals in a BaseSnapshot.
 *
 * Design: Generic First, Specific Second
 * 1. Detect ALL visible dialogs (always works)
 * 2. Optionally classify type (may return 'unknown')
 */

import type { BaseSnapshot, ReadableNode } from '../snapshot/snapshot.types.js';
import { QueryEngine } from '../query/query-engine.js';
import { normalizeText } from '../lib/text-utils.js';
import type {
  DialogDetectionResult,
  DetectedDialog,
  DialogAction,
  DialogActionRole,
  DialogType,
  DialogDetectionMethod,
} from './types.js';

// ============================================================================
// Classification Patterns
// ============================================================================

/** Patterns for cookie consent dialogs */
const COOKIE_PATTERNS = [
  /\bcookie/i,
  /\bconsent/i,
  /\baccept all/i,
  /\bprivacy policy/i,
  /\bprivacy settings/i,
  /\bmanage cookies/i,
  /\bgdpr/i,
  /\bccpa/i,
];

/** Patterns for newsletter dialogs */
const NEWSLETTER_PATTERNS = [
  /\bsubscribe/i,
  /\bnewsletter/i,
  /\bemail updates/i,
  /\bsign up for/i,
  /\bstay (in )?touch/i,
  /\bjoin our/i,
];

/** Patterns for age gate dialogs */
const AGE_GATE_PATTERNS = [
  /\bage verification/i,
  /\b21\+/i,
  /\b18\+/i,
  /\bverify (your )?age/i,
  /\bare you (over|at least)/i,
  /\bdate of birth/i,
];

/** Patterns for login prompt dialogs */
const LOGIN_PATTERNS = [
  /\bsign in/i,
  /\blog in/i,
  /\bpassword/i,
  /\bauthenticate/i,
  /\benter your credentials/i,
];

/** Patterns for primary action buttons */
const PRIMARY_ACTION_PATTERNS = [
  /\baccept/i,
  /\bagree/i,
  /\bconfirm/i,
  /\bsubmit/i,
  /\bcontinue/i,
  /\bok\b/i,
  /\byes/i,
  /\bsave/i,
  /\bdone/i,
];

/** Patterns for secondary action buttons */
const SECONDARY_ACTION_PATTERNS = [
  /\bdecline/i,
  /\breject/i,
  /\bno thanks/i,
  /\bno\b/i,
  /\bcancel/i,
  /\bskip/i,
  /\blater/i,
  /\bnot now/i,
];

/** Patterns for dismiss buttons */
const DISMISS_PATTERNS = [/\bclose/i, /\bdismiss/i, /\b[x×]\b/i, /^x$/i];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if text matches any pattern in the list.
 */
function matchesPatterns(text: string, patterns: RegExp[]): boolean {
  const normalized = normalizeText(text);
  return patterns.some((pattern) => pattern.test(normalized));
}

/**
 * Count pattern matches in text.
 */
function countPatternMatches(text: string, patterns: RegExp[]): number {
  const normalized = normalizeText(text);
  return patterns.filter((pattern) => pattern.test(normalized)).length;
}

/**
 * Determine detection method from node attributes.
 */
function getDetectionMethod(node: ReadableNode): DialogDetectionMethod {
  const role = node.attributes?.role?.toLowerCase();

  if (role === 'alertdialog') {
    return 'role-alertdialog';
  }

  if (role === 'dialog') {
    return 'role-dialog';
  }

  // Check if it's an HTML dialog element (kind will be 'dialog')
  if (node.kind === 'dialog') {
    // Could be role or HTML - default to role-dialog if role attr present
    if (role) {
      return 'role-dialog';
    }
    return 'html-dialog';
  }

  return 'heuristic';
}

/**
 * Determine action role from label.
 */
function classifyActionRole(label: string): DialogActionRole {
  if (matchesPatterns(label, DISMISS_PATTERNS)) {
    return 'dismiss';
  }
  if (matchesPatterns(label, PRIMARY_ACTION_PATTERNS)) {
    return 'primary';
  }
  if (matchesPatterns(label, SECONDARY_ACTION_PATTERNS)) {
    return 'secondary';
  }
  return 'unknown';
}

/**
 * Extract dialog title from nearby heading context or first heading-like element.
 */
function extractDialogTitle(dialogNode: ReadableNode, engine: QueryEngine): string | undefined {
  // First try heading context
  if (dialogNode.where.heading_context) {
    return dialogNode.where.heading_context;
  }

  // Look for headings in the dialog's group
  if (dialogNode.where.group_id) {
    const headings = engine.find({
      kind: 'heading',
      group_id: dialogNode.where.group_id,
      limit: 1,
    });
    if (headings.matches.length > 0) {
      return headings.matches[0].node.label;
    }
  }

  return undefined;
}

/**
 * Find interactive actions within a dialog.
 */
function extractDialogActions(dialogNode: ReadableNode, engine: QueryEngine): DialogAction[] {
  const actions: DialogAction[] = [];

  // Find buttons and links in the same group or region as the dialog
  const interactiveKinds = ['button', 'link'] as const;

  for (const kind of interactiveKinds) {
    // Try by group_id first
    if (dialogNode.where.group_id) {
      const matches = engine.find({
        kind,
        group_id: dialogNode.where.group_id,
        state: { visible: true },
        limit: 10,
      });

      for (const match of matches.matches) {
        const node = match.node;
        if (node.node_id === dialogNode.node_id) continue; // Skip the dialog itself

        actions.push({
          node_id: node.node_id,
          backend_node_id: node.backend_node_id,
          label: node.label,
          role: classifyActionRole(node.label),
          kind: node.kind,
        });
      }
    }

    // If no group_id or few results, try by region
    if (actions.length < 2 && dialogNode.where.region === 'dialog') {
      const regionMatches = engine.find({
        kind,
        region: 'dialog',
        state: { visible: true },
        limit: 10,
      });

      for (const match of regionMatches.matches) {
        const node = match.node;
        // Avoid duplicates
        if (actions.some((a) => a.node_id === node.node_id)) continue;
        if (node.node_id === dialogNode.node_id) continue;

        actions.push({
          node_id: node.node_id,
          backend_node_id: node.backend_node_id,
          label: node.label,
          role: classifyActionRole(node.label),
          kind: node.kind,
        });
      }
    }
  }

  // Sort: primary first, then secondary, then dismiss, then unknown
  const roleOrder: Record<DialogActionRole, number> = {
    primary: 0,
    secondary: 1,
    dismiss: 2,
    unknown: 3,
  };

  actions.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

  return actions;
}

/**
 * Collect all text content from dialog for pattern matching.
 */
function collectDialogText(dialogNode: ReadableNode, actions: DialogAction[]): string {
  const parts: string[] = [];

  if (dialogNode.label) {
    parts.push(dialogNode.label);
  }

  if (dialogNode.where.heading_context) {
    parts.push(dialogNode.where.heading_context);
  }

  for (const action of actions) {
    if (action.label) {
      parts.push(action.label);
    }
  }

  return parts.join(' ');
}

/**
 * Classify dialog type based on content patterns.
 * Returns 'unknown' with low confidence if no patterns match.
 */
function classifyDialogType(
  dialogNode: ReadableNode,
  dialogText: string,
  detectionMethod: DialogDetectionMethod
): { type: DialogType; confidence: number; signals: string[] } {
  const signals: string[] = [];
  let type: DialogType = 'unknown';
  let confidence = 0.3; // Default low confidence for unknown

  // Check for alertdialog role first
  if (detectionMethod === 'role-alertdialog') {
    type = 'alert';
    confidence = 0.9;
    signals.push('role-alertdialog');
    return { type, confidence, signals };
  }

  // Count pattern matches for each type
  const cookieMatches = countPatternMatches(dialogText, COOKIE_PATTERNS);
  const newsletterMatches = countPatternMatches(dialogText, NEWSLETTER_PATTERNS);
  const ageGateMatches = countPatternMatches(dialogText, AGE_GATE_PATTERNS);
  const loginMatches = countPatternMatches(dialogText, LOGIN_PATTERNS);

  // Find best match (require at least 2 pattern matches for classification)
  const matches: { type: DialogType; count: number; patterns: string }[] = [
    { type: 'cookie-consent', count: cookieMatches, patterns: 'cookie-patterns' },
    { type: 'newsletter', count: newsletterMatches, patterns: 'newsletter-patterns' },
    { type: 'age-gate', count: ageGateMatches, patterns: 'age-gate-patterns' },
    { type: 'login-prompt', count: loginMatches, patterns: 'login-patterns' },
  ];

  matches.sort((a, b) => b.count - a.count);

  if (matches[0].count >= 2) {
    type = matches[0].type;
    // Confidence based on match count
    confidence = Math.min(0.95, 0.6 + matches[0].count * 0.1);
    signals.push(`${matches[0].patterns}:${matches[0].count}`);
  } else if (matches[0].count === 1) {
    // Single match - still set type but with low confidence
    type = matches[0].type;
    confidence = 0.5;
    signals.push(`${matches[0].patterns}:1:weak`);
  } else {
    // No patterns matched - could be generic modal or confirm
    type = 'modal';
    confidence = 0.4;
    signals.push('no-pattern-match');
  }

  return { type, confidence, signals };
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect dialogs in a BaseSnapshot.
 *
 * @param snapshot - The snapshot to analyze
 * @returns Detection result with all dialogs and metadata
 */
export function detectDialogs(snapshot: BaseSnapshot): DialogDetectionResult {
  const startTime = performance.now();
  const engine = new QueryEngine(snapshot);

  // Step 1: Find ALL dialog nodes (generic detection)
  // Query by kind='dialog' and region='dialog'
  const dialogByKind = engine.find({
    kind: 'dialog',
    state: { visible: true },
    limit: 50,
  });

  const dialogByRegion = engine.find({
    region: 'dialog',
    state: { visible: true },
    limit: 50,
  });

  // Combine and deduplicate
  const seenIds = new Set<string>();
  const allDialogNodes: ReadableNode[] = [];

  for (const match of dialogByKind.matches) {
    if (!seenIds.has(match.node.node_id)) {
      seenIds.add(match.node.node_id);
      allDialogNodes.push(match.node);
    }
  }

  for (const match of dialogByRegion.matches) {
    if (!seenIds.has(match.node.node_id)) {
      seenIds.add(match.node.node_id);
      allDialogNodes.push(match.node);
    }
  }

  // Step 2: For each dialog, extract info and classify
  const dialogs: DetectedDialog[] = [];

  for (const dialogNode of allDialogNodes) {
    const detectionMethod = getDetectionMethod(dialogNode);
    const title = extractDialogTitle(dialogNode, engine);
    const actions = extractDialogActions(dialogNode, engine);
    const dialogText = collectDialogText(dialogNode, actions);

    const classification = classifyDialogType(dialogNode, dialogText, detectionMethod);

    // Determine if modal (alertdialog or has aria-modal)
    const isModal =
      detectionMethod === 'role-alertdialog' || dialogNode.attributes?.role === 'alertdialog';

    dialogs.push({
      node_id: dialogNode.node_id,
      backend_node_id: dialogNode.backend_node_id,
      bbox: dialogNode.layout.bbox,
      is_modal: isModal,
      title,
      actions,
      detection_method: detectionMethod,
      type: classification.type,
      type_confidence: classification.confidence,
      classification_signals: classification.signals,
    });
  }

  const detectionTimeMs = performance.now() - startTime;

  return {
    dialogs,
    has_blocking_dialog: dialogs.some((d) => d.is_modal),
    meta: {
      total_detected: dialogs.length,
      classified_count: dialogs.filter((d) => d.type !== 'unknown').length,
      detection_time_ms: detectionTimeMs,
    },
  };
}
