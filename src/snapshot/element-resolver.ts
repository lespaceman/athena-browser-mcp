/**
 * Element Resolver
 *
 * Resolves node_id from snapshot to actionable element.
 * Provides CDP-based clicking using backendNodeId for guaranteed uniqueness.
 */

import type { CdpClient } from '../cdp/cdp-client.interface.js';

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

// ============================================================================
// Key Code Mapping
// ============================================================================

/**
 * Maps key names to their DOM key codes.
 * Used for Input.dispatchKeyEvent CDP commands.
 */
const KEY_DEFINITIONS: Record<
  string,
  { code: string; keyCode: number; key: string; text?: string }
> = {
  Enter: { code: 'Enter', keyCode: 13, key: 'Enter', text: '\r' },
  Tab: { code: 'Tab', keyCode: 9, key: 'Tab' },
  Escape: { code: 'Escape', keyCode: 27, key: 'Escape' },
  Backspace: { code: 'Backspace', keyCode: 8, key: 'Backspace' },
  Delete: { code: 'Delete', keyCode: 46, key: 'Delete' },
  Space: { code: 'Space', keyCode: 32, key: ' ', text: ' ' },
  ArrowUp: { code: 'ArrowUp', keyCode: 38, key: 'ArrowUp' },
  ArrowDown: { code: 'ArrowDown', keyCode: 40, key: 'ArrowDown' },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37, key: 'ArrowLeft' },
  ArrowRight: { code: 'ArrowRight', keyCode: 39, key: 'ArrowRight' },
  Home: { code: 'Home', keyCode: 36, key: 'Home' },
  End: { code: 'End', keyCode: 35, key: 'End' },
  PageUp: { code: 'PageUp', keyCode: 33, key: 'PageUp' },
  PageDown: { code: 'PageDown', keyCode: 34, key: 'PageDown' },
};

/**
 * Convert modifier names to CDP modifier bitmask.
 * Alt=1, Ctrl=2, Meta=4, Shift=8
 */
function computeModifiers(modifiers?: string[]): number {
  if (!modifiers) return 0;
  let bits = 0;
  for (const mod of modifiers) {
    switch (mod.toLowerCase()) {
      case 'alt':
        bits |= 1;
        break;
      case 'control':
      case 'ctrl':
        bits |= 2;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
        bits |= 4;
        break;
      case 'shift':
        bits |= 8;
        break;
    }
  }
  return bits;
}

// ============================================================================
// Helper: Get Element Center Coordinates
// ============================================================================

/**
 * Get the center coordinates of an element by its backendNodeId.
 * Scrolls the element into view first.
 */
async function getElementCenter(
  cdp: CdpClient,
  backendNodeId: number
): Promise<{ x: number; y: number }> {
  // Scroll into view
  try {
    await cdp.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to scroll element into view (backendNodeId: ${backendNodeId}). ` +
        `The element may have been removed from the DOM. Original error: ${message}`
    );
  }

  // Get bounding box
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

  if (!model?.content || model.content.length < 8) {
    throw new Error(
      `Element has no clickable area (backendNodeId: ${backendNodeId}). ` +
        `The element may be zero-sized or not rendered.`
    );
  }

  const [x1, y1, x2, , , y3] = model.content;
  const x = x1 + (x2 - x1) / 2;
  const y = y1 + (y3 - y1) / 2;

  if (x < 0 || y < 0 || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(
      `Invalid coordinates (x: ${x}, y: ${y}) for backendNodeId: ${backendNodeId}. ` +
        `The element may be positioned off-screen.`
    );
  }

  return { x, y };
}

// ============================================================================
// Type Text
// ============================================================================

/**
 * Type text into an element using CDP.
 *
 * Focuses the element first (via click), optionally clears existing text,
 * then inserts the new text.
 *
 * @param cdp - CDP client instance
 * @param backendNodeId - Element to type into
 * @param text - Text to type
 * @param options.clear - If true, clears existing text first (Ctrl+A, Delete)
 */
export async function typeByBackendNodeId(
  cdp: CdpClient,
  backendNodeId: number,
  text: string,
  options?: { clear?: boolean }
): Promise<void> {
  // 1. Focus the element by clicking it
  await clickByBackendNodeId(cdp, backendNodeId);

  // 2. Clear existing text if requested
  if (options?.clear) {
    // Select all (Ctrl+A)
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'a',
      code: 'KeyA',
      modifiers: 2, // Ctrl
      windowsVirtualKeyCode: 65,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'a',
      code: 'KeyA',
      modifiers: 2,
      windowsVirtualKeyCode: 65,
    });

    // Delete selected text
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Delete',
      code: 'Delete',
      windowsVirtualKeyCode: 46,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Delete',
      code: 'Delete',
      windowsVirtualKeyCode: 46,
    });
  }

  // 3. Insert text
  await cdp.send('Input.insertText', { text });
}

// ============================================================================
// Press Key
// ============================================================================

/**
 * Press a keyboard key using CDP.
 *
 * Sends keyDown and keyUp events for the specified key.
 *
 * @param cdp - CDP client instance
 * @param key - Key name (e.g., 'Enter', 'Tab', 'Escape', 'ArrowDown')
 * @param modifiers - Optional modifier keys ['Control', 'Shift', 'Alt', 'Meta']
 */
export async function pressKey(cdp: CdpClient, key: string, modifiers?: string[]): Promise<void> {
  const keyDef = KEY_DEFINITIONS[key];
  if (!keyDef) {
    throw new Error(
      `Unknown key: "${key}". Supported keys: ${Object.keys(KEY_DEFINITIONS).join(', ')}`
    );
  }

  const modifierBits = computeModifiers(modifiers);

  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: keyDef.key,
    code: keyDef.code,
    windowsVirtualKeyCode: keyDef.keyCode,
    modifiers: modifierBits,
    text: keyDef.text,
  });

  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: keyDef.key,
    code: keyDef.code,
    windowsVirtualKeyCode: keyDef.keyCode,
    modifiers: modifierBits,
  });
}

// ============================================================================
// Select Option
// ============================================================================

/**
 * Select an option from a <select> element.
 *
 * Uses Runtime.callFunctionOn to set the select value and dispatch a change event.
 *
 * @param cdp - CDP client instance
 * @param backendNodeId - The <select> element's backendNodeId
 * @param value - Option value or visible text to select
 * @returns The selected option's visible text
 */
export async function selectOption(
  cdp: CdpClient,
  backendNodeId: number,
  value: string
): Promise<string> {
  // Resolve the backendNodeId to a Runtime object
  const { object } = await cdp.send('DOM.resolveNode', { backendNodeId });

  if (!object.objectId) {
    throw new Error(`Failed to resolve element (backendNodeId: ${backendNodeId})`);
  }

  // Call a function on the element to select the option
  const result = await cdp.send('Runtime.callFunctionOn', {
    objectId: object.objectId,
    functionDeclaration: `function(targetValue) {
      if (this.tagName !== 'SELECT') {
        throw new Error('Element is not a <select> element');
      }
      const options = Array.from(this.options);
      const option = options.find(o =>
        o.value === targetValue ||
        o.text === targetValue ||
        o.text.trim() === targetValue
      );
      if (!option) {
        const available = options.map(o => o.text || o.value).join(', ');
        throw new Error('Option not found: "' + targetValue + '". Available: ' + available);
      }
      this.value = option.value;
      this.dispatchEvent(new Event('change', { bubbles: true }));
      return option.text;
    }`,
    arguments: [{ value }],
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(
      `Failed to select option: ${result.exceptionDetails.exception?.description ?? 'Unknown error'}`
    );
  }

  return result.result.value as string;
}

// ============================================================================
// Hover
// ============================================================================

/**
 * Hover over an element using CDP.
 *
 * Scrolls the element into view and moves the mouse to its center.
 *
 * @param cdp - CDP client instance
 * @param backendNodeId - Element to hover over
 */
export async function hoverByBackendNodeId(cdp: CdpClient, backendNodeId: number): Promise<void> {
  const { x, y } = await getElementCenter(cdp, backendNodeId);

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
  });
}

// ============================================================================
// Scroll
// ============================================================================

/**
 * Scroll an element into view using CDP.
 *
 * @param cdp - CDP client instance
 * @param backendNodeId - Element to scroll into view
 */
export async function scrollIntoView(cdp: CdpClient, backendNodeId: number): Promise<void> {
  try {
    await cdp.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to scroll element into view (backendNodeId: ${backendNodeId}). ` +
        `Original error: ${message}`
    );
  }
}

/**
 * Scroll the page by a specified amount.
 *
 * @param cdp - CDP client instance
 * @param direction - 'up' or 'down'
 * @param amount - Pixels to scroll (default: 500)
 */
export async function scrollPage(
  cdp: CdpClient,
  direction: 'up' | 'down',
  amount = 500
): Promise<void> {
  const scrollY = direction === 'down' ? amount : -amount;

  await cdp.send('Runtime.evaluate', {
    expression: `window.scrollBy(0, ${scrollY})`,
  });
}
