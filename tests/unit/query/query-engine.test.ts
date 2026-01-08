/**
 * Query Engine Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryEngine } from '../../../src/query/query-engine.js';
import type { BaseSnapshot } from '../../../src/snapshot/snapshot.types.js';
import {
  createTestSnapshot,
  createTestNode,
  createButtonNode,
  createInputNode,
  createLinkNode,
  createHeadingNode,
  createNodeInRegion,
  createNodeInGroup,
  createNodeWithHeadingContext,
  createMultipleNodes,
  createEmptySnapshot,
  expectMatchedNodeIds,
  expectMatchedNodeIdsUnordered,
} from '../../fixtures/snapshots/query-test-utils.js';

// Import the fixture
import simplePageSnapshot from '../../fixtures/snapshots/simple-page-snapshot.json' with { type: 'json' };

describe('QueryEngine', () => {
  describe('constructor', () => {
    it('should create an engine from a snapshot', () => {
      const snapshot = createTestSnapshot([createTestNode()]);
      const engine = new QueryEngine(snapshot);

      expect(engine.getSnapshotInfo()).toEqual({
        snapshot_id: 'test-snapshot',
        node_count: 1,
      });
    });

    it('should accept custom default limit', () => {
      const nodes = createMultipleNodes(20);
      const snapshot = createTestSnapshot(nodes);
      const engine = new QueryEngine(snapshot, { defaultLimit: 5 });

      const result = engine.find({});
      expect(result.matches).toHaveLength(5);
      expect(result.stats.total_matched).toBe(20);
    });
  });

  describe('find', () => {
    describe('no filters', () => {
      it('should return all nodes when no filters (up to limit)', () => {
        const nodes = createMultipleNodes(5);
        const snapshot = createTestSnapshot(nodes);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({});

        expect(result.matches).toHaveLength(5);
        expect(result.stats.total_matched).toBe(5);
        expect(result.stats.nodes_evaluated).toBe(5);
      });

      it('should return empty array for empty snapshot', () => {
        const engine = new QueryEngine(createEmptySnapshot());

        const result = engine.find({});

        expect(result.matches).toHaveLength(0);
        expect(result.stats.total_matched).toBe(0);
      });
    });

    describe('filter by kind', () => {
      it('should filter by single kind', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('Submit'),
          createInputNode('Email'),
          createButtonNode('Cancel'),
          createLinkNode('Home'),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ kind: 'button' });

        expect(result.matches).toHaveLength(2);
        expectMatchedNodeIdsUnordered(result, ['button-submit', 'button-cancel']);
      });

      it('should filter by multiple kinds', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('Submit'),
          createInputNode('Email'),
          createLinkNode('Home'),
          createHeadingNode('Title'),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ kind: ['button', 'link'] });

        expect(result.matches).toHaveLength(2);
        expectMatchedNodeIdsUnordered(result, ['button-submit', 'link-home']);
      });

      it('should return empty when no nodes match kind', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('Submit'),
          createInputNode('Email'),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ kind: 'checkbox' });

        expect(result.matches).toHaveLength(0);
      });
    });

    describe('filter by label', () => {
      it('should filter by contains (default)', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('Sign In'),
          createButtonNode('Sign Up'),
          createButtonNode('Cancel'),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ label: 'Sign' });

        expect(result.matches).toHaveLength(2);
        expectMatchedNodeIdsUnordered(result, ['button-sign-in', 'button-sign-up']);
      });

      it('should filter by exact match', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('Sign In'),
          createButtonNode('Sign Up'),
          createButtonNode('Sign'),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ label: { text: 'Sign', mode: 'exact' } });

        expect(result.matches).toHaveLength(1);
        expectMatchedNodeIds(result, ['button-sign']);
      });

      it('should be case-insensitive by default', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('Submit'),
          createButtonNode('SUBMIT'),
          createButtonNode('submit'),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ label: 'submit' });

        expect(result.matches).toHaveLength(3);
      });

      it('should support case-sensitive matching', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('Submit'),
          createButtonNode('SUBMIT'),
          createButtonNode('submit'),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ label: { text: 'Submit', caseSensitive: true } });

        expect(result.matches).toHaveLength(1);
        expectMatchedNodeIds(result, ['button-submit']);
      });

      it('should handle empty label filter', () => {
        const nodes = createMultipleNodes(3);
        const snapshot = createTestSnapshot(nodes);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ label: '' });

        expect(result.matches).toHaveLength(3);
      });

      it('should normalize whitespace in labels', () => {
        const snapshot = createTestSnapshot([
          createTestNode({ node_id: 'n1', label: 'Hello   World' }),
          createTestNode({ node_id: 'n2', label: 'Hello World' }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ label: 'Hello World' });

        expect(result.matches).toHaveLength(2);
      });
    });

    describe('filter by region', () => {
      it('should filter by single region', () => {
        const snapshot = createTestSnapshot([
          createNodeInRegion('header', { node_id: 'h1', label: 'Header 1' }),
          createNodeInRegion('main', { node_id: 'm1', label: 'Main 1' }),
          createNodeInRegion('header', { node_id: 'h2', label: 'Header 2' }),
          createNodeInRegion('footer', { node_id: 'f1', label: 'Footer 1' }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ region: 'header' });

        expect(result.matches).toHaveLength(2);
        expectMatchedNodeIdsUnordered(result, ['h1', 'h2']);
      });

      it('should filter by multiple regions', () => {
        const snapshot = createTestSnapshot([
          createNodeInRegion('header', { node_id: 'h1' }),
          createNodeInRegion('main', { node_id: 'm1' }),
          createNodeInRegion('footer', { node_id: 'f1' }),
          createNodeInRegion('nav', { node_id: 'n1' }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ region: ['header', 'footer'] });

        expect(result.matches).toHaveLength(2);
        expectMatchedNodeIdsUnordered(result, ['h1', 'f1']);
      });
    });

    describe('filter by state', () => {
      it('should filter by visible state', () => {
        const snapshot = createTestSnapshot([
          createTestNode({
            node_id: 'n1',
            state: { visible: true, enabled: true },
          }),
          createTestNode({
            node_id: 'n2',
            state: { visible: false, enabled: true },
          }),
          createTestNode({
            node_id: 'n3',
            state: { visible: true, enabled: false },
          }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ state: { visible: true } });

        expect(result.matches).toHaveLength(2);
        expectMatchedNodeIdsUnordered(result, ['n1', 'n3']);
      });

      it('should filter by enabled state', () => {
        const snapshot = createTestSnapshot([
          createTestNode({
            node_id: 'n1',
            state: { visible: true, enabled: true },
          }),
          createTestNode({
            node_id: 'n2',
            state: { visible: true, enabled: false },
          }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ state: { enabled: true } });

        expect(result.matches).toHaveLength(1);
        expectMatchedNodeIds(result, ['n1']);
      });

      it('should filter by checked state', () => {
        const snapshot = createTestSnapshot([
          createTestNode({
            node_id: 'n1',
            kind: 'checkbox',
            state: { visible: true, enabled: true, checked: true },
          }),
          createTestNode({
            node_id: 'n2',
            kind: 'checkbox',
            state: { visible: true, enabled: true, checked: false },
          }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ state: { checked: true } });

        expect(result.matches).toHaveLength(1);
        expectMatchedNodeIds(result, ['n1']);
      });

      it('should combine multiple state constraints with AND', () => {
        const snapshot = createTestSnapshot([
          createTestNode({
            node_id: 'n1',
            state: { visible: true, enabled: true },
          }),
          createTestNode({
            node_id: 'n2',
            state: { visible: true, enabled: false },
          }),
          createTestNode({
            node_id: 'n3',
            state: { visible: false, enabled: true },
          }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ state: { visible: true, enabled: true } });

        expect(result.matches).toHaveLength(1);
        expectMatchedNodeIds(result, ['n1']);
      });

      it('should not match nodes without state', () => {
        const snapshot = createTestSnapshot([
          createTestNode({ node_id: 'n1' }), // no state
          createTestNode({
            node_id: 'n2',
            state: { visible: true, enabled: true },
          }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ state: { visible: true } });

        expect(result.matches).toHaveLength(1);
        expectMatchedNodeIds(result, ['n2']);
      });

      it('should treat undefined state property as false', () => {
        const snapshot = createTestSnapshot([
          createTestNode({
            node_id: 'n1',
            state: { visible: true, enabled: true }, // checked is undefined
          }),
          createTestNode({
            node_id: 'n2',
            state: { visible: true, enabled: true, checked: false },
          }),
        ]);
        const engine = new QueryEngine(snapshot);

        // Looking for checked: false should match both (undefined treated as false)
        const result = engine.find({ state: { checked: false } });

        expect(result.matches).toHaveLength(2);
      });
    });

    describe('filter by group_id', () => {
      it('should filter by exact group_id', () => {
        const snapshot = createTestSnapshot([
          createNodeInGroup('login-form', { node_id: 'n1' }),
          createNodeInGroup('login-form', { node_id: 'n2' }),
          createNodeInGroup('search-form', { node_id: 'n3' }),
          createTestNode({ node_id: 'n4' }), // no group
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ group_id: 'login-form' });

        expect(result.matches).toHaveLength(2);
        expectMatchedNodeIdsUnordered(result, ['n1', 'n2']);
      });
    });

    describe('filter by heading_context', () => {
      it('should filter by exact heading_context', () => {
        const snapshot = createTestSnapshot([
          createNodeWithHeadingContext('Sign In', { node_id: 'n1' }),
          createNodeWithHeadingContext('Sign In', { node_id: 'n2' }),
          createNodeWithHeadingContext('Sign Up', { node_id: 'n3' }),
          createTestNode({ node_id: 'n4' }), // no heading context
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ heading_context: 'Sign In' });

        expect(result.matches).toHaveLength(2);
        expectMatchedNodeIdsUnordered(result, ['n1', 'n2']);
      });
    });

    describe('combined filters', () => {
      it('should combine kind and region with AND', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('Header Button', { where: { region: 'header' } }),
          createButtonNode('Main Button', { where: { region: 'main' } }),
          createLinkNode('Header Link', { where: { region: 'header' } }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ kind: 'button', region: 'header' });

        expect(result.matches).toHaveLength(1);
        expectMatchedNodeIds(result, ['button-header-button']);
      });

      it('should combine kind, label, and state', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('Submit', {
            node_id: 'btn-enabled',
            state: { visible: true, enabled: true },
          }),
          createButtonNode('Submit', {
            node_id: 'btn-disabled',
            state: { visible: true, enabled: false },
          }),
          createButtonNode('Cancel', {
            node_id: 'btn-cancel',
            state: { visible: true, enabled: true },
          }),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({
          kind: 'button',
          label: 'Submit',
          state: { enabled: true },
        });

        expect(result.matches).toHaveLength(1);
        expectMatchedNodeIds(result, ['btn-enabled']);
      });
    });

    describe('limit', () => {
      it('should respect limit parameter', () => {
        const nodes = createMultipleNodes(10);
        const snapshot = createTestSnapshot(nodes);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ limit: 3 });

        expect(result.matches).toHaveLength(3);
        expect(result.stats.total_matched).toBe(10);
      });

      it('should return all if limit exceeds matches', () => {
        const nodes = createMultipleNodes(3);
        const snapshot = createTestSnapshot(nodes);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ limit: 100 });

        expect(result.matches).toHaveLength(3);
        expect(result.stats.total_matched).toBe(3);
      });
    });

    describe('stats', () => {
      it('should return query timing', () => {
        const snapshot = createTestSnapshot(createMultipleNodes(5));
        const engine = new QueryEngine(snapshot);

        const result = engine.find({});

        expect(result.stats.query_time_ms).toBeGreaterThanOrEqual(0);
        expect(result.stats.query_time_ms).toBeLessThan(100); // Should be fast
      });

      it('should report correct counts', () => {
        const snapshot = createTestSnapshot([
          createButtonNode('A'),
          createButtonNode('B'),
          createInputNode('C'),
        ]);
        const engine = new QueryEngine(snapshot);

        const result = engine.find({ kind: 'button', limit: 1 });

        expect(result.stats.total_matched).toBe(2); // Both buttons match
        expect(result.stats.nodes_evaluated).toBe(3); // All nodes evaluated
        expect(result.matches).toHaveLength(1); // But only 1 returned due to limit
      });
    });
  });

  describe('getById', () => {
    it('should return node by id', () => {
      const node = createButtonNode('Test');
      const snapshot = createTestSnapshot([node]);
      const engine = new QueryEngine(snapshot);

      const result = engine.getById('button-test');

      expect(result).toBeDefined();
      expect(result?.label).toBe('Test');
    });

    it('should return undefined for unknown id', () => {
      const snapshot = createTestSnapshot([createButtonNode('Test')]);
      const engine = new QueryEngine(snapshot);

      const result = engine.getById('unknown-id');

      expect(result).toBeUndefined();
    });
  });

  describe('getSnapshotInfo', () => {
    it('should return snapshot metadata', () => {
      const snapshot = createTestSnapshot(createMultipleNodes(5));
      const engine = new QueryEngine(snapshot);

      const info = engine.getSnapshotInfo();

      expect(info.snapshot_id).toBe('test-snapshot');
      expect(info.node_count).toBe(5);
    });
  });

  describe('getAllNodes', () => {
    it('should return all nodes up to limit', () => {
      const nodes = createMultipleNodes(10);
      const snapshot = createTestSnapshot(nodes);
      const engine = new QueryEngine(snapshot, { defaultLimit: 5 });

      const result = engine.getAllNodes();

      expect(result).toHaveLength(5);
    });

    it('should respect custom limit', () => {
      const nodes = createMultipleNodes(10);
      const snapshot = createTestSnapshot(nodes);
      const engine = new QueryEngine(snapshot);

      const result = engine.getAllNodes(3);

      expect(result).toHaveLength(3);
    });
  });

  describe('with real fixture', () => {
    let engine: QueryEngine;

    beforeEach(() => {
      engine = new QueryEngine(simplePageSnapshot as BaseSnapshot);
    });

    it('should find all buttons', () => {
      const result = engine.find({ kind: 'button' });

      expect(result.stats.total_matched).toBe(4);
      // Sign In, Sign Up, Submit, Disabled Button
    });

    it('should find all inputs', () => {
      const result = engine.find({ kind: 'input' });

      expect(result.stats.total_matched).toBe(3);
      // Email, Password, Search
    });

    it('should find nodes in login-form group', () => {
      const result = engine.find({ group_id: 'login-form' });

      expect(result.stats.total_matched).toBe(5);
      // Email, Password, Remember me, Submit, Forgot Password
    });

    it('should find enabled buttons in header', () => {
      const result = engine.find({
        kind: 'button',
        region: 'header',
        state: { enabled: true },
      });

      expect(result.stats.total_matched).toBe(2);
      // Sign In, Sign Up
    });

    it('should find nodes with Sign In heading context', () => {
      const result = engine.find({ heading_context: 'Sign In' });

      expect(result.stats.total_matched).toBe(2);
      // Email, Password
    });

    it('should find disabled buttons', () => {
      const result = engine.find({
        kind: 'button',
        state: { enabled: false },
      });

      expect(result.stats.total_matched).toBe(1);
      expect(result.matches[0].node.label).toBe('Disabled Button');
    });

    it('should find links in nav region', () => {
      const result = engine.find({
        kind: 'link',
        region: 'nav',
      });

      expect(result.stats.total_matched).toBe(3);
      // Home, About, Contact
    });
  });
});
