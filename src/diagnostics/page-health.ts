/**
 * Page Health Diagnostics
 *
 * Collects page state to help diagnose snapshot failures.
 * Checks title, content accessibility, frame state, and more.
 */

import type { Page } from 'puppeteer-core';

/** Health check report for a page */
export interface PageHealthReport {
  /** Overall health - false if any critical errors */
  isHealthy: boolean;
  /** Page URL */
  url: string;
  /** Page title (empty title is a warning sign) */
  title: string;
  /** Length of raw HTML content (0 = problem) */
  contentLength: number;
  /** Error message if content() failed */
  contentError?: string;
  /** Main frame URL */
  mainFrameUrl?: string;
  /** Is the page closed? */
  isClosed: boolean;
  /** Warning indicators */
  warnings: string[];
  /** Error indicators (critical) */
  errors: string[];
  /** Timestamp of check */
  timestamp: number;
}

/**
 * Perform health check on a page.
 *
 * This is a diagnostic tool to understand why snapshots might fail.
 * Call this when snapshot returns empty to gather evidence.
 */
export async function checkPageHealth(page: Page): Promise<PageHealthReport> {
  const timestamp = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check if page is closed
  const isClosed = page.isClosed();
  if (isClosed) {
    errors.push('page_closed');
  }

  // Get URL and title
  let url = '';
  let title = '';
  try {
    url = page.url();
    title = await page.title();
  } catch {
    // Page may be in bad state
  }

  if (!title) {
    warnings.push('empty_title');
  }

  // Try to get content length
  let contentLength = 0;
  let contentError: string | undefined;
  if (!isClosed) {
    try {
      const content = await page.content();
      contentLength = content.length;
      if (contentLength === 0) {
        errors.push('empty_content');
      }
    } catch (err) {
      errors.push('content_error');
      contentError = err instanceof Error ? err.message : String(err);
    }
  }

  // Get main frame info
  let mainFrameUrl: string | undefined;
  try {
    const mainFrame = page.mainFrame();
    mainFrameUrl = mainFrame.url();
  } catch {
    // Frame may be detached
  }

  return {
    isHealthy: errors.length === 0,
    url,
    title,
    contentLength,
    contentError,
    mainFrameUrl,
    isClosed,
    warnings,
    errors,
    timestamp,
  };
}

/**
 * Format health report for logging/display.
 */
export function formatHealthReport(report: PageHealthReport): string {
  const lines: string[] = [];

  lines.push(`Page Health: ${report.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  lines.push(`  URL: ${report.url}`);
  lines.push(`  Title: ${report.title || '(empty)'}`);
  lines.push(`  Content Length: ${report.contentLength}`);
  lines.push(`  Page Closed: ${report.isClosed}`);

  if (report.warnings.length > 0) {
    lines.push(`  Warnings: ${report.warnings.join(', ')}`);
  }

  if (report.errors.length > 0) {
    lines.push(`  Errors: ${report.errors.join(', ')}`);
  }

  if (report.contentError) {
    lines.push(`  Content Error: ${report.contentError}`);
  }

  return lines.join('\n');
}
