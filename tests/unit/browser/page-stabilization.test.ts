/**
 * Page Stabilization Tests
 *
 * Tests for network idle waiting utility.
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, vi } from 'vitest';
import {
  waitForNetworkQuiet,
  ACTION_NETWORK_IDLE_TIMEOUT_MS,
  NAVIGATION_NETWORK_IDLE_TIMEOUT_MS,
} from '../../../src/browser/page-stabilization.js';
import type { Page } from 'playwright';

describe('waitForNetworkQuiet', () => {
  function createMockPage(waitResult: 'success' | 'timeout'): Page {
    return {
      waitForLoadState:
        waitResult === 'success'
          ? vi.fn().mockResolvedValue(undefined)
          : vi.fn().mockRejectedValue(new Error('Timeout 5000ms exceeded')),
    } as unknown as Page;
  }

  describe('success path', () => {
    it('should return true when network becomes idle', async () => {
      const mockPage = createMockPage('success');

      const result = await waitForNetworkQuiet(mockPage, 3000);

      expect(result).toBe(true);
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 3000 });
    });

    it('should call waitForLoadState with provided timeout', async () => {
      const mockPage = createMockPage('success');

      await waitForNetworkQuiet(mockPage, 5000);

      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 5000 });
    });
  });

  describe('timeout path', () => {
    it('should return false when network does not reach idle (timeout)', async () => {
      const mockPage = createMockPage('timeout');

      const result = await waitForNetworkQuiet(mockPage, 3000);

      expect(result).toBe(false);
    });

    it('should not throw on timeout', async () => {
      const mockPage = createMockPage('timeout');

      await expect(waitForNetworkQuiet(mockPage, 3000)).resolves.not.toThrow();
    });

    it('should swallow non-critical errors', async () => {
      const mockPage = {
        waitForLoadState: vi.fn().mockRejectedValue(new Error('Some other error')),
      } as unknown as Page;

      const result = await waitForNetworkQuiet(mockPage, 3000);

      expect(result).toBe(false);
    });
  });

  describe('critical errors', () => {
    it.each([
      'Target closed',
      'Execution context was destroyed',
      'Page crashed',
      'Protocol error',
      'Session closed',
    ])('should rethrow critical error: %s', async (errorMessage) => {
      const mockPage = {
        waitForLoadState: vi.fn().mockRejectedValue(new Error(errorMessage)),
      } as unknown as Page;

      await expect(waitForNetworkQuiet(mockPage, 3000)).rejects.toThrow(errorMessage);
    });

    it('should rethrow when error message contains critical pattern', async () => {
      const mockPage = {
        waitForLoadState: vi
          .fn()
          .mockRejectedValue(new Error('Error: Target closed while waiting')),
      } as unknown as Page;

      await expect(waitForNetworkQuiet(mockPage, 3000)).rejects.toThrow('Target closed');
    });
  });
});

describe('constants', () => {
  it('should export ACTION_NETWORK_IDLE_TIMEOUT_MS as 3000', () => {
    expect(ACTION_NETWORK_IDLE_TIMEOUT_MS).toBe(3000);
  });

  it('should export NAVIGATION_NETWORK_IDLE_TIMEOUT_MS as 5000', () => {
    expect(NAVIGATION_NETWORK_IDLE_TIMEOUT_MS).toBe(5000);
  });
});
