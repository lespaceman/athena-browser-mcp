/**
 * Element Resolver Tests
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveLocator,
  parseLocatorString,
  clickByBackendNodeId,
} from '../../../src/snapshot/element-resolver.js';
import type { ReadableNode } from '../../../src/snapshot/snapshot.types.js';
import type { CdpClient } from '../../../src/cdp/cdp-client.interface.js';
import type { Page, Locator } from 'playwright';

describe('ElementResolver', () => {
  describe('parseLocatorString()', () => {
    it('should parse role-only locator', () => {
      const result = parseLocatorString('role=button');
      expect(result).toEqual({ type: 'role', role: 'button', name: undefined });
    });

    it('should parse role with name locator', () => {
      const result = parseLocatorString('role=button[name="Submit"]');
      expect(result).toEqual({ type: 'role', role: 'button', name: 'Submit' });
    });

    it('should parse role with name containing special characters', () => {
      const result = parseLocatorString('role=link[name="More info..."]');
      expect(result).toEqual({ type: 'role', role: 'link', name: 'More info...' });
    });

    it('should parse role with single quoted name', () => {
      const result = parseLocatorString("role=textbox[name='Email']");
      expect(result).toEqual({ type: 'role', role: 'textbox', name: 'Email' });
    });

    it('should return css type for non-role selectors', () => {
      const result = parseLocatorString('button.primary');
      expect(result).toEqual({ type: 'css', selector: 'button.primary' });
    });

    it('should return css type for aria-label selectors', () => {
      const result = parseLocatorString('[aria-label="Submit"]');
      expect(result).toEqual({ type: 'css', selector: '[aria-label="Submit"]' });
    });
  });

  describe('resolveLocator()', () => {
    let mockPage: Page;
    let mockLocator: Locator;

    beforeEach(() => {
      mockLocator = {
        click: vi.fn(),
        fill: vi.fn(),
      } as unknown as Locator;

      mockPage = {
        getByRole: vi.fn().mockReturnValue(mockLocator),
        locator: vi.fn().mockReturnValue(mockLocator),
      } as unknown as Page;
    });

    function createTestNode(selector: string): ReadableNode {
      return {
        node_id: 'node-1',
        backend_node_id: 12345,
        kind: 'button',
        label: 'Test',
        where: { region: 'main' },
        layout: { bbox: { x: 0, y: 0, w: 100, h: 30 } },
        find: { primary: selector },
      };
    }

    it('should use getByRole for role=X locators', () => {
      const node = createTestNode('role=button');
      const locator = resolveLocator(mockPage, node);

      expect(mockPage.getByRole).toHaveBeenCalledWith('button', {});
      expect(locator).toBe(mockLocator);
    });

    it('should use getByRole with name for role=X[name="Y"] locators', () => {
      const node = createTestNode('role=button[name="Submit"]');
      const locator = resolveLocator(mockPage, node);

      expect(mockPage.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
      expect(locator).toBe(mockLocator);
    });

    it('should use page.locator for CSS selectors', () => {
      const node = createTestNode('button.primary');
      const locator = resolveLocator(mockPage, node);

      expect(mockPage.locator).toHaveBeenCalledWith('button.primary');
      expect(locator).toBe(mockLocator);
    });

    it('should throw error if node has no locator', () => {
      const node: ReadableNode = {
        node_id: 'node-1',
        backend_node_id: 12345,
        kind: 'button',
        label: 'Test',
        where: { region: 'main' },
        layout: { bbox: { x: 0, y: 0, w: 100, h: 30 } },
        // No find property
      };

      expect(() => resolveLocator(mockPage, node)).toThrow('Node node-1 has no locator');
    });

    it('should handle empty primary locator', () => {
      const node = createTestNode('');

      expect(() => resolveLocator(mockPage, node)).toThrow('Node node-1 has no locator');
    });
  });

  describe('clickByBackendNodeId()', () => {
    let mockCdp: { send: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockCdp = {
        send: vi.fn(),
      };
    });

    it('should click element using CDP', async () => {
      mockCdp.send
        .mockResolvedValueOnce(undefined) // scrollIntoViewIfNeeded
        .mockResolvedValueOnce({
          model: {
            content: [100, 200, 200, 200, 200, 250, 100, 250],
          },
        }) // getBoxModel
        .mockResolvedValueOnce(undefined) // mousePressed
        .mockResolvedValueOnce(undefined); // mouseReleased

      await clickByBackendNodeId(mockCdp as unknown as CdpClient, 12345);

      expect(mockCdp.send).toHaveBeenCalledWith('DOM.scrollIntoViewIfNeeded', {
        backendNodeId: 12345,
      });
      expect(mockCdp.send).toHaveBeenCalledWith('DOM.getBoxModel', {
        backendNodeId: 12345,
      });
      expect(mockCdp.send).toHaveBeenCalledWith(
        'Input.dispatchMouseEvent',
        expect.objectContaining({
          type: 'mousePressed',
          x: 150, // center of 100-200
          y: 225, // center of 200-250
          button: 'left',
        })
      );
      expect(mockCdp.send).toHaveBeenCalledWith(
        'Input.dispatchMouseEvent',
        expect.objectContaining({
          type: 'mouseReleased',
        })
      );
    });

    it('should throw descriptive error when element is removed from DOM', async () => {
      mockCdp.send.mockRejectedValueOnce(new Error('Node with given id does not exist'));

      await expect(clickByBackendNodeId(mockCdp as unknown as CdpClient, 99999)).rejects.toThrow(
        /Failed to scroll element into view.*backendNodeId: 99999.*removed from the DOM/
      );
    });

    it('should throw descriptive error when element has no bounding box', async () => {
      mockCdp.send
        .mockResolvedValueOnce(undefined) // scrollIntoViewIfNeeded
        .mockRejectedValueOnce(new Error('Could not compute box model'));

      await expect(clickByBackendNodeId(mockCdp as unknown as CdpClient, 12345)).rejects.toThrow(
        /Failed to get element bounding box.*backendNodeId: 12345.*hidden or have no layout/
      );
    });

    it('should throw error when content box is empty', async () => {
      mockCdp.send
        .mockResolvedValueOnce(undefined) // scrollIntoViewIfNeeded
        .mockResolvedValueOnce({
          model: {
            content: [], // Empty content box
          },
        });

      await expect(clickByBackendNodeId(mockCdp as unknown as CdpClient, 12345)).rejects.toThrow(
        /Element has no clickable area.*backendNodeId: 12345.*zero-sized/
      );
    });

    it('should throw error when content box is undefined', async () => {
      mockCdp.send
        .mockResolvedValueOnce(undefined) // scrollIntoViewIfNeeded
        .mockResolvedValueOnce({
          model: {}, // No content property
        });

      await expect(clickByBackendNodeId(mockCdp as unknown as CdpClient, 12345)).rejects.toThrow(
        /Element has no clickable area/
      );
    });

    it('should throw error for invalid coordinates', async () => {
      mockCdp.send
        .mockResolvedValueOnce(undefined) // scrollIntoViewIfNeeded
        .mockResolvedValueOnce({
          model: {
            content: [-100, -50, 0, -50, 0, 0, -100, 0], // Negative coordinates
          },
        });

      await expect(clickByBackendNodeId(mockCdp as unknown as CdpClient, 12345)).rejects.toThrow(
        /Invalid click coordinates.*off-screen/
      );
    });
  });
});
