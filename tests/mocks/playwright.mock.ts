/**
 * Mock Playwright for unit tests
 *
 * Provides mock implementations of Playwright Browser, BrowserContext,
 * Page, and CDPSession for testing without launching a real browser.
 */

import { vi, type Mock } from 'vitest';

/**
 * Mock CDPSession
 */
export interface MockCDPSession {
  send: Mock;
  on: Mock;
  off: Mock;
  detach: Mock;
}

/**
 * Mock Page
 */
export interface MockPage {
  url: Mock;
  title: Mock;
  goto: Mock;
  close: Mock;
  isClosed: Mock;
  waitForLoadState: Mock;
  evaluate: Mock;
}

/**
 * Mock BrowserContext
 */
export interface MockBrowserContext {
  newPage: Mock;
  newCDPSession: Mock;
  close: Mock;
  pages: Mock;
}

/**
 * Mock Browser
 */
export interface MockBrowser {
  newContext: Mock;
  close: Mock;
  isConnected: Mock;
  contexts: Mock;
}

/**
 * Creates a mock CDPSession
 */
export function createMockCDPSession(): MockCDPSession {
  return {
    send: vi.fn().mockResolvedValue({}),
    on: vi.fn(),
    off: vi.fn(),
    detach: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock Page
 */
export function createMockPage(options: { url?: string; title?: string } = {}): MockPage {
  return {
    url: vi.fn().mockReturnValue(options.url ?? 'about:blank'),
    title: vi.fn().mockResolvedValue(options.title ?? ''),
    goto: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
    isClosed: vi.fn().mockReturnValue(false),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock BrowserContext with preconfigured page and CDP session
 */
export function createMockBrowserContext(
  options: {
    pages?: MockPage[];
    cdpSession?: MockCDPSession;
  } = {}
): MockBrowserContext {
  const mockPage = options.pages?.[0] ?? createMockPage();
  const mockCdpSession = options.cdpSession ?? createMockCDPSession();

  return {
    newPage: vi.fn().mockResolvedValue(mockPage),
    newCDPSession: vi.fn().mockResolvedValue(mockCdpSession),
    close: vi.fn().mockResolvedValue(undefined),
    pages: vi.fn().mockReturnValue(options.pages ?? [mockPage]),
  };
}

/**
 * Creates a mock Browser with preconfigured context
 */
export function createMockBrowser(
  options: {
    contexts?: MockBrowserContext[];
  } = {}
): MockBrowser {
  const mockContext = options.contexts?.[0] ?? createMockBrowserContext();

  return {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    contexts: vi.fn().mockReturnValue(options.contexts ?? [mockContext]),
  };
}

/**
 * Mock chromium launcher
 */
export const mockChromium = {
  launch: vi.fn().mockResolvedValue(createMockBrowser()),
};

/**
 * Full mock setup for Playwright module
 * Use this with vi.mock('playwright', () => createPlaywrightMock())
 */
export function createPlaywrightMock() {
  return {
    chromium: mockChromium,
  };
}

/**
 * Reset all Playwright mocks
 */
export function resetPlaywrightMocks(): void {
  mockChromium.launch.mockClear();
}

/**
 * Helper to create a complete mock setup with linked Browser -> Context -> Page -> CDPSession
 */
export interface LinkedMocks {
  browser: MockBrowser;
  context: MockBrowserContext;
  page: MockPage;
  cdpSession: MockCDPSession;
}

export function createLinkedMocks(
  options: {
    url?: string;
    title?: string;
  } = {}
): LinkedMocks {
  const cdpSession = createMockCDPSession();
  const page = createMockPage({ url: options.url, title: options.title });
  const context = createMockBrowserContext({ pages: [page], cdpSession });
  const browser = createMockBrowser({ contexts: [context] });

  return { browser, context, page, cdpSession };
}
