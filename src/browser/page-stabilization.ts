/**
 * Page Stabilization Utilities
 *
 * Shared utilities for waiting on page load states.
 * Used by session-manager and execute-action.
 */

import type { Page } from 'playwright';

/** Default timeout for network idle waiting after actions (ms) */
export const ACTION_NETWORK_IDLE_TIMEOUT_MS = 3000;

/** Default timeout for network idle waiting after navigation (ms) */
export const NAVIGATION_NETWORK_IDLE_TIMEOUT_MS = 5000;

/** Error patterns that indicate the page is in a broken state */
const CRITICAL_ERROR_PATTERNS = [
  'Target closed',
  'Execution context was destroyed',
  'Page crashed',
  'Protocol error',
  'Session closed',
];

/**
 * Check if an error is a critical page error that should be rethrown.
 */
function isCriticalError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return CRITICAL_ERROR_PATTERNS.some((pattern) => error.message.includes(pattern));
}

/**
 * Wait for network to become idle (no pending requests for 500ms).
 *
 * This catches pending API calls triggered by actions. Timeout errors are
 * swallowed (pages with long-polling, websockets, or analytics may never idle),
 * but critical errors (page crashed, target closed) are rethrown.
 *
 * @param page - Playwright Page instance
 * @param timeoutMs - Maximum time to wait for network idle
 * @returns Whether network became idle (false = timed out, but that's OK)
 * @throws Rethrows critical errors (target closed, page crashed, etc.)
 */
export async function waitForNetworkQuiet(page: Page, timeoutMs: number): Promise<boolean> {
  try {
    await page.waitForLoadState('networkidle', { timeout: timeoutMs });
    return true;
  } catch (error) {
    // Rethrow critical errors - the page is broken
    if (isCriticalError(error)) {
      throw error;
    }
    // Timeout is expected for pages with persistent connections - don't throw
    return false;
  }
}
