/**
 * CDP Client Interface
 *
 * Generic interface for Chrome DevTools Protocol communication.
 * Enables dependency injection and testability by abstracting
 * the underlying CDP transport (Playwright, chrome-remote-interface, etc.).
 */

/**
 * Handler function for CDP events
 */
export type CdpEventHandler = (params: Record<string, unknown>) => void;

/**
 * Generic interface for CDP communication.
 * Allows dependency injection of different CDP implementations.
 */
export interface CdpClient {
  /**
   * Send a CDP command and wait for response.
   *
   * @param method - CDP method name (e.g., 'DOM.getDocument', 'Page.navigate')
   * @param params - Optional parameters for the CDP method
   * @returns Promise resolving to the CDP response
   * @throws Error if session is closed or CDP command fails
   *
   * @example
   * ```typescript
   * const doc = await cdp.send<DOM.GetDocumentResponse>('DOM.getDocument', { depth: -1 });
   * ```
   */
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;

  /**
   * Subscribe to CDP events.
   *
   * @param event - CDP event name (e.g., 'Page.loadEventFired', 'DOM.documentUpdated')
   * @param handler - Callback function invoked when event fires
   *
   * @example
   * ```typescript
   * cdp.on('Page.loadEventFired', (params) => {
   *   console.log('Page loaded:', params);
   * });
   * ```
   */
  on(event: string, handler: CdpEventHandler): void;

  /**
   * Unsubscribe from CDP events.
   *
   * @param event - CDP event name
   * @param handler - The same handler function passed to `on()`
   */
  off(event: string, handler: CdpEventHandler): void;

  /**
   * Subscribe to a CDP event once (auto-unsubscribes after first fire).
   *
   * @param event - CDP event name
   * @param handler - Callback function invoked once when event fires
   *
   * @example
   * ```typescript
   * cdp.once('Page.loadEventFired', (params) => {
   *   console.log('Page loaded (one-time):', params);
   * });
   * ```
   */
  once(event: string, handler: CdpEventHandler): void;

  /**
   * Close/detach the CDP session.
   * After calling close(), all subsequent send() calls will throw.
   */
  close(): Promise<void>;

  /**
   * Check if session is still active.
   *
   * @returns true if the session is connected and usable
   */
  isActive(): boolean;
}

/**
 * Options for creating a CDP client
 */
export interface CdpClientOptions {
  /** Timeout for CDP commands in milliseconds (default: 30000) */
  timeout?: number;
}
