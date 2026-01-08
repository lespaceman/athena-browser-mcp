/**
 * Element Resolver
 *
 * Resolves node_id from snapshot to actionable element.
 * Provides CDP-based clicking using backendNodeId for guaranteed uniqueness.
 */

import type { Page, Locator } from 'playwright';
import type { CdpClient } from '../cdp/cdp-client.interface.js';
import type { ReadableNode } from './snapshot.types.js';

/**
 * Result of parsing a locator string.
 */
export type ParsedLocator =
  | { type: 'role'; role: string; name: string | undefined }
  | { type: 'css'; selector: string };

/**
 * Parse a locator string to determine its type.
 *
 * Supported formats:
 * - role=button                    → { type: 'role', role: 'button' }
 * - role=button[name="Submit"]     → { type: 'role', role: 'button', name: 'Submit' }
 * - button.primary                 → { type: 'css', selector: 'button.primary' }
 *
 * @param locator - Locator string
 * @returns Parsed locator info
 */
export function parseLocatorString(locator: string): ParsedLocator {
  // Check for role= prefix
  if (locator.startsWith('role=')) {
    const rest = locator.slice(5); // Remove 'role='

    // Check for [name="..."] or [name='...']
    const nameMatch = /^(\w+)\[name=["']([^"']+)["']\]$/.exec(rest);
    if (nameMatch) {
      return { type: 'role', role: nameMatch[1], name: nameMatch[2] };
    }

    // Role only (e.g., "role=button")
    const roleOnly = /^(\w+)$/.exec(rest);
    if (roleOnly) {
      return { type: 'role', role: roleOnly[1], name: undefined };
    }
  }

  // Fallback to CSS selector
  return { type: 'css', selector: locator };
}

/**
 * Resolve a ReadableNode to a Playwright Locator.
 *
 * @deprecated Use {@link clickByBackendNodeId} instead for click actions.
 * This function can produce Playwright strict mode violations when multiple
 * elements match the same selector. It's kept for backward compatibility
 * and debugging purposes only.
 *
 * @param page - Playwright Page instance
 * @param node - ReadableNode from snapshot
 * @returns Playwright Locator
 * @throws Error if node has no locator
 */
export function resolveLocator(page: Page, node: ReadableNode): Locator {
  const selector = node.find?.primary;

  if (!selector) {
    throw new Error(`Node ${node.node_id} has no locator`);
  }

  const parsed = parseLocatorString(selector);

  if (parsed.type === 'role') {
    // Use Playwright's getByRole with proper typing
    const options: { name?: string } = {};
    if (parsed.name !== undefined) {
      options.name = parsed.name;
    }
    // Cast to any to avoid strict AriaRole typing issues
    return page.getByRole(parsed.role as Parameters<Page['getByRole']>[0], options);
  }

  // CSS selector fallback
  return page.locator(parsed.selector);
}

/**
 * Click an element using CDP's backendNodeId directly.
 *
 * This bypasses Playwright's locator system to avoid strict mode violations
 * when multiple elements match the same selector. The backendNodeId is
 * guaranteed unique per DOM element within a CDP session.
 *
 * @param cdp - CDP client instance
 * @param backendNodeId - CDP backend node ID (stable within session)
 * @throws Error if element not found, not visible, or click fails
 *
 * @example
 * ```typescript
 * // Click using the unique backendNodeId from snapshot
 * await clickByBackendNodeId(cdp, node.backend_node_id);
 * ```
 */
export async function clickByBackendNodeId(cdp: CdpClient, backendNodeId: number): Promise<void> {
  // 1. Scroll element into view (ensures element is visible and clickable)
  try {
    await cdp.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to scroll element into view (backendNodeId: ${backendNodeId}). ` +
        `The element may have been removed from the DOM. ` +
        `Try capturing a fresh snapshot. Original error: ${message}`
    );
  }

  // 2. Get element bounding box to calculate click coordinates
  let model;
  try {
    const result = await cdp.send('DOM.getBoxModel', { backendNodeId });
    model = result.model;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to get element bounding box (backendNodeId: ${backendNodeId}). ` +
        `The element may be hidden or have no layout. Original error: ${message}`
    );
  }

  // Validate we have a content box to click
  if (!model?.content || model.content.length < 8) {
    throw new Error(
      `Element has no clickable area (backendNodeId: ${backendNodeId}). ` +
        `The element may be zero-sized or not rendered.`
    );
  }

  // The content quad is an array of 8 numbers: [x1,y1, x2,y2, x3,y3, x4,y4]
  // representing the four corners of the content box in viewport coordinates.
  // We click at the center of the content box.
  const [x1, y1, x2, , , y3] = model.content;
  const centerX = x1 + (x2 - x1) / 2;
  const centerY = y1 + (y3 - y1) / 2;

  // Validate coordinates are reasonable (not negative or extremely large)
  if (centerX < 0 || centerY < 0 || !Number.isFinite(centerX) || !Number.isFinite(centerY)) {
    throw new Error(
      `Invalid click coordinates (x: ${centerX}, y: ${centerY}) for backendNodeId: ${backendNodeId}. ` +
        `The element may be positioned off-screen.`
    );
  }

  // 3. Click at the element's center using CDP Input domain
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: centerX,
    y: centerY,
    button: 'left',
    clickCount: 1,
  });

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: centerX,
    y: centerY,
    button: 'left',
    clickCount: 1,
  });
}
