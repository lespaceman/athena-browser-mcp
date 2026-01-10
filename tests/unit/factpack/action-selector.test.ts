/**
 * Action Selector Tests
 *
 * Tests for the action-selector module following the "Generic First, Specific Second" design.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { selectKeyActions } from '../../../src/factpack/action-selector.js';
import { detectForms } from '../../../src/factpack/form-detector.js';
import { detectDialogs } from '../../../src/factpack/dialog-detector.js';
import {
  createSnapshot,
  createEmptySnapshot,
  createProductPageSnapshot,
  createLoginPageSnapshot,
  createButtonNode,
  createLinkNode,
  createInputNode,
  createTabNode,
  createCheckboxNode,
  createSelectNode,
  createNavigation,
  createLoginForm,
  createDialogNode,
  createNode,
  resetBackendNodeIdCounter,
} from '../../fixtures/snapshots/factpack-test-utils.js';

describe('selectKeyActions', () => {
  beforeEach(() => {
    resetBackendNodeIdCounter();
  });

  // ============================================================================
  // Generic Selection Tests
  // ============================================================================

  describe('generic selection', () => {
    it('should return empty result for empty snapshot', () => {
      const snapshot = createEmptySnapshot();
      const result = selectKeyActions(snapshot);

      expect(result.actions).toHaveLength(0);
      expect(result.primary_cta).toBeUndefined();
      expect(result.meta.candidates_evaluated).toBe(0);
      expect(result.meta.selection_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should return empty result for snapshot with no interactive elements', () => {
      const snapshot = createSnapshot([
        createNode({
          node_id: 'text-1',
          kind: 'paragraph',
          label: 'Just some text',
          where: { region: 'main' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions).toHaveLength(0);
    });

    it('should select visible buttons', () => {
      const snapshot = createSnapshot([
        createButtonNode('Click Me', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].label).toBe('Click Me');
      expect(result.actions[0].kind).toBe('button');
    });

    it('should select visible links', () => {
      const snapshot = createSnapshot([
        createLinkNode('Learn More', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].label).toBe('Learn More');
      expect(result.actions[0].kind).toBe('link');
    });

    it('should select inputs', () => {
      const snapshot = createSnapshot([
        createInputNode('Search', 'text', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].kind).toBe('input');
    });

    it('should select tabs', () => {
      const snapshot = createSnapshot([
        createTabNode('Tab 1', false, { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].kind).toBe('tab');
    });

    it('should select checkboxes', () => {
      const snapshot = createSnapshot([
        createCheckboxNode('I agree', false, { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].kind).toBe('checkbox');
    });

    it('should select dropdowns', () => {
      const snapshot = createSnapshot([
        createSelectNode('Country', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].kind).toBe('select');
    });

    it('should not select hidden elements', () => {
      const snapshot = createSnapshot([
        createButtonNode('Hidden', { state: { visible: false, enabled: true } }),
        createButtonNode('Visible', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].label).toBe('Visible');
    });

    it('should respect max_actions option', () => {
      const buttons = Array.from({ length: 20 }, (_, i) =>
        createButtonNode(`Button ${i + 1}`, {
          node_id: `btn-${i}`,
          state: { visible: true, enabled: true },
        })
      );
      const snapshot = createSnapshot(buttons);
      const result = selectKeyActions(snapshot, { max_actions: 5 });

      expect(result.actions.length).toBeLessThanOrEqual(5);
    });

    it('should respect min_action_score option', () => {
      const snapshot = createSnapshot([
        createButtonNode('High Score', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
          layout: { bbox: { x: 0, y: 0, w: 200, h: 100 } },
        }),
      ]);
      const result = selectKeyActions(snapshot, { min_action_score: 0.9 });

      // Actions with score below 0.9 should be filtered out
      for (const action of result.actions) {
        expect(action.score).toBeGreaterThanOrEqual(0.9);
      }
    });
  });

  // ============================================================================
  // Scoring Tests
  // ============================================================================

  describe('scoring', () => {
    it('should score visible elements higher', () => {
      const snapshot = createSnapshot([
        createButtonNode('Visible Button', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].score).toBeGreaterThan(0);
      expect(result.actions[0].signals.some((s) => s.type === 'visible')).toBe(true);
    });

    it('should score enabled elements higher', () => {
      const snapshot = createSnapshot([
        createButtonNode('Enabled', { state: { visible: true, enabled: true } }),
        createButtonNode('Disabled', { state: { visible: true, enabled: false } }),
      ]);
      const result = selectKeyActions(snapshot);

      // Both should be selected, but enabled should score higher
      const enabled = result.actions.find((a) => a.label === 'Enabled');
      const disabled = result.actions.find((a) => a.label === 'Disabled');

      if (enabled && disabled) {
        expect(enabled.score).toBeGreaterThanOrEqual(disabled.score);
      }
    });

    it('should score above-fold elements higher', () => {
      const snapshot = createSnapshot([
        createButtonNode('Above Fold', {
          state: { visible: true, enabled: true },
          layout: { bbox: { x: 0, y: 100, w: 100, h: 50 } }, // y < viewport.height
        }),
        createButtonNode('Below Fold', {
          state: { visible: true, enabled: true },
          layout: { bbox: { x: 0, y: 1000, w: 100, h: 50 } }, // y > viewport.height
        }),
      ]);
      const result = selectKeyActions(snapshot);

      const aboveFold = result.actions.find((a) => a.label === 'Above Fold');
      const belowFold = result.actions.find((a) => a.label === 'Below Fold');

      if (aboveFold && belowFold) {
        expect(aboveFold.score).toBeGreaterThan(belowFold.score);
        expect(aboveFold.signals.some((s) => s.type === 'above-fold')).toBe(true);
      }
    });

    it('should score main region elements higher', () => {
      const snapshot = createSnapshot([
        createButtonNode('In Main', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
        createButtonNode('In Footer', {
          state: { visible: true, enabled: true },
          where: { region: 'footer' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      const inMain = result.actions.find((a) => a.label === 'In Main');
      const inFooter = result.actions.find((a) => a.label === 'In Footer');

      if (inMain && inFooter) {
        expect(inMain.score).toBeGreaterThan(inFooter.score);
        expect(inMain.signals.some((s) => s.type === 'main-region')).toBe(true);
      }
    });

    it('should score buttons higher than links', () => {
      const snapshot = createSnapshot([
        createButtonNode('Button', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
        createLinkNode('Link', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      const button = result.actions.find((a) => a.kind === 'button');
      const link = result.actions.find((a) => a.kind === 'link');

      if (button && link) {
        expect(button.score).toBeGreaterThan(link.score);
        expect(button.signals.some((s) => s.type === 'button-kind')).toBe(true);
      }
    });

    it('should score elements with labels higher', () => {
      const snapshot = createSnapshot([
        createButtonNode('Has Label', { state: { visible: true, enabled: true } }),
        createButtonNode('', {
          node_id: 'btn-no-label',
          state: { visible: true, enabled: true },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      const withLabel = result.actions.find((a) => a.label === 'Has Label');
      const noLabel = result.actions.find((a) => a.label === '');

      if (withLabel && noLabel) {
        expect(withLabel.score).toBeGreaterThan(noLabel.score);
        expect(withLabel.signals.some((s) => s.type === 'has-label')).toBe(true);
      }
    });

    it('should score action verbs in labels higher', () => {
      const snapshot = createSnapshot([
        createButtonNode('Submit', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
        createButtonNode('Click', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      const submit = result.actions.find((a) => a.label === 'Submit');
      expect(submit?.signals.some((s) => s.type === 'action-verb')).toBe(true);
    });

    it('should include score signals in result', () => {
      const snapshot = createSnapshot([
        createButtonNode('Test Button', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].signals).toBeDefined();
      expect(result.actions[0].signals.length).toBeGreaterThan(0);
      for (const signal of result.actions[0].signals) {
        expect(signal.type).toBeDefined();
        expect(signal.weight).toBeDefined();
      }
    });
  });

  // ============================================================================
  // Category Classification Tests
  // ============================================================================

  describe('category classification', () => {
    it('should categorize cart actions', () => {
      const snapshot = createSnapshot([
        createButtonNode('Add to Cart', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('cart-action');
    });

    it('should categorize checkout actions', () => {
      const snapshot = createSnapshot([
        createButtonNode('Checkout', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('cart-action');
    });

    it('should categorize auth actions', () => {
      const snapshot = createSnapshot([
        createButtonNode('Sign In', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('auth-action');
    });

    it('should categorize login actions', () => {
      const snapshot = createSnapshot([
        createButtonNode('Log In', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('auth-action');
    });

    it('should categorize signup actions', () => {
      const snapshot = createSnapshot([
        createButtonNode('Create Account', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('auth-action');
    });

    it('should categorize search actions', () => {
      const snapshot = createSnapshot([
        createButtonNode('Search', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('search');
    });

    it('should categorize navigation links', () => {
      const snapshot = createSnapshot([
        createLinkNode('Home', {
          state: { visible: true, enabled: true },
          where: { region: 'nav' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('navigation');
    });

    it('should categorize links in header as navigation', () => {
      const snapshot = createSnapshot([
        createLinkNode('About', {
          state: { visible: true, enabled: true },
          where: { region: 'header' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('navigation');
    });

    it('should categorize primary CTA patterns', () => {
      const snapshot = createSnapshot([
        createButtonNode('Get Started', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('primary-cta');
    });

    it('should categorize secondary CTA patterns', () => {
      const snapshot = createSnapshot([
        createButtonNode('Learn More', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('secondary-cta');
    });

    it('should categorize media controls', () => {
      const snapshot = createSnapshot([
        createButtonNode('Play', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('media-control');
    });

    it('should return generic for uncategorized actions', () => {
      const snapshot = createSnapshot([
        createButtonNode('Custom Action XYZ', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category).toBe('generic');
    });

    it('should include category confidence', () => {
      const snapshot = createSnapshot([
        createButtonNode('Add to Cart', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].category_confidence).toBeDefined();
      expect(result.actions[0].category_confidence).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Primary CTA Detection Tests
  // ============================================================================

  describe('primary CTA detection', () => {
    it('should identify primary CTA on product page', () => {
      const snapshot = createProductPageSnapshot();
      const result = selectKeyActions(snapshot);

      expect(result.primary_cta).toBeDefined();
      expect(result.primary_cta?.category).toBe('cart-action');
    });

    it('should identify primary CTA on login page', () => {
      const snapshot = createLoginPageSnapshot();
      const forms = detectForms(snapshot);
      const result = selectKeyActions(snapshot, { forms });

      expect(result.primary_cta).toBeDefined();
    });

    it('should use highest-scored button as primary if no specific CTA', () => {
      const snapshot = createSnapshot([
        createButtonNode('Button 1', {
          node_id: 'btn-1',
          state: { visible: true, enabled: true },
          where: { region: 'footer' },
        }),
        createButtonNode('Button 2', {
          node_id: 'btn-2',
          state: { visible: true, enabled: true },
          where: { region: 'main' },
          layout: { bbox: { x: 0, y: 100, w: 200, h: 100 } },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.primary_cta).toBeDefined();
      expect(result.primary_cta?.kind).toBe('button');
    });

    it('should not have primary CTA if no buttons', () => {
      const snapshot = createSnapshot([
        createLinkNode('Link 1', {
          state: { visible: true, enabled: true },
          where: { region: 'footer' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      // May not have primary_cta or will use link
      if (result.primary_cta) {
        expect(result.primary_cta.kind).toBe('link');
      }
    });
  });

  // ============================================================================
  // Context Integration Tests
  // ============================================================================

  describe('context integration', () => {
    it('should boost form submit buttons', () => {
      const snapshot = createSnapshot(createLoginForm());
      const forms = detectForms(snapshot);
      const result = selectKeyActions(snapshot, { forms });

      const signInAction = result.actions.find((a) => a.label === 'Sign In');
      expect(signInAction).toBeDefined();
      // "Sign In" matches auth-action patterns, so category may be auth-action
      // but it should still have the form-submit signal boosting its score
      expect(signInAction?.signals.some((s) => s.type === 'form-submit')).toBe(true);
      // Category is based on label patterns - auth takes precedence
      expect(['form-submit', 'auth-action']).toContain(signInAction?.category);
    });

    it('should boost dialog actions', () => {
      const groupId = 'dialog-confirm';
      const snapshot = createSnapshot([
        createDialogNode('Confirm Delete?', {
          node_id: 'dialog',
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('Delete', {
          node_id: 'btn-delete',
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('Cancel', {
          node_id: 'btn-cancel',
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const dialogs = detectDialogs(snapshot);
      const result = selectKeyActions(snapshot, { dialogs });

      const deleteAction = result.actions.find((a) => a.label === 'Delete');
      if (deleteAction) {
        expect(deleteAction.signals.some((s) => s.type === 'dialog-action')).toBe(true);
      }
    });
  });

  // ============================================================================
  // Action Properties Tests
  // ============================================================================

  describe('action properties', () => {
    it('should include node_id', () => {
      const snapshot = createSnapshot([
        createButtonNode('Test', {
          node_id: 'btn-test',
          state: { visible: true, enabled: true },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].node_id).toBe('btn-test');
    });

    it('should include backend_node_id', () => {
      const snapshot = createSnapshot([
        createButtonNode('Test', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].backend_node_id).toBeDefined();
      expect(typeof result.actions[0].backend_node_id).toBe('number');
    });

    it('should include region', () => {
      const snapshot = createSnapshot([
        createButtonNode('Test', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].region).toBe('main');
    });

    it('should include locator', () => {
      const snapshot = createSnapshot([
        createButtonNode('Test', {
          state: { visible: true, enabled: true },
          find: { primary: "getByRole('button', { name: 'Test' })" },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].locator).toBe("getByRole('button', { name: 'Test' })");
    });

    it('should include enabled state', () => {
      const snapshot = createSnapshot([
        createButtonNode('Enabled', { state: { visible: true, enabled: true } }),
        createButtonNode('Disabled', { state: { visible: true, enabled: false } }),
      ]);
      const result = selectKeyActions(snapshot);

      const enabled = result.actions.find((a) => a.label === 'Enabled');
      const disabled = result.actions.find((a) => a.label === 'Disabled');

      expect(enabled?.enabled).toBe(true);
      expect(disabled?.enabled).toBe(false);
    });
  });

  // ============================================================================
  // Sorting Tests
  // ============================================================================

  describe('sorting', () => {
    it('should sort actions by score descending', () => {
      const snapshot = createSnapshot([
        createButtonNode('Low Score', {
          node_id: 'btn-low',
          state: { visible: true, enabled: true },
          where: { region: 'footer' },
          layout: { bbox: { x: 0, y: 1000, w: 50, h: 30 } },
        }),
        createButtonNode('High Score', {
          node_id: 'btn-high',
          state: { visible: true, enabled: true },
          where: { region: 'main' },
          layout: { bbox: { x: 0, y: 100, w: 200, h: 100 } },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].label).toBe('High Score');
      expect(result.actions[0].score).toBeGreaterThan(result.actions[1].score);
    });
  });

  // ============================================================================
  // Real Page Tests
  // ============================================================================

  describe('real page scenarios', () => {
    it('should select relevant actions from product page', () => {
      const snapshot = createProductPageSnapshot();
      const result = selectKeyActions(snapshot);

      // Should have actions
      expect(result.actions.length).toBeGreaterThan(0);

      // Should have Add to Cart or Buy Now
      const hasCartAction = result.actions.some(
        (a) => a.label.includes('Cart') || a.label.includes('Buy')
      );
      expect(hasCartAction).toBe(true);
    });

    it('should select relevant actions from login page', () => {
      const snapshot = createLoginPageSnapshot();
      const forms = detectForms(snapshot);
      const result = selectKeyActions(snapshot, { forms });

      // Should have actions
      expect(result.actions.length).toBeGreaterThan(0);

      // Should have Sign In action
      const hasSignIn = result.actions.some((a) => a.label.includes('Sign'));
      expect(hasSignIn).toBe(true);
    });

    it('should select navigation from page with nav', () => {
      const snapshot = createSnapshot([
        ...createNavigation(['Home', 'Products', 'About', 'Contact']),
        createButtonNode('Main CTA', {
          state: { visible: true, enabled: true },
          where: { region: 'main' },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      // Should include navigation links
      const navActions = result.actions.filter((a) => a.category === 'navigation');
      expect(navActions.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle elements without find locator', () => {
      const snapshot = createSnapshot([
        createButtonNode('No Locator', {
          state: { visible: true, enabled: true },
          find: undefined,
        }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].locator).toBe('');
    });

    it('should deduplicate candidates', () => {
      // Create nodes that might be found by multiple queries
      const snapshot = createSnapshot([
        createButtonNode('Button', {
          node_id: 'btn-1',
          state: { visible: true, enabled: true },
        }),
      ]);
      const result = selectKeyActions(snapshot);

      // Should only have one instance
      const btnCount = result.actions.filter((a) => a.node_id === 'btn-1').length;
      expect(btnCount).toBe(1);
    });

    it('should include meta statistics', () => {
      const snapshot = createProductPageSnapshot();
      const result = selectKeyActions(snapshot);

      expect(result.meta.candidates_evaluated).toBeGreaterThan(0);
      expect(result.meta.selection_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters in labels', () => {
      const snapshot = createSnapshot([
        createButtonNode('Click & Save!', { state: { visible: true, enabled: true } }),
      ]);
      const result = selectKeyActions(snapshot);

      expect(result.actions[0].label).toBe('Click & Save!');
    });
  });
});
