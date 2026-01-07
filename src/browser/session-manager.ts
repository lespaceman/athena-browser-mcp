/**
 * Session Manager
 *
 * Manages Playwright browser lifecycle with a single shared BrowserContext.
 * All pages share cookies/storage within the context.
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';
import { PlaywrightCdpClient } from '../cdp/playwright-cdp-client.js';
import { PageRegistry, type PageHandle } from './page-registry.js';
import { getLogger } from '../shared/services/logging.service.js';

/**
 * Options for launching the browser session
 */
export interface SessionManagerOptions {
  /** Run browser in headless mode (default: true) */
  headless?: boolean;

  /** Viewport dimensions */
  viewport?: { width: number; height: number };

  /** Custom user agent string */
  userAgent?: string;

  /** Browser locale (e.g., 'en-US') */
  locale?: string;

  /** Timezone ID (e.g., 'America/New_York') */
  timezone?: string;
}

/**
 * Manages browser lifecycle and page creation
 */
export class SessionManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private readonly registry: PageRegistry;
  private readonly logger = getLogger();

  constructor() {
    this.registry = new PageRegistry();
  }

  /**
   * Launch browser with optional configuration
   *
   * @param options - Browser launch options
   * @throws Error if browser is already running
   */
  async launch(options: SessionManagerOptions = {}): Promise<void> {
    if (this.browser) {
      throw new Error('Browser already running');
    }

    const { headless = true, viewport, userAgent, locale, timezone } = options;

    this.logger.info('Launching browser', { headless, viewport, locale, timezone });

    // Launch browser
    this.browser = await chromium.launch({
      headless,
    });

    // Create shared context with options
    const contextOptions: Parameters<Browser['newContext']>[0] = {};

    if (viewport) {
      contextOptions.viewport = viewport;
    }
    if (userAgent) {
      contextOptions.userAgent = userAgent;
    }
    if (locale) {
      contextOptions.locale = locale;
    }
    if (timezone) {
      contextOptions.timezoneId = timezone;
    }

    this.context = await this.browser.newContext(contextOptions);

    this.logger.info('Browser launched successfully');
  }

  /**
   * Create a new page, optionally navigating to a URL
   *
   * @param url - Optional URL to navigate to
   * @returns PageHandle for the new page
   * @throws Error if browser not running
   */
  async createPage(url?: string): Promise<PageHandle> {
    if (!this.context) {
      throw new Error('Browser not running');
    }

    // Create new page
    const page = await this.context.newPage();

    // Create CDP session for this page
    const cdpSession = await this.context.newCDPSession(page);
    const cdpClient = new PlaywrightCdpClient(cdpSession);

    // Register page
    const handle = this.registry.register(page, cdpClient);

    this.logger.debug('Created page', { page_id: handle.page_id });

    // Navigate if URL provided
    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      this.registry.updateMetadata(handle.page_id, {
        url: page.url(),
      });
    }

    return handle;
  }

  /**
   * Get a page handle by its ID
   *
   * @param page_id - The page identifier
   * @returns PageHandle if found, undefined otherwise
   */
  getPage(page_id: string): PageHandle | undefined {
    return this.registry.get(page_id);
  }

  /**
   * Close a page and its CDP session
   *
   * @param page_id - The page identifier
   * @returns true if page was closed, false if not found
   */
  async closePage(page_id: string): Promise<boolean> {
    const handle = this.registry.get(page_id);
    if (!handle) {
      return false;
    }

    try {
      // Close CDP session first
      await handle.cdp.close();
    } catch (error) {
      this.logger.debug('Error closing CDP session', {
        page_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      // Close the page
      await handle.page.close();
    } catch (error) {
      this.logger.debug('Error closing page', {
        page_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Remove from registry
    this.registry.remove(page_id);

    this.logger.debug('Closed page', { page_id });

    return true;
  }

  /**
   * Navigate a page to a URL
   *
   * @param page_id - The page identifier
   * @param url - URL to navigate to
   * @throws Error if page not found
   */
  async navigateTo(page_id: string, url: string): Promise<void> {
    const handle = this.registry.get(page_id);
    if (!handle) {
      throw new Error('Page not found');
    }

    await handle.page.goto(url, { waitUntil: 'domcontentloaded' });

    this.registry.updateMetadata(page_id, {
      url: handle.page.url(),
    });

    this.logger.debug('Navigated page', { page_id, url });
  }

  /**
   * Shutdown the browser and all pages
   */
  async shutdown(): Promise<void> {
    if (!this.browser) {
      return;
    }

    this.logger.info('Shutting down browser');

    // Close all pages
    const pages = this.registry.list();
    for (const page of pages) {
      await this.closePage(page.page_id);
    }

    // Close context
    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // Context may already be closed
      }
      this.context = null;
    }

    // Close browser
    try {
      await this.browser.close();
    } catch {
      // Browser may already be closed
    }
    this.browser = null;

    this.registry.clear();

    this.logger.info('Browser shutdown complete');
  }

  /**
   * Check if browser is running
   *
   * @returns true if browser is active
   */
  isRunning(): boolean {
    return this.browser?.isConnected() ?? false;
  }

  /**
   * List all active pages
   *
   * @returns Array of PageHandle objects
   */
  listPages(): PageHandle[] {
    return this.registry.list();
  }

  /**
   * Get the page count
   *
   * @returns Number of active pages
   */
  pageCount(): number {
    return this.registry.size();
  }
}
