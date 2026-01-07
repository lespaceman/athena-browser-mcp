/**
 * Test Utilities
 *
 * Common test helpers and assertions for the test suite.
 */

import { expect } from 'vitest';

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  expect(value, message).toBeDefined();
  expect(value, message).not.toBeNull();
}

/**
 * Assert that an async function throws an error with a specific message
 */
export async function expectAsyncError(
  fn: () => Promise<unknown>,
  expectedMessage?: string | RegExp
): Promise<Error> {
  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  expect(error).toBeDefined();

  if (expectedMessage) {
    if (typeof expectedMessage === 'string') {
      expect(error!.message).toContain(expectedMessage);
    } else {
      expect(error!.message).toMatch(expectedMessage);
    }
  }

  return error!;
}

/**
 * Assert that a sync function throws an error with a specific message
 */
export function expectSyncError(fn: () => unknown, expectedMessage?: string | RegExp): Error {
  let error: Error | undefined;

  try {
    fn();
  } catch (e) {
    error = e as Error;
  }

  expect(error).toBeDefined();

  if (expectedMessage) {
    if (typeof expectedMessage === 'string') {
      expect(error!.message).toContain(expectedMessage);
    } else {
      expect(error!.message).toMatch(expectedMessage);
    }
  }

  return error!;
}

/**
 * Create a delay for async tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a unique ID for testing
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Assert object has expected properties
 */
export function expectProperties<T extends object>(
  obj: T,
  expectedProps: Partial<Record<keyof T, unknown>>
): void {
  for (const [key, value] of Object.entries(expectedProps)) {
    expect(obj).toHaveProperty(key);
    if (value !== undefined) {
      expect((obj as Record<string, unknown>)[key]).toEqual(value);
    }
  }
}

/**
 * Assert that a string is a valid UUID v4
 */
export function expectUuid(value: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect(value).toMatch(uuidRegex);
}

/**
 * Assert that a string matches a page_id format (page-{uuid})
 */
export function expectPageId(value: string): void {
  expect(value).toMatch(/^page-[0-9a-f-]+$/i);
}

/**
 * Assert that a string matches a session_id format (session-{uuid})
 */
export function expectSessionId(value: string): void {
  expect(value).toMatch(/^session-[0-9a-f-]+$/i);
}

/**
 * Assert that a Date is recent (within the last N seconds)
 */
export function expectRecentDate(date: Date, withinSeconds = 5): void {
  const now = Date.now();
  const dateMs = date.getTime();
  const diff = now - dateMs;

  expect(diff).toBeGreaterThanOrEqual(0);
  expect(diff).toBeLessThan(withinSeconds * 1000);
}

/**
 * Create a mock function that resolves after a delay
 */
export function createDelayedMock<T>(value: T, delayMs: number): () => Promise<T> {
  return async () => {
    await delay(delayMs);
    return value;
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await delay(interval);
  }

  throw new Error(`waitFor timeout after ${timeout}ms`);
}
