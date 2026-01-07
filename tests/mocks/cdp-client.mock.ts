/**
 * Mock CdpClient for unit tests
 *
 * Provides a mock implementation of the CdpClient interface
 * with vitest spies for verifying CDP method calls.
 */

import { vi, type Mock } from 'vitest';
import type { CdpClient, CdpEventHandler } from '../../src/cdp/cdp-client.interface.js';

/**
 * Configuration for mock CDP responses
 */
export interface MockCdpConfig {
  /** Map of CDP method -> response */
  responses?: Map<string, unknown>;
  /** Map of CDP method -> error to throw */
  errors?: Map<string, Error>;
  /** Default response for unregistered methods */
  defaultResponse?: unknown;
  /** Whether the session is active */
  active?: boolean;
}

/**
 * Creates a mock CdpClient for testing
 */
export function createMockCdpClient(config: MockCdpConfig = {}): MockCdpClient {
  return new MockCdpClient(config);
}

/**
 * Mock implementation of CdpClient
 */
export class MockCdpClient implements CdpClient {
  private _active: boolean;
  private readonly responses: Map<string, unknown>;
  private readonly errors: Map<string, Error>;
  private readonly defaultResponse: unknown;
  private readonly eventHandlers: Map<string, Set<CdpEventHandler>>;

  // Vitest spies for verification
  public readonly sendSpy: Mock;
  public readonly onSpy: Mock;
  public readonly offSpy: Mock;
  public readonly onceSpy: Mock;
  public readonly closeSpy: Mock;

  constructor(config: MockCdpConfig = {}) {
    this._active = config.active ?? true;
    this.responses = config.responses ?? new Map<string, unknown>();
    this.errors = config.errors ?? new Map<string, Error>();
    this.defaultResponse = config.defaultResponse ?? {};
    this.eventHandlers = new Map();

    // Create spies
    this.sendSpy = vi.fn(this._send.bind(this));
    this.onSpy = vi.fn(this._on.bind(this));
    this.offSpy = vi.fn(this._off.bind(this));
    this.onceSpy = vi.fn(this._once.bind(this));
    this.closeSpy = vi.fn(this._close.bind(this));
  }

  /**
   * Mock send implementation
   */
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    return this.sendSpy(method, params) as Promise<T>;
  }

  private _send<T = unknown>(method: string, _params?: Record<string, unknown>): T {
    if (!this._active) {
      throw new Error('CDP session is closed');
    }

    // Check for configured error
    const error = this.errors.get(method);
    if (error) {
      throw error;
    }

    // Check for configured response
    if (this.responses.has(method)) {
      return this.responses.get(method) as T;
    }

    return this.defaultResponse as T;
  }

  /**
   * Mock on implementation
   */
  on(event: string, handler: CdpEventHandler): void {
    this.onSpy(event, handler);
  }

  private _on(event: string, handler: CdpEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Mock off implementation
   */
  off(event: string, handler: CdpEventHandler): void {
    this.offSpy(event, handler);
  }

  private _off(event: string, handler: CdpEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Mock once implementation
   */
  once(event: string, handler: CdpEventHandler): void {
    this.onceSpy(event, handler);
  }

  private _once(event: string, handler: CdpEventHandler): void {
    const wrappedHandler = (params: Record<string, unknown>) => {
      this._off(event, wrappedHandler);
      handler(params);
    };
    this._on(event, wrappedHandler);
  }

  /**
   * Mock close implementation
   */
  close(): Promise<void> {
    this.closeSpy();
    return Promise.resolve();
  }

  private _close(): void {
    this._active = false;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this._active;
  }

  // ========== Test Helpers ==========

  /**
   * Set a response for a specific CDP method
   */
  setResponse(method: string, response: unknown): void {
    this.responses.set(method, response);
  }

  /**
   * Set an error for a specific CDP method
   */
  setError(method: string, error: Error): void {
    this.errors.set(method, error);
  }

  /**
   * Simulate a CDP event
   */
  emitEvent(event: string, params: Record<string, unknown>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(params);
      }
    }
  }

  /**
   * Reset all mocks and configurations
   */
  reset(): void {
    this.sendSpy.mockClear();
    this.onSpy.mockClear();
    this.offSpy.mockClear();
    this.onceSpy.mockClear();
    this.closeSpy.mockClear();
    this.responses.clear();
    this.errors.clear();
    this.eventHandlers.clear();
    this._active = true;
  }

  /**
   * Set session active state (for testing closed sessions)
   */
  setActive(active: boolean): void {
    this._active = active;
  }
}
