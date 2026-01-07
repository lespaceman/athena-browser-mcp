/**
 * Shared base types
 *
 * Minimal types kept for the new semantic snapshot system.
 * New types for BaseSnapshot, ReadableNode, etc. will be added here.
 */

/**
 * Bounding box for element geometry
 */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Network request/response event
 */
export interface NetworkEvent {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Selector types for element location
 */
export interface Selectors {
  ax?: string;
  css?: string;
  xpath?: string;
}

/**
 * DOM tree node representation (used by dom-transformer service)
 */
export interface DomTreeNode {
  id: string;
  nodeId?: number;
  tag: string;
  attrs?: string[];
  text?: string;
  children?: DomTreeNode[];
}
