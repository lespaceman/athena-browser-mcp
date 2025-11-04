/**
 * Mock CDP Bridge for testing
 */

import type { AxTreeNode, BBox, NetworkEvent } from '../../src/shared/types/index.js';

export interface CdpMethodResult {
  [key: string]: unknown;
}

export class MockCefBridge {
  private mockResponses: Map<string, unknown> = new Map();
  private methodCalls: Array<{ method: string; params?: unknown }> = [];

  /**
   * Mock implementation of executeDevToolsMethod
   */
  async executeDevToolsMethod<T = CdpMethodResult>(
    method: string,
    params?: unknown,
  ): Promise<T> {
    this.methodCalls.push({ method, params });

    const mockResponse = this.mockResponses.get(method);
    if (mockResponse !== undefined) {
      return mockResponse as T;
    }

    // Default mock responses for common methods
    return this.getDefaultResponse<T>(method, params);
  }

  /**
   * Set a mock response for a specific CDP method
   */
  setMockResponse(method: string, response: unknown): void {
    this.mockResponses.set(method, response);
  }

  /**
   * Get all method calls made during test
   */
  getMethodCalls(): Array<{ method: string; params?: unknown }> {
    return [...this.methodCalls];
  }

  /**
   * Get method calls filtered by method name
   */
  getMethodCallsByName(method: string): Array<{ method: string; params?: unknown }> {
    return this.methodCalls.filter((call) => call.method === method);
  }

  /**
   * Clear all method calls and mock responses
   */
  reset(): void {
    this.methodCalls = [];
    this.mockResponses.clear();
  }

  /**
   * Get default mock responses for common CDP methods
   */
  private getDefaultResponse<T>(method: string, params?: unknown): T {
    const defaults: Record<string, unknown> = {
      'Accessibility.getFullAXTree': {
        nodes: [
          {
            nodeId: 'ax-1',
            role: 'WebArea',
            name: 'Test Page',
            states: ['focusable'],
          } as AxTreeNode,
        ],
      },
      'DOM.getDocument': {
        root: {
          nodeId: 1,
          nodeType: 9,
          nodeName: '#document',
          localName: '',
          nodeValue: '',
          childNodeCount: 1,
          children: [
            {
              nodeId: 2,
              nodeType: 1,
              nodeName: 'HTML',
              localName: 'html',
              nodeValue: '',
              attributes: [],
              childNodeCount: 2,
            },
          ],
        },
      },
      'DOM.querySelector': {
        nodeId: 100,
      },
      'DOM.getBoxModel': {
        model: {
          content: [0, 0, 100, 0, 100, 50, 0, 50] as number[],
          padding: [0, 0, 100, 0, 100, 50, 0, 50] as number[],
          border: [0, 0, 100, 0, 100, 50, 0, 50] as number[],
          margin: [0, 0, 100, 0, 100, 50, 0, 50] as number[],
          width: 100,
          height: 50,
        },
      },
      'Runtime.evaluate': {
        result: { value: true },
      },
      'Input.dispatchMouseEvent': {},
      'Input.dispatchKeyEvent': {},
      'Page.navigate': {
        frameId: 'main',
        loaderId: 'loader-1',
      },
    };

    return (defaults[method] ?? {}) as T;
  }

  // Additional helper methods

  async captureScreenshot(_region?: BBox): Promise<string> {
    return 'mock-base64-screenshot-data';
  }

  getObservedNetworkEvents(): NetworkEvent[] {
    return [];
  }

  async readFileForUpload(_path: string): Promise<string> {
    return 'mock-base64-file-data';
  }

  async getSafetyPolicy(): Promise<Record<string, unknown>> {
    return {
      allowedDomains: ['example.com'],
      blockedDomains: [],
    };
  }

  async setSafetyPolicy(_policy: Record<string, unknown>): Promise<void> {
    // Mock implementation
  }
}
