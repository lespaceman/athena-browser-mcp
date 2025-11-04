/**
 * Accessibility Tree Handler
 *
 * Handles ax_get_tree tool - extracts accessibility tree
 * This is one of the working implementations from the original server
 */

import type { AxGetTreeParams, AxGetTreeResponse } from '../perception.types.js';
import type { AxTreeNode } from '../../../shared/types/index.js';

interface CdpBridge {
  executeDevToolsMethod<T>(method: string, params?: unknown): Promise<T>;
}

/**
 * CDP raw AX node - role and name can be objects
 */
interface CdpAxTreeNode {
  nodeId?: string;
  role?: string | { type: string; value: string };
  name?: string | { type: string; value: string };
  value?: { type: string; value: string };
  properties?: Array<{ name: string; value: unknown }>;
  childIds?: string[];
  backendDOMNodeId?: number;
}

export class AxTreeHandler {
  constructor(private readonly cdpBridge: CdpBridge) {}

  /**
   * Get accessibility tree
   *
   * This implementation is already working in the original server
   */
  async handle(params: AxGetTreeParams): Promise<AxGetTreeResponse> {
    // CDP Accessibility.getFullAXTree doesn't take parameters for the main frame
    // If a specific frameId is provided, we'd need to get the actual CDP frameId first
    // For now, we'll just call it without parameters to get the full tree

    const result = await this.cdpBridge.executeDevToolsMethod<{ nodes?: CdpAxTreeNode[] }>(
      'Accessibility.getFullAXTree',
      {}, // Empty params for main frame
    );

    // Normalize nodes to ensure role and name are strings
    const normalizedNodes = (result.nodes ?? []).map((node) => this.normalizeNode(node));

    return {
      nodes: normalizedNodes,
    };
  }

  /**
   * Normalize AX tree node to ensure role and name are strings
   * CDP can return these as {type, value} objects
   */
  private normalizeNode(node: CdpAxTreeNode): AxTreeNode {
    return {
      ...node,
      role: this.extractStringValue(node.role),
      name: this.extractStringValue(node.name),
    };
  }

  /**
   * Extract string value from CDP value that can be string or {type, value} object
   */
  private extractStringValue(value: string | { type: string; value: string } | undefined): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && 'value' in value) return value.value;
    return undefined;
  }
}
