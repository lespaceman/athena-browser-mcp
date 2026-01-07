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

  describe('register validation', () => {
    it('should throw error when registering a closed page', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();
      mockPage.isClosed.mockReturnValue(true);

      expect(() => registry.register(mockPage as unknown as PageHandle['page'], mockCdp)).toThrow(
        'Cannot register a closed page'
      );
    });
  });

  describe('has', () => {
    it('should return true for registered page_id', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();
      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      expect(registry.has(handle.page_id)).toBe(true);
    });

    it('should return false for unknown page_id', () => {
      expect(registry.has('page-unknown-id')).toBe(false);
    });
  });

  describe('updateMetadata', () => {
    it('should update url metadata', () => {
      const mockPage = createMockPage({ url: 'https://original.com' });
      const mockCdp = createMockCdpClient();
      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      const result = registry.updateMetadata(handle.page_id, { url: 'https://updated.com' });

      expect(result).toBe(true);
      expect(registry.get(handle.page_id)?.url).toBe('https://updated.com');
    });

    it('should update title metadata', () => {
      const mockPage = createMockPage({ title: 'Original Title' });
      const mockCdp = createMockCdpClient();
      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      const result = registry.updateMetadata(handle.page_id, { title: 'Updated Title' });

      expect(result).toBe(true);
      expect(registry.get(handle.page_id)?.title).toBe('Updated Title');
    });

    it('should update both url and title', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();
      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      registry.updateMetadata(handle.page_id, { url: 'https://new.com', title: 'New Title' });

      const updated = registry.get(handle.page_id);
      expect(updated?.url).toBe('https://new.com');
      expect(updated?.title).toBe('New Title');
    });

    it('should return false for unknown page_id', () => {
      const result = registry.updateMetadata('page-unknown', { url: 'https://test.com' });

      expect(result).toBe(false);
    });
  });

  describe('findByPage', () => {
    it('should return handle for registered page', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();
      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      const found = registry.findByPage(mockPage as unknown as PageHandle['page']);

      expect(found).toBeDefined();
      expect(found?.page_id).toBe(handle.page_id);
    });

    it('should return undefined for unregistered page', () => {
      const mockPage = createMockPage();

      const found = registry.findByPage(mockPage as unknown as PageHandle['page']);

      expect(found).toBeUndefined();
    });

    it('should find correct page among multiple registrations', () => {
      const mockPage1 = createMockPage({ url: 'https://page1.com' });
      const mockPage2 = createMockPage({ url: 'https://page2.com' });
      const mockCdp1 = createMockCdpClient();
      const mockCdp2 = createMockCdpClient();

      registry.register(mockPage1 as unknown as PageHandle['page'], mockCdp1);
      const handle2 = registry.register(mockPage2 as unknown as PageHandle['page'], mockCdp2);

      const found = registry.findByPage(mockPage2 as unknown as PageHandle['page']);

      expect(found?.page_id).toBe(handle2.page_id);
    });
  });

  describe('isValid', () => {
    it('should return true for valid registered page', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();
      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      expect(registry.isValid(handle.page_id)).toBe(true);
    });

    it('should return false for unknown page_id', () => {
      expect(registry.isValid('page-unknown-id')).toBe(false);
    });

    it('should return false when page is closed', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();
      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      // Simulate page closing
      mockPage.isClosed.mockReturnValue(true);

      expect(registry.isValid(handle.page_id)).toBe(false);
    });

    it('should return false when CDP client is inactive', () => {
      const mockPage = createMockPage();
      const mockCdp = createMockCdpClient();
      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      // Simulate CDP session closing
      mockCdp.setActive(false);

      expect(registry.isValid(handle.page_id)).toBe(false);
    });
  });

  describe('findByUrl', () => {
    it('should return empty array when no pages match', () => {
      const mockPage = createMockPage({ url: 'https://example.com' });
      const mockCdp = createMockCdpClient();
      registry.register(mockPage as unknown as PageHandle['page'], mockCdp);

      const found = registry.findByUrl('https://nomatch.com');

      expect(found).toEqual([]);
    });

    it('should return handles with matching url', () => {
      const mockPage = createMockPage({ url: 'https://example.com' });
      const mockCdp = createMockCdpClient();
      const handle = registry.register(mockPage as unknown as PageHandle['page'], mockCdp);
      registry.updateMetadata(handle.page_id, { url: 'https://example.com' });

      const found = registry.findByUrl('https://example.com');

      expect(found).toHaveLength(1);
      expect(found[0].page_id).toBe(handle.page_id);
    });

    it('should return multiple handles with same url', () => {
      const mockPage1 = createMockPage({ url: 'https://same.com' });
      const mockPage2 = createMockPage({ url: 'https://same.com' });
      const mockCdp1 = createMockCdpClient();
      const mockCdp2 = createMockCdpClient();

      const handle1 = registry.register(mockPage1 as unknown as PageHandle['page'], mockCdp1);
      const handle2 = registry.register(mockPage2 as unknown as PageHandle['page'], mockCdp2);
      registry.updateMetadata(handle1.page_id, { url: 'https://same.com' });
      registry.updateMetadata(handle2.page_id, { url: 'https://same.com' });

      const found = registry.findByUrl('https://same.com');

      expect(found).toHaveLength(2);
    });
  });
});
