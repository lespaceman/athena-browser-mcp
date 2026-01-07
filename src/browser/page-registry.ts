/**
 * Page Registry
 *
 * Tracks active Playwright pages and their CDP sessions.
 * Provides a central registry for page lifecycle management.
 */

import type { Page } from 'playwright';
import type { CdpClient } from '../cdp/cdp-client.interface.js';
import { randomUUID } from 'crypto';

/**
 * Handle to a registered page with its CDP session
 */
export interface PageHandle {
  /** Unique identifier for this page */
  page_id: string;

  /** Playwright Page instance */
  page: Page;

  /** CDP client for this page */
  cdp: CdpClient;

  /** When the page was registered */
  created_at: Date;

  /** Current URL (may be stale) */
  url?: string;

  /** Page title (may be stale) */
  title?: string;
}

/**
 * Registry for tracking active pages
 */
export class PageRegistry {
  private readonly pages = new Map<string, PageHandle>();

  /**
   * Register a new page with its CDP session
   *
   * @param page - Playwright Page instance
   * @param cdp - CDP client for the page
   * @returns PageHandle with unique page_id
   */
  register(page: Page, cdp: CdpClient): PageHandle {
    const page_id = `page-${randomUUID()}`;

    const handle: PageHandle = {
      page_id,
      page,
      cdp,
      created_at: new Date(),
      url: page.url?.() ?? undefined,
    };

    this.pages.set(page_id, handle);

    return handle;
  }

  /**
   * Get a page handle by its ID
   *
   * @param page_id - The page identifier
   * @returns PageHandle if found, undefined otherwise
   */
  get(page_id: string): PageHandle | undefined {
    return this.pages.get(page_id);
  }

  /**
   * Remove a page from the registry
   *
   * @param page_id - The page identifier
   * @returns true if page was removed, false if not found
   */
  remove(page_id: string): boolean {
    return this.pages.delete(page_id);
  }

  /**
   * List all registered pages
   *
   * @returns Array of all PageHandle objects
   */
  list(): PageHandle[] {
    return Array.from(this.pages.values());
  }

  /**
   * Remove all pages from the registry
   */
  clear(): void {
    this.pages.clear();
  }

  /**
   * Get the number of registered pages
   *
   * @returns Current page count
   */
  size(): number {
    return this.pages.size;
  }

  /**
   * Check if a page is registered
   *
   * @param page_id - The page identifier
   * @returns true if page exists
   */
  has(page_id: string): boolean {
    return this.pages.has(page_id);
  }

  /**
   * Update metadata for a page
   *
   * @param page_id - The page identifier
   * @param metadata - Partial metadata to update
   * @returns true if updated, false if page not found
   */
  updateMetadata(page_id: string, metadata: Partial<Pick<PageHandle, 'url' | 'title'>>): boolean {
    const handle = this.pages.get(page_id);
    if (!handle) {
      return false;
    }

    if (metadata.url !== undefined) {
      handle.url = metadata.url;
    }
    if (metadata.title !== undefined) {
      handle.title = metadata.title;
    }

    return true;
  }
}
