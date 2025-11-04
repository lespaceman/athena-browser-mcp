/**
 * Click Strategy Interface
 *
 * Defines the contract for different click implementation strategies
 */

import type { ElementRef } from '../../../shared/types/index.js';

export interface ClickStrategy {
  /**
   * Execute a click on the target element
   *
   * @param target - The element to click
   * @returns Promise that resolves when click is complete
   * @throws Error if click cannot be performed with this strategy
   */
  click(target: ElementRef): Promise<void>;

  /**
   * Check if this strategy can handle the given target
   *
   * @param target - The element to check
   * @returns true if this strategy can click the target
   */
  canHandle(target: ElementRef): boolean;
}
