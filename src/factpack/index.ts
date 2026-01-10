/**
 * FactPack Module
 *
 * Extracts higher-level semantic facts from compiled BaseSnapshot.
 *
 * Design: Generic First, Specific Second
 * - All extractors return useful data even when specific patterns aren't matched
 * - 'unknown'/'generic' are valid results, not failures
 * - Confidence scores allow consumers to decide thresholds
 */

import type { BaseSnapshot } from '../snapshot/snapshot.types.js';
import { detectDialogs } from './dialog-detector.js';
import { detectForms, type FormDetectionOptions } from './form-detector.js';
import { classifyPage } from './page-classifier.js';
import { selectKeyActions, type ActionSelectionOptions } from './action-selector.js';
import type { FactPack, FactPackOptions } from './types.js';

// ============================================================================
// Orchestration
// ============================================================================

/**
 * Extract a complete FactPack from a BaseSnapshot.
 *
 * Executes all extractors and combines results:
 * 1. Dialog detection (independent)
 * 2. Form detection (may use dialog context)
 * 3. Page classification (uses form results)
 * 4. Action selection (uses all context)
 *
 * @param snapshot - The compiled snapshot to analyze
 * @param options - Extraction options
 * @returns Complete FactPack with all extracted facts
 */
export function extractFactPack(
  snapshot: BaseSnapshot,
  options: FactPackOptions = {}
): FactPack {
  const startTime = performance.now();

  // Step 1: Detect dialogs (independent)
  const dialogs = detectDialogs(snapshot);

  // Step 2: Detect forms (may use dialog context in future)
  const formOptions: FormDetectionOptions = {
    include_disabled_fields: options.include_disabled_fields ?? true,
  };
  const forms = detectForms(snapshot, formOptions);

  // Step 3: Classify page (uses form results)
  const pageType = classifyPage(snapshot, forms);

  // Step 4: Select actions (uses all context)
  const actionOptions: ActionSelectionOptions = {
    max_actions: options.max_actions ?? 12,
    min_action_score: options.min_action_score ?? 0.2,
    forms,
    dialogs,
    pageType: pageType.classification,
  };
  const actions = selectKeyActions(snapshot, actionOptions);

  const extractionTimeMs = performance.now() - startTime;

  return {
    page_type: pageType,
    dialogs,
    forms,
    actions,
    meta: {
      snapshot_id: snapshot.snapshot_id,
      extraction_time_ms: extractionTimeMs,
    },
  };
}

// ============================================================================
// Re-exports
// ============================================================================

// Types
export * from './types.js';

// Individual extractors
export { detectDialogs } from './dialog-detector.js';
export { detectForms, type FormDetectionOptions } from './form-detector.js';
export { classifyPage } from './page-classifier.js';
export { selectKeyActions, type ActionSelectionOptions } from './action-selector.js';
