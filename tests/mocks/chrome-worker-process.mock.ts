/**
 * Chrome Worker Process Mock
 *
 * Mock implementation for testing components that depend on ChromeWorkerProcess.
 */

import { EventEmitter } from 'events';
import { vi, type Mock } from 'vitest';
import type { WorkerState } from '../../src/worker/types.js';

/**
 * Options for creating a mock Chrome process
 */
export interface MockChromeProcessOptions {
  /** Worker ID */
  workerId?: string;
  /** CDP port */
  port?: number;
  /** Profile directory */
  profileDir?: string;
  /** Initial state */
  initialState?: WorkerState;
  /** Whether start should fail */
  startShouldFail?: boolean;
  /** Error message if start fails */
  startErrorMessage?: string;
  /** Delay before start completes (ms) */
  startDelayMs?: number;
}

/**
 * Mock implementation of ChromeWorkerProcess for testing.
 *
 * @example
 * ```typescript
 * const mock = createMockChromeProcess({ port: 9300 });
 *
 * await mock.start();
 * expect(mock.state).toBe('running');
 *
 * mock.simulateCrash(1);
 * expect(mock.state).toBe('crashed');
 * ```
 */
export class MockChromeWorkerProcess extends EventEmitter {
  readonly workerId: string;
  readonly port: number;
  readonly profileDir: string;

  private _state: WorkerState;
  private _pid: number | undefined;
  private _cdpEndpoint: string | undefined;
  private options: MockChromeProcessOptions;

  // Mocked methods
  start: Mock<() => Promise<void>>;
  stop: Mock<(timeoutMs?: number) => Promise<void>>;
  kill: Mock<() => void>;

  constructor(options: MockChromeProcessOptions = {}) {
    super();

    this.workerId = options.workerId ?? 'mock-worker';
    this.port = options.port ?? 9300;
    this.profileDir = options.profileDir ?? '/tmp/mock-profile';
    this._state = options.initialState ?? 'idle';
    this.options = options;

    // Set up mocked methods
    this.start = vi.fn(async () => {
      if (this.options.startShouldFail) {
        this._state = 'crashed';
        throw new Error(this.options.startErrorMessage ?? 'Mock start failure');
      }

      this._state = 'starting';

      if (this.options.startDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, this.options.startDelayMs));
      }

      this._state = 'running';
      this._pid = Math.floor(Math.random() * 100000) + 1000;
      this._cdpEndpoint = `http://127.0.0.1:${this.port}`;

      this.emit('started', { pid: this._pid, cdpEndpoint: this._cdpEndpoint });
    });

    this.stop = vi.fn(() => {
      if (this._state === 'stopped' || this._state === 'stopping') {
        return Promise.resolve();
      }

      this._state = 'stopping';
      const exitCode = 0;
      this._state = 'stopped';
      this._pid = undefined;
      this._cdpEndpoint = undefined;

      this.emit('exit', { code: exitCode, signal: null });
      return Promise.resolve();
    });

    this.kill = vi.fn(() => {
      if (this._state === 'stopped') {
        return;
      }

      this._state = 'stopped';
      this._pid = undefined;
      this._cdpEndpoint = undefined;

      this.emit('exit', { code: null, signal: 'SIGKILL' });
    });
  }

  get state(): WorkerState {
    return this._state;
  }

  get pid(): number | undefined {
    return this._pid;
  }

  get cdpEndpoint(): string | undefined {
    return this._cdpEndpoint;
  }

  get isRunning(): boolean {
    return this._state === 'running';
  }

  /**
   * Simulate a crash with the given exit code
   */
  simulateCrash(exitCode = 1, signal: string | null = null): void {
    if (this._state === 'stopped') {
      return;
    }

    this._state = 'crashed';
    this._pid = undefined;
    this._cdpEndpoint = undefined;

    this.emit('exit', { code: exitCode, signal });
  }

  /**
   * Simulate an error event
   */
  simulateError(error: Error): void {
    this._state = 'crashed';
    this.emit('error', { error });
  }

  /**
   * Reset the mock to initial state
   */
  reset(): void {
    this._state = this.options.initialState ?? 'idle';
    this._pid = undefined;
    this._cdpEndpoint = undefined;
    this.start.mockClear();
    this.stop.mockClear();
    this.kill.mockClear();
    this.removeAllListeners();
  }
}

/**
 * Factory function to create a mock Chrome process
 */
export function createMockChromeProcess(
  options: MockChromeProcessOptions = {}
): MockChromeWorkerProcess {
  return new MockChromeWorkerProcess(options);
}

/**
 * Create a mock ChromeWorkerProcess constructor that returns the provided mock
 */
export function createMockChromeProcessFactory(mock: MockChromeWorkerProcess) {
  return vi.fn(() => mock);
}
