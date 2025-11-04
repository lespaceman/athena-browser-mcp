/**
 * BBox Click Strategy
 *
 * Clicks elements using coordinates (bounding box center)
 */

import type { ClickStrategy } from './click-strategy.interface.js';
import type { ElementRef } from '../../../shared/types/index.js';

interface CdpBridge {
  executeDevToolsMethod<T>(method: string, params?: unknown): Promise<T>;
}

export class BBoxClickStrategy implements ClickStrategy {
  constructor(private readonly cdpBridge: CdpBridge) {}

  /**
   * Check if this strategy can handle the target
   */
  canHandle(target: ElementRef): boolean {
    return !!target.bbox;
  }

  /**
   * Click using bounding box coordinates
   */
  async click(target: ElementRef): Promise<void> {
    if (!this.canHandle(target)) {
      throw new Error('BBoxClickStrategy cannot handle this target - no bbox');
    }

    const bbox = target.bbox!;

    // Calculate center coordinates
    const x = bbox.x + bbox.w / 2;
    const y = bbox.y + bbox.h / 2;

    // Dispatch mouse pressed event
    await this.cdpBridge.executeDevToolsMethod('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: 'left',
      x,
      y,
      clickCount: 1,
    });

    // Small delay to simulate human-like click
    await this.sleep(50);

    // Dispatch mouse released event
    await this.cdpBridge.executeDevToolsMethod('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: 'left',
      x,
      y,
      clickCount: 1,
    });
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
