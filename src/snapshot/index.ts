/**
 * Snapshot Module
 *
 * Exports snapshot types, compiler, and storage.
 */

// Types
export type {
  BaseSnapshot,
  Viewport,
  SnapshotMeta,
  ReadableNode,
  NodeKind,
  SemanticRegion,
  NodeLocation,
  NodeLayout,
  BBox,
  BoundingBox,
  ScreenZone,
  NodeState,
  NodeLocators,
  NodeAttributes,
  SnapshotOptions,
  SnapshotResult,
} from './snapshot.types.js';

// Type guards
export { isInteractiveNode, isReadableNode, isStructuralNode } from './snapshot.types.js';
