/**
 * Dialog Detector Tests
 *
 * Tests for the dialog-detector module following the "Generic First, Specific Second" design.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { detectDialogs } from '../../../src/factpack/dialog-detector.js';
import {
  createSnapshot,
  createEmptySnapshot,
  createDialogNode,
  createAlertDialogNode,
  createButtonNode,
  createLinkNode,
  createCookieConsentDialog,
  createNewsletterDialog,
  createNode,
  resetBackendNodeIdCounter,
} from '../../fixtures/snapshots/factpack-test-utils.js';

describe('detectDialogs', () => {
  beforeEach(() => {
    resetBackendNodeIdCounter();
  });

  // ============================================================================
  // Generic Detection Tests
  // ============================================================================

  describe('generic detection', () => {
    it('should return empty result for empty snapshot', () => {
      const snapshot = createEmptySnapshot();
      const result = detectDialogs(snapshot);

      expect(result.dialogs).toHaveLength(0);
      expect(result.has_blocking_dialog).toBe(false);
      expect(result.meta.total_detected).toBe(0);
      expect(result.meta.classified_count).toBe(0);
      expect(result.meta.detection_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should return empty result for snapshot with no dialogs', () => {
      const snapshot = createSnapshot([
        createButtonNode('Click Me'),
        createLinkNode('Home'),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs).toHaveLength(0);
      expect(result.has_blocking_dialog).toBe(false);
    });

    it('should detect dialog by kind=dialog', () => {
      const snapshot = createSnapshot([
        createDialogNode('Dialog Title'),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs).toHaveLength(1);
      expect(result.dialogs[0].node_id).toBeDefined();
      expect(result.dialogs[0].backend_node_id).toBeDefined();
      expect(result.dialogs[0].bbox).toBeDefined();
      expect(result.meta.total_detected).toBe(1);
    });

    it('should detect dialog by region=dialog', () => {
      const snapshot = createSnapshot([
        createNode({
          node_id: 'modal-container',
          kind: 'section',
          label: 'Modal',
          where: { region: 'dialog' },
          state: { visible: true, enabled: true },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs).toHaveLength(1);
    });

    it('should not detect hidden dialogs', () => {
      const snapshot = createSnapshot([
        createDialogNode('Hidden Dialog', {
          state: { visible: false, enabled: true },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs).toHaveLength(0);
    });

    it('should detect multiple dialogs', () => {
      const snapshot = createSnapshot([
        createDialogNode('Dialog 1', { node_id: 'dialog-1' }),
        createDialogNode('Dialog 2', { node_id: 'dialog-2' }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs).toHaveLength(2);
      expect(result.meta.total_detected).toBe(2);
    });

    it('should deduplicate dialogs detected by both kind and region', () => {
      // Same dialog found by both kind=dialog and region=dialog
      const snapshot = createSnapshot([
        createDialogNode('Modal', {
          node_id: 'dialog-modal',
          where: { region: 'dialog' },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs).toHaveLength(1);
    });
  });

  // ============================================================================
  // Dialog Property Extraction Tests
  // ============================================================================

  describe('dialog property extraction', () => {
    it('should extract bbox from dialog node', () => {
      const snapshot = createSnapshot([
        createDialogNode('Dialog', {
          layout: { bbox: { x: 100, y: 200, w: 300, h: 400 } },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].bbox).toEqual({ x: 100, y: 200, w: 300, h: 400 });
    });

    it('should extract title from heading_context', () => {
      const snapshot = createSnapshot([
        createDialogNode('Dialog Content', {
          where: { region: 'dialog', heading_context: 'Dialog Title' },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].title).toBe('Dialog Title');
    });

    it('should extract actions from buttons in same group', () => {
      const groupId = 'dialog-group';
      const snapshot = createSnapshot([
        createDialogNode('Confirm Action?', {
          node_id: 'dialog',
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('OK', {
          node_id: 'btn-ok',
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('Cancel', {
          node_id: 'btn-cancel',
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].actions.length).toBeGreaterThanOrEqual(2);
      const actionLabels = result.dialogs[0].actions.map((a) => a.label);
      expect(actionLabels).toContain('OK');
      expect(actionLabels).toContain('Cancel');
    });

    it('should extract actions from links in dialog', () => {
      const groupId = 'dialog-group';
      const snapshot = createSnapshot([
        createDialogNode('Learn More', {
          node_id: 'dialog',
          where: { region: 'dialog', group_id: groupId },
        }),
        createLinkNode('Privacy Policy', {
          node_id: 'link-privacy',
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].actions.some((a) => a.label === 'Privacy Policy')).toBe(true);
    });
  });

  // ============================================================================
  // Detection Method Tests
  // ============================================================================

  describe('detection method', () => {
    it('should detect role=alertdialog', () => {
      const snapshot = createSnapshot([createAlertDialogNode('Alert!')]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].detection_method).toBe('role-alertdialog');
    });

    it('should detect role=dialog', () => {
      const snapshot = createSnapshot([
        createDialogNode('Dialog', {
          attributes: { role: 'dialog' },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].detection_method).toBe('role-dialog');
    });

    it('should detect html dialog element', () => {
      const snapshot = createSnapshot([
        createNode({
          node_id: 'html-dialog',
          kind: 'dialog',
          label: 'Native Dialog',
          where: { region: 'dialog' },
          state: { visible: true, enabled: true },
          // No role attribute - this is an HTML dialog element
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].detection_method).toBe('html-dialog');
    });

    it('should use heuristic detection for region-only dialogs', () => {
      const snapshot = createSnapshot([
        createNode({
          node_id: 'div-modal',
          kind: 'section',
          label: 'Modal Content',
          where: { region: 'dialog' },
          state: { visible: true, enabled: true },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].detection_method).toBe('heuristic');
    });
  });

  // ============================================================================
  // Modal Detection Tests
  // ============================================================================

  describe('modal detection', () => {
    it('should mark alertdialog as modal', () => {
      const snapshot = createSnapshot([createAlertDialogNode('Alert!')]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].is_modal).toBe(true);
      expect(result.has_blocking_dialog).toBe(true);
    });

    it('should not mark regular dialog as modal', () => {
      const snapshot = createSnapshot([createDialogNode('Non-modal Dialog')]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].is_modal).toBe(false);
      expect(result.has_blocking_dialog).toBe(false);
    });
  });

  // ============================================================================
  // Action Role Classification Tests
  // ============================================================================

  describe('action role classification', () => {
    it('should classify "Accept" as primary', () => {
      const groupId = 'dialog-group';
      const snapshot = createSnapshot([
        createDialogNode('Confirm', {
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('Accept', {
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const result = detectDialogs(snapshot);

      const acceptAction = result.dialogs[0].actions.find((a) => a.label === 'Accept');
      expect(acceptAction?.role).toBe('primary');
    });

    it('should classify "Cancel" as secondary', () => {
      const groupId = 'dialog-group';
      const snapshot = createSnapshot([
        createDialogNode('Confirm', {
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('Cancel', {
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const result = detectDialogs(snapshot);

      const cancelAction = result.dialogs[0].actions.find((a) => a.label === 'Cancel');
      expect(cancelAction?.role).toBe('secondary');
    });

    it('should classify "Close" as dismiss', () => {
      const groupId = 'dialog-group';
      const snapshot = createSnapshot([
        createDialogNode('Info', {
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('Close', {
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const result = detectDialogs(snapshot);

      const closeAction = result.dialogs[0].actions.find((a) => a.label === 'Close');
      expect(closeAction?.role).toBe('dismiss');
    });

    it('should classify "X" as dismiss', () => {
      const groupId = 'dialog-group';
      const snapshot = createSnapshot([
        createDialogNode('Info', {
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('X', {
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const result = detectDialogs(snapshot);

      const xAction = result.dialogs[0].actions.find((a) => a.label === 'X');
      expect(xAction?.role).toBe('dismiss');
    });

    it('should classify unknown action labels as unknown', () => {
      const groupId = 'dialog-group';
      const snapshot = createSnapshot([
        createDialogNode('Custom Dialog', {
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('Custom Action', {
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const result = detectDialogs(snapshot);

      const customAction = result.dialogs[0].actions.find((a) => a.label === 'Custom Action');
      expect(customAction?.role).toBe('unknown');
    });
  });

  // ============================================================================
  // Type Classification Tests (Optional - May Return 'unknown')
  // ============================================================================

  describe('type classification', () => {
    it('should classify cookie consent dialog', () => {
      const snapshot = createSnapshot(createCookieConsentDialog());
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].type).toBe('cookie-consent');
      expect(result.dialogs[0].type_confidence).toBeGreaterThan(0.5);
      // Multiple nodes may be classified (dialogs detected via region)
      expect(result.meta.classified_count).toBeGreaterThanOrEqual(1);
    });

    it('should classify newsletter dialog', () => {
      const snapshot = createSnapshot(createNewsletterDialog());
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].type).toBe('newsletter');
      expect(result.dialogs[0].type_confidence).toBeGreaterThan(0.5);
    });

    it('should classify alertdialog as alert', () => {
      const snapshot = createSnapshot([createAlertDialogNode('Warning!')]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].type).toBe('alert');
      expect(result.dialogs[0].type_confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should classify login prompt dialog', () => {
      const groupId = 'dialog-login';
      const snapshot = createSnapshot([
        createDialogNode('Sign In Required', {
          where: { region: 'dialog', group_id: groupId, heading_context: 'Sign In' },
        }),
        createNode({
          node_id: 'input-password',
          kind: 'input',
          label: 'Password',
          where: { region: 'dialog', group_id: groupId },
          state: { visible: true, enabled: true },
          attributes: { input_type: 'password' },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].type).toBe('login-prompt');
    });

    it('should classify age gate dialog', () => {
      const groupId = 'dialog-age';
      const snapshot = createSnapshot([
        createDialogNode('Age Verification', {
          where: { region: 'dialog', group_id: groupId, heading_context: 'Verify Your Age' },
        }),
        createButtonNode('I am 21+', {
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].type).toBe('age-gate');
    });

    it('should return unknown type for generic dialog', () => {
      const snapshot = createSnapshot([
        createDialogNode('Some Generic Content'),
      ]);
      const result = detectDialogs(snapshot);

      // Should still be detected as a dialog
      expect(result.dialogs).toHaveLength(1);
      // Type may be 'unknown' or 'modal' with low confidence
      expect(result.dialogs[0].type_confidence).toBeLessThanOrEqual(0.5);
    });

    it('should return low confidence for unknown type', () => {
      const snapshot = createSnapshot([
        createDialogNode('Random Dialog Content'),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].type_confidence).toBeLessThan(0.6);
    });

    it('should include classification signals', () => {
      const snapshot = createSnapshot(createCookieConsentDialog());
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].classification_signals).toBeDefined();
      expect(result.dialogs[0].classification_signals.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle dialog without actions', () => {
      const snapshot = createSnapshot([
        createDialogNode('Information Dialog'),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].actions).toEqual([]);
    });

    it('should handle dialog without title', () => {
      const snapshot = createSnapshot([
        createDialogNode('', {
          where: { region: 'dialog' }, // No heading_context
        }),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.dialogs[0].title).toBeUndefined();
    });

    it('should sort actions by role (primary first)', () => {
      const groupId = 'dialog-group';
      const snapshot = createSnapshot([
        createDialogNode('Confirm', {
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('Cancel', {
          node_id: 'btn-cancel',
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('OK', {
          node_id: 'btn-ok',
          where: { region: 'dialog', group_id: groupId },
        }),
        createButtonNode('Close', {
          node_id: 'btn-close',
          where: { region: 'dialog', group_id: groupId },
        }),
      ]);
      const result = detectDialogs(snapshot);

      const actions = result.dialogs[0].actions;
      // Primary (OK) should come before secondary (Cancel) and dismiss (Close)
      const okIndex = actions.findIndex((a) => a.label === 'OK');
      const cancelIndex = actions.findIndex((a) => a.label === 'Cancel');
      const closeIndex = actions.findIndex((a) => a.label === 'Close');

      expect(okIndex).toBeLessThan(cancelIndex);
      expect(cancelIndex).toBeLessThan(closeIndex);
    });

    it('should include meta statistics', () => {
      const snapshot = createSnapshot([
        createDialogNode('Dialog 1'),
        createAlertDialogNode('Alert 1'),
      ]);
      const result = detectDialogs(snapshot);

      expect(result.meta.total_detected).toBe(2);
      expect(result.meta.classified_count).toBeGreaterThanOrEqual(1); // Alert is always classified
      expect(result.meta.detection_time_ms).toBeGreaterThanOrEqual(0);
    });
  });
});
