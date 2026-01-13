/**
 * Execute Action
 *
 * Simplified action execution wrapper that captures snapshot and generates FactPack summary.
 * No version tracking, no delta computation - just execute, stabilize, and return page state.
 * Includes automatic retry logic for stale element errors.
 */

import type { PageHandle } from '../browser/page-registry.js';
import { compileSnapshot } from '../snapshot/index.js';
import { extractFactPack } from '../factpack/index.js';
import { generatePageSummary, type PageSummary } from '../renderer/index.js';
import { stabilizeDom } from '../delta/dom-stabilizer.js';
import type { BaseSnapshot, ReadableNode } from '../snapshot/snapshot.types.js';

/**
 * Result of executing an action.
 */
export interface ActionResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Snapshot ID for the captured page state */
  snapshot_id: string;
  /** Total nodes captured */
  node_count: number;
  /** Interactive nodes captured */
  interactive_count: number;
  /** Comprehensive JSON page summary for LLM context */
  page_summary: PageSummary;
  /** Token count for page_summary */
  page_summary_tokens: number;
  /** Error message if action failed */
  error?: string;
  /** The full snapshot (for internal use) */
  snapshot: BaseSnapshot;
}

/**
 * Check if an error is a stale element error.
 */
function isStaleElementError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes('no node found for given backend id') ||
    message.includes('protocol error (dom.scrollintoviewifneeded)') ||
    message.includes('node is detached from document') ||
    message.includes('node has been deleted')
  );
}

/**
 * Execute a mutating action with automatic snapshot capture and FactPack generation.
 *
 * Simple flow:
 * 1. Execute action (try/catch with retry for stale elements)
 * 2. Stabilize DOM
 * 3. Capture snapshot
 * 4. Extract FactPack
 * 5. Generate page_summary
 * 6. Return {success, page_summary, metadata}
 *
 * @param handle - Page handle with CDP client
 * @param action - The action to execute
 * @returns Action result with page brief and metadata
 */
export async function executeAction(
  handle: PageHandle,
  action: () => Promise<void>
): Promise<ActionResult> {
  let success = true;
  let error: string | undefined;

  // Execute action - if this throws, we catch and return error
  try {
    await action();
  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : String(err);
  }

  // Stabilize DOM (even if action failed, to get current state)
  await stabilizeDom(handle.page);

  // Capture snapshot
  const snapshot = await compileSnapshot(handle.cdp, handle.page, handle.page_id);

  // Extract FactPack and generate page_summary
  const factpack = extractFactPack(snapshot);
  const { page_summary, page_summary_tokens } = generatePageSummary(snapshot, factpack);

  return {
    success,
    snapshot_id: snapshot.snapshot_id,
    node_count: snapshot.meta.node_count,
    interactive_count: snapshot.meta.interactive_count,
    page_summary,
    page_summary_tokens,
    error,
    snapshot,
  };
}

/**
 * Execute an element-based action with automatic retry on stale element errors.
 *
 * If the element becomes stale, this will:
 * 1. Capture a fresh snapshot
 * 2. Find the element by label
 * 3. Retry the action once with the fresh backend_node_id
 *
 * @param handle - Page handle with CDP client
 * @param node - The target node from snapshot
 * @param action - The action to execute (takes backend_node_id)
 * @param snapshotStore - Snapshot store to update with fresh snapshot
 * @returns Action result with page brief and metadata
 */
export async function executeActionWithRetry(
  handle: PageHandle,
  node: ReadableNode,
  action: (backendNodeId: number) => Promise<void>,
  snapshotStore?: { store: (pageId: string, snapshot: BaseSnapshot) => void }
): Promise<ActionResult> {
  let success = true;
  let error: string | undefined;
  let retried = false;

  // Try the action
  try {
    await action(node.backend_node_id);
  } catch (err) {
    // Check if this is a stale element error
    if (isStaleElementError(err)) {
      retried = true;
      try {
        // Capture fresh snapshot
        const freshSnapshot = await compileSnapshot(handle.cdp, handle.page, handle.page_id);

        // Update snapshot store if provided
        if (snapshotStore) {
          snapshotStore.store(handle.page_id, freshSnapshot);
        }

        // Find element by label in fresh snapshot
        const freshNode = freshSnapshot.nodes.find(
          (n) => n.label === node.label && n.kind === node.kind
        );

        if (!freshNode) {
          throw new Error(`Element no longer found after refresh: ${node.label}`);
        }

        // Retry action with fresh backend_node_id
        await action(freshNode.backend_node_id);
      } catch (retryErr) {
        success = false;
        error =
          retryErr instanceof Error
            ? `Retry failed: ${retryErr.message}`
            : `Retry failed: ${String(retryErr)}`;
      }
    } else {
      // Not a stale element error - propagate immediately
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // Stabilize DOM (even if action failed, to get current state)
  await stabilizeDom(handle.page);

  // Capture final snapshot
  const snapshot = await compileSnapshot(handle.cdp, handle.page, handle.page_id);

  // Extract FactPack and generate page_summary
  const factpack = extractFactPack(snapshot);
  const { page_summary, page_summary_tokens } = generatePageSummary(snapshot, factpack);

  // Add note about retry if it happened
  if (retried && success) {
    error = 'Element was stale; automatically retried with fresh reference';
  }

  return {
    success,
    snapshot_id: snapshot.snapshot_id,
    node_count: snapshot.meta.node_count,
    interactive_count: snapshot.meta.interactive_count,
    page_summary,
    page_summary_tokens,
    error,
    snapshot,
  };
}
