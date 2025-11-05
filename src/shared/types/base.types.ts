/**
 * Shared base types used across all domains
 */

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Selectors {
  ax?: string;
  css?: string;
  xpath?: string;
}

export interface ElementRef {
  frameId: string;
  nodeId?: number;
  selectors: Selectors;
  bbox?: BBox;
  role?: string;
  label?: string;
  name?: string;
}

export type LocatorHint =
  | {
      role?: string;
      label?: string;
      name?: string;
      nearText?: string;
    }
  | {
      css?: string;
      xpath?: string;
      ax?: string;
    }
  | {
      bbox?: BBox;
    };

export interface DomTreeNode {
  id: string; // Unique identifier
  nodeId?: number; // CDP nodeId for DOM operations
  tag: string; // HTML tag name
  attrs?: string[]; // Attributes as [key, value, key, value, ...]
  text?: string; // Text content for text nodes
  children?: DomTreeNode[]; // Child nodes
}

export interface AxTreeNode {
  nodeId?: string;
  role?: string;
  name?: string;
  value?: { type: string; value: string };
  properties?: { name: string; value: unknown }[];
  childIds?: string[];
  backendDOMNodeId?: number;
}

export interface NetworkEvent {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  headers?: Record<string, string>;
}

export interface BrowserCookie extends Record<string, unknown> {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: number;
}

export interface SessionState {
  url: string;
  title?: string;
  cookies: BrowserCookie[];
  localStorage: Record<string, string>;
  timestamp: number;
}

export interface SiteProfile {
  knownSelectors?: Record<string, LocatorHint>;
  flows?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type StorageSnapshot = Record<string, string>;

export type NavWaitCondition = 'network-idle' | 'selector' | 'ax-role' | 'route-change';

export type WaitMatch =
  | { type: 'network-idle' }
  | { type: 'selector'; selector: string }
  | { type: 'ax-role'; roleName: string }
  | { type: 'route-change'; url: string };
