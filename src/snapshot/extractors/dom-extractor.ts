/**
 * DOM Extractor
 *
 * Extracts DOM tree structure via CDP, handling shadow DOM and iframes.
 *
 * @module snapshot/extractors/dom-extractor
 *
 * CDP Domains:
 * - DOM.getDocument: Get document root with full tree
 * - DOM.describeNode: Get details for a specific node (if needed)
 * - DOM.requestChildNodes: Expand children (for incremental loading)
 */

import type { ExtractorContext, DomExtractionResult, RawDomNode } from './types.js';

/**
 * CDP DOM node structure (as returned by DOM.getDocument)
 */
interface CdpDomNode {
  nodeId: number;
  backendNodeId: number;
  nodeType: number;
  nodeName: string;
  localName?: string;
  nodeValue?: string;
  attributes?: string[];
  children?: CdpDomNode[];
  shadowRoots?: CdpDomNode[];
  contentDocument?: CdpDomNode;
  frameId?: string;
  shadowRootType?: 'open' | 'closed';
}

/**
 * CDP DOM.getDocument response
 */
interface DomGetDocumentResponse {
  root: CdpDomNode;
}

/**
 * Parse CDP attributes array into key-value object.
 * CDP returns attributes as flat array: [name1, value1, name2, value2, ...]
 *
 * @param attributes - Flat array of attribute name-value pairs
 * @returns Record of attribute names to values
 */
function parseAttributes(attributes?: string[]): Record<string, string> | undefined {
  if (!attributes || attributes.length === 0) {
    return undefined;
  }

  const result: Record<string, string> = {};
  for (let i = 0; i < attributes.length; i += 2) {
    const name = attributes[i];
    const value = attributes[i + 1] ?? '';
    result[name] = value;
  }
  return result;
}

/**
 * Context for tracking frame and shadow boundaries during traversal.
 */
interface TraversalContext {
  /** backendNodeIds of iframe ancestors (outermost first) */
  framePath: number[];
  /** backendNodeIds of shadow host ancestors (outermost first) */
  shadowPath: number[];
}

/**
 * Recursively traverse DOM tree and extract nodes.
 *
 * @param cdpNode - CDP DOM node
 * @param parentId - Parent node's backendNodeId (undefined for root)
 * @param nodes - Map to accumulate extracted nodes
 * @param frameIds - Set to accumulate discovered frame IDs
 * @param shadowRoots - Array to accumulate shadow root host backendNodeIds
 * @param ctx - Traversal context tracking frame and shadow paths
 */
function traverseNode(
  cdpNode: CdpDomNode,
  parentId: number | undefined,
  nodes: Map<number, RawDomNode>,
  frameIds: Set<string>,
  shadowRoots: number[],
  ctx: TraversalContext
): void {
  const backendNodeId = cdpNode.backendNodeId;

  // Determine shadow root type if this node hosts a shadow root
  let shadowRootType: 'open' | 'closed' | undefined;
  if (cdpNode.shadowRoots && cdpNode.shadowRoots.length > 0) {
    // Get the shadow root type from the first shadow root
    const firstShadowRoot = cdpNode.shadowRoots[0];
    shadowRootType = firstShadowRoot.shadowRootType;
    shadowRoots.push(backendNodeId);
  }

  // Track frame ID if this is an iframe
  let frameId: string | undefined;
  if (cdpNode.frameId) {
    frameId = cdpNode.frameId;
    frameIds.add(frameId);
  }

  // Collect child backendNodeIds
  const childNodeIds: number[] = [];
  if (cdpNode.children) {
    for (const child of cdpNode.children) {
      childNodeIds.push(child.backendNodeId);
    }
  }

  // Create the raw DOM node with frame/shadow path information
  const rawNode: RawDomNode = {
    nodeId: cdpNode.nodeId,
    backendNodeId,
    nodeName: cdpNode.nodeName,
    nodeType: cdpNode.nodeType,
    attributes: parseAttributes(cdpNode.attributes),
    childNodeIds: childNodeIds.length > 0 ? childNodeIds : undefined,
    shadowRootType,
    frameId,
    parentId,
    nodeValue: cdpNode.nodeValue,
    // Include frame/shadow paths if non-empty
    framePath: ctx.framePath.length > 0 ? [...ctx.framePath] : undefined,
    shadowPath: ctx.shadowPath.length > 0 ? [...ctx.shadowPath] : undefined,
  };

  nodes.set(backendNodeId, rawNode);

  // Recursively process children (same context)
  if (cdpNode.children) {
    for (const child of cdpNode.children) {
      traverseNode(child, backendNodeId, nodes, frameIds, shadowRoots, ctx);
    }
  }

  // Process shadow roots (add this host to shadow path)
  if (cdpNode.shadowRoots) {
    const shadowCtx: TraversalContext = {
      framePath: ctx.framePath,
      shadowPath: [...ctx.shadowPath, backendNodeId],
    };
    for (const shadowRoot of cdpNode.shadowRoots) {
      traverseNode(shadowRoot, backendNodeId, nodes, frameIds, shadowRoots, shadowCtx);
    }
  }

  // Process content document (add this iframe to frame path, reset shadow path)
  if (cdpNode.contentDocument) {
    const frameCtx: TraversalContext = {
      framePath: [...ctx.framePath, backendNodeId],
      shadowPath: [], // Reset shadow path when entering new frame
    };
    traverseNode(cdpNode.contentDocument, backendNodeId, nodes, frameIds, shadowRoots, frameCtx);
  }
}

/**
 * Extract DOM tree from page via CDP.
 *
 * @param ctx - Extractor context with CDP client and options
 * @returns DomExtractionResult with nodes map, root ID, and metadata
 */
export async function extractDom(ctx: ExtractorContext): Promise<DomExtractionResult> {
  const { cdp } = ctx;

  // Request full DOM tree with shadow DOM piercing
  const response = await cdp.send<DomGetDocumentResponse>('DOM.getDocument', {
    depth: -1, // Full depth
    pierce: true, // Pierce through iframes and shadow DOM
  });

  const nodes = new Map<number, RawDomNode>();
  const frameIds = new Set<string>();
  const shadowRoots: number[] = [];

  // Initial traversal context (empty paths for root document)
  const initialCtx: TraversalContext = {
    framePath: [],
    shadowPath: [],
  };

  // Traverse the tree starting from root
  traverseNode(response.root, undefined, nodes, frameIds, shadowRoots, initialCtx);

  return {
    nodes,
    rootId: response.root.backendNodeId,
    frameIds: Array.from(frameIds),
    shadowRoots,
  };
}
