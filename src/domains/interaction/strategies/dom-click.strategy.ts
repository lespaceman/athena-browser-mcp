/**
 * DOM Click Strategy
 *
 * Clicks elements using DOM selectors (CSS, XPath)
 */

import type { ClickStrategy } from './click-strategy.interface.js';
import type { ElementRef } from '../../../shared/types/index.js';

interface CdpBridge {
  executeDevToolsMethod<T>(method: string, params?: unknown): Promise<T>;
}

export class DomClickStrategy implements ClickStrategy {
  constructor(private readonly cdpBridge: CdpBridge) {}

  /**
   * Check if this strategy can handle the target
   */
  canHandle(target: ElementRef): boolean {
    return Boolean(target.selectors.css ?? target.selectors.xpath ?? target.nodeId);
  }

  /**
   * Click using DOM selectors
   */
  async click(target: ElementRef): Promise<void> {
    if (!this.canHandle(target)) {
      throw new Error('DomClickStrategy cannot handle this target');
    }

    // Priority 1: Use nodeId for direct DOM access
    if (target.nodeId) {
      await this.clickByNodeId(target.nodeId);
      return;
    }

    // Priority 2: Use CSS selector
    if (target.selectors.css) {
      await this.clickByCss(target.selectors.css);
      return;
    }

    // Priority 3: Use XPath
    if (target.selectors.xpath) {
      await this.clickByXPath(target.selectors.xpath);
      return;
    }

    throw new Error('No valid selector found for DOM click');
  }

  /**
   * Click by CDP nodeId
   */
  private async clickByNodeId(nodeId: number): Promise<void> {
    try {
      // Method 1: Use DOM.focus + Input.dispatchKeyEvent (Enter)
      // This is more reliable for some elements
      await this.cdpBridge.executeDevToolsMethod('DOM.focus', { nodeId });

      // Simulate click via JavaScript
      const result = await this.cdpBridge.executeDevToolsMethod<{
        result: { value?: boolean };
      }>('Runtime.evaluate', {
        expression: `
          (function() {
            const node = document.querySelector('[data-node-id="${nodeId}"]');
            if (node && typeof node.click === 'function') {
              node.click();
              return true;
            }
            return false;
          })()
        `,
        returnByValue: true,
      });

      if (!result.result.value) {
        // Fallback: resolve node and use objectId
        await this.clickByResolveNode(nodeId);
      }
    } catch {
      // Fallback to resolveNode approach
      await this.clickByResolveNode(nodeId);
    }
  }

  /**
   * Click by resolving nodeId to objectId
   */
  private async clickByResolveNode(nodeId: number): Promise<void> {
    const resolveResult = await this.cdpBridge.executeDevToolsMethod<{
      object: { objectId: string };
    }>('DOM.resolveNode', { nodeId });

    await this.cdpBridge.executeDevToolsMethod('Runtime.callFunctionOn', {
      objectId: resolveResult.object.objectId,
      functionDeclaration: 'function() { this.click(); }',
    });
  }

  /**
   * Click by CSS selector
   */
  private async clickByCss(selector: string): Promise<void> {
    const expression = `
      (function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el && typeof el.click === 'function') {
          el.click();
          return true;
        }
        return false;
      })()
    `;

    const result = await this.cdpBridge.executeDevToolsMethod<{
      result: { value?: boolean };
    }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });

    if (!result.result.value) {
      throw new Error(`Failed to click element with CSS selector: ${selector}`);
    }
  }

  /**
   * Click by XPath
   */
  private async clickByXPath(xpath: string): Promise<void> {
    const expression = `
      (function() {
        const result = document.evaluate(
          ${JSON.stringify(xpath)},
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        const el = result.singleNodeValue;
        if (el && typeof el.click === 'function') {
          el.click();
          return true;
        }
        return false;
      })()
    `;

    const result = await this.cdpBridge.executeDevToolsMethod<{
      result: { value?: boolean };
    }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });

    if (!result.result.value) {
      throw new Error(`Failed to click element with XPath: ${xpath}`);
    }
  }
}
