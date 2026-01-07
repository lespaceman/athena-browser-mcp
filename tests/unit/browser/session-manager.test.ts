/**
 * SessionManager Tests
 *
 * TDD tests for SessionManager implementation.
 * Uses mocked Playwright - no real browser required.
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { SessionManager } from '../../../src/browser/session-manager.js';
import {
  createLinkedMocks,
  type MockBrowser,
  type MockBrowserContext,
  type MockPage,
  type MockCDPSession,
} from '../../mocks/playwright.mock.js';
import { expectPageId } from '../../helpers/test-utils.js';

// Mock Playwright module
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { chromium } from 'playwright';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockBrowser: MockBrowser;
  let mockContext: MockBrowserContext;
  let mockPage: MockPage;
  let mockCdpSession: MockCDPSession;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create linked mocks
    const mocks = createLinkedMocks({ url: 'about:blank', title: '' });
    mockBrowser = mocks.browser;
    mockContext = mocks.context;
    mockPage = mocks.page;
    mockCdpSession = mocks.cdpSession;

    // Configure chromium.launch to return our mock browser
    (chromium.launch as Mock).mockResolvedValue(mockBrowser);

    sessionManager = new SessionManager();
  });

  describe('launch', () => {
    it('should start browser with default options', async () => {
      await sessionManager.launch();

      expect(vi.mocked(chromium.launch)).toHaveBeenCalledWith({
        headless: true,
      });
      expect(vi.mocked(mockBrowser.newContext)).toHaveBeenCalled();
      expect(sessionManager.isRunning()).toBe(true);
    });

    it('should apply custom headless option', async () => {
      await sessionManager.launch({ headless: false });

      expect(vi.mocked(chromium.launch)).toHaveBeenCalledWith({
        headless: false,
      });
    });

    it('should apply custom viewport', async () => {
      const viewport = { width: 1920, height: 1080 };

      await sessionManager.launch({ viewport });

      expect(vi.mocked(mockBrowser.newContext)).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport,
        })
      );
    });

    it('should apply custom userAgent', async () => {
      const userAgent = 'Custom Agent/1.0';

      await sessionManager.launch({ userAgent });

      expect(vi.mocked(mockBrowser.newContext)).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent,
        })
      );
    });

    it('should apply custom locale and timezone', async () => {
      const locale = 'en-GB';
      const timezone = 'Europe/London';

      await sessionManager.launch({ locale, timezone });

      expect(vi.mocked(mockBrowser.newContext)).toHaveBeenCalledWith(
        expect.objectContaining({
          locale,
          timezoneId: timezone,
        })
      );
    });

    it('should throw if already launched', async () => {
      await sessionManager.launch();

      await expect(sessionManager.launch()).rejects.toThrow('Browser already running');
    });
  });

  describe('createPage', () => {
    beforeEach(async () => {
      await sessionManager.launch();
    });

    it('should create new page and return PageHandle', async () => {
      const handle = await sessionManager.createPage();

      expect(mockContext.newPage).toHaveBeenCalled();
      expect(mockContext.newCDPSession).toHaveBeenCalledWith(mockPage);
      expectPageId(handle.page_id);
      expect(handle.page).toBe(mockPage);
    });

    it('should navigate to URL when provided', async () => {
      const url = 'https://example.com';

      await sessionManager.createPage(url);

      expect(mockPage.goto).toHaveBeenCalledWith(url, expect.any(Object));
    });

    it('should not navigate when no URL provided', async () => {
      await sessionManager.createPage();

      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    it('should throw if browser not launched', async () => {
      const newManager = new SessionManager();

      await expect(newManager.createPage()).rejects.toThrow('Browser not running');
    });
  });

  describe('getPage', () => {
    beforeEach(async () => {
      await sessionManager.launch();
    });

    it('should return PageHandle by page_id', async () => {
      const handle = await sessionManager.createPage();

      const retrieved = sessionManager.getPage(handle.page_id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.page_id).toBe(handle.page_id);
    });

    it('should return undefined for unknown page_id', () => {
      const result = sessionManager.getPage('page-unknown');

      expect(result).toBeUndefined();
    });
  });

  describe('closePage', () => {
    beforeEach(async () => {
      await sessionManager.launch();
    });

    it('should close page and remove from registry', async () => {
      const handle = await sessionManager.createPage();

      const closed = await sessionManager.closePage(handle.page_id);

      expect(closed).toBe(true);
      expect(mockPage.close).toHaveBeenCalled();
      expect(sessionManager.getPage(handle.page_id)).toBeUndefined();
    });

    it('should close CDP session', async () => {
      const handle = await sessionManager.createPage();

      await sessionManager.closePage(handle.page_id);

      expect(mockCdpSession.detach).toHaveBeenCalled();
    });

    it('should return false for unknown page_id', async () => {
      const closed = await sessionManager.closePage('page-unknown');

      expect(closed).toBe(false);
    });
  });

  describe('navigateTo', () => {
    beforeEach(async () => {
      await sessionManager.launch();
    });

    it('should navigate existing page to URL', async () => {
      const handle = await sessionManager.createPage();
      const newUrl = 'https://new-site.com';

      await sessionManager.navigateTo(handle.page_id, newUrl);

      expect(mockPage.goto).toHaveBeenCalledWith(newUrl, expect.any(Object));
    });

    it('should throw for unknown page_id', async () => {
      await expect(
        sessionManager.navigateTo('page-unknown', 'https://example.com')
      ).rejects.toThrow('Page not found');
    });
  });

  describe('shutdown', () => {
    it('should close browser gracefully', async () => {
      await sessionManager.launch();

      await sessionManager.shutdown();

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(sessionManager.isRunning()).toBe(false);
    });

    it('should not throw if not running', async () => {
      await expect(sessionManager.shutdown()).resolves.not.toThrow();
    });

    it('should close all pages before browser', async () => {
      await sessionManager.launch();
      await sessionManager.createPage();
      await sessionManager.createPage();

      await sessionManager.shutdown();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('isRunning', () => {
    it('should return false before launch', () => {
      expect(sessionManager.isRunning()).toBe(false);
    });

    it('should return true after launch', async () => {
      await sessionManager.launch();

      expect(sessionManager.isRunning()).toBe(true);
    });

    it('should return false after shutdown', async () => {
      await sessionManager.launch();
      await sessionManager.shutdown();

      expect(sessionManager.isRunning()).toBe(false);
    });
  });

  describe('listPages', () => {
    beforeEach(async () => {
      await sessionManager.launch();
    });

    it('should return empty array when no pages', () => {
      const pages = sessionManager.listPages();

      expect(pages).toEqual([]);
    });

    it('should return all active pages', async () => {
      const handle1 = await sessionManager.createPage();
      const handle2 = await sessionManager.createPage();

      const pages = sessionManager.listPages();

      expect(pages).toHaveLength(2);
      expect(pages.map((p) => p.page_id)).toContain(handle1.page_id);
      expect(pages.map((p) => p.page_id)).toContain(handle2.page_id);
    });
  });
});
