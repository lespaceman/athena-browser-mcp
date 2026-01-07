/**
 * PageRegistry Tests
 *
 * TDD tests for PageRegistry implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PageRegistry, PageHandle } from '../../../src/browser/page-registry.js';
import { createMockCdpClient } from '../../mocks/cdp-client.mock.js';
import { createMockPage } from '../../mocks/playwright.mock.js';
import { expectPageId, expectRecentDate } from '../../helpers/test-utils.js';

describe('PageRegistry', () => {
  let registry: PageRegistry;

  beforeEach(() => {
    registry = new PageRegistry();
  });

  describe('register', () => {
    it('should create unique page_id', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();

      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      expectPageId(handle.page_id);
    });

    it('should create different page_ids for multiple registrations', () => {
      const mockPage1 = createMockPage();
      const mockPage2 = createMockPage();
      const mockCdp1 = createMockCdpClient();
      const mockCdp2 = createMockCdpClient();

      const handle1 = registry.register(mockPage1 as unknown as PageHandle['page'], mockCdp1);
      const handle2 = registry.register(mockPage2 as unknown as PageHandle['page'], mockCdp2);

      expect(handle1.page_id).not.toBe(handle2.page_id);
    });

    it('should store PageHandle with all properties', () => {
      const mockPage = createMockPage({ url: 'https://example.com', title: 'Example' });
      const mockCdp = createMockCdpClient();

      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      expect(handle.page).toBe(mockPage);
      expect(handle.cdp).toBe(mockCdp);
      expectRecentDate(handle.created_at);
    });
  });

  describe('get', () => {
    it('should return correct PageHandle by page_id', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();

      const registeredHandle = registry.register(
        mockPage as unknown as PageHandle['page'],
        mockCdp
      );
      const retrievedHandle = registry.get(registeredHandle.page_id);

      expect(retrievedHandle).toBeDefined();
      expect(retrievedHandle?.page_id).toBe(registeredHandle.page_id);
      expect(retrievedHandle?.page).toBe(mockPage);
      expect(retrievedHandle?.cdp).toBe(mockCdp);
    });

    it('should return undefined for unknown page_id', () => {
      const result = registry.get('page-unknown-id');

      expect(result).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should remove page and return true', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();

      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);
      const removed = registry.remove(handle.page_id);

      expect(removed).toBe(true);
      expect(registry.get(handle.page_id)).toBeUndefined();
    });

    it('should return false for unknown page_id', () => {
      const removed = registry.remove('page-unknown-id');

      expect(removed).toBe(false);
    });
  });

  describe('list', () => {
    it('should return empty array when no pages registered', () => {
      const pages = registry.list();

      expect(pages).toEqual([]);
    });

    it('should return all registered pages', () => {
      const mockPage1 = createMockPage();
      const mockPage2 = createMockPage();
      const mockCdp1 = createMockCdpClient();
      const mockCdp2 = createMockCdpClient();

      const handle1 = registry.register(mockPage1 as unknown as PageHandle['page'], mockCdp1);
      const handle2 = registry.register(mockPage2 as unknown as PageHandle['page'], mockCdp2);

      const pages = registry.list();

      expect(pages).toHaveLength(2);
      expect(pages.map((p) => p.page_id)).toContain(handle1.page_id);
      expect(pages.map((p) => p.page_id)).toContain(handle2.page_id);
    });
  });

  describe('clear', () => {
    it('should remove all pages', () => {
      const mockPage1 = createMockPage();
      const mockPage2 = createMockPage();
      const mockCdp1 = createMockCdpClient();
      const mockCdp2 = createMockCdpClient();

      registry.register(mockPage1 as unknown as PageHandle['page'], mockCdp1);
      registry.register(mockPage2 as unknown as PageHandle['page'], mockCdp2);

      registry.clear();

      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('size', () => {
    it('should return current number of registered pages', () => {
      expect(registry.size()).toBe(0);

      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();
      registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      expect(registry.size()).toBe(1);
    });
  });
});
