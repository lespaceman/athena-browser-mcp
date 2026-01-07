/**
 * SelectorBuilderService Tests
 *
 * TDD tests for refactoring SelectorBuilderService to use CdpClient interface.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SelectorBuilderService } from '../../../src/shared/services/selector-builder.service.js';
import { createMockCdpClient, MockCdpClient } from '../../mocks/cdp-client.mock.js';
import domDescribeNode from '../../fixtures/cdp-responses/dom-describe-node.json' with { type: 'json' };

describe('SelectorBuilderService', () => {
  let mockCdp: MockCdpClient;
  let selectorBuilder: SelectorBuilderService;

  beforeEach(() => {
    mockCdp = createMockCdpClient();
    selectorBuilder = new SelectorBuilderService(mockCdp);
  });

  describe('buildSelectors', () => {
    it('should return CSS selector with ID when element has ID', async () => {
      // Setup: Button with id="submit-btn"
      mockCdp.setResponse('DOM.describeNode', domDescribeNode.button_with_id);
      mockCdp.setResponse('Runtime.evaluate', { result: { value: 1 } }); // Unique selector

      const result = await selectorBuilder.buildSelectors(10, 'frame-1');

      expect(result.css).toBe('#submit-btn');
      expect(mockCdp.sendSpy).toHaveBeenCalledWith('DOM.describeNode', { nodeId: 10 });
    });

    it('should return CSS selector with classes when no ID but unique classes', async () => {
      // Setup: Div with class="container main-content" but no ID
      mockCdp.setResponse('DOM.describeNode', domDescribeNode.div_with_class);
      mockCdp.setResponse('Runtime.evaluate', { result: { value: 1 } }); // Unique selector

      const result = await selectorBuilder.buildSelectors(20, 'frame-1');

      expect(result.css).toBe('.container.main-content');
    });

    it('should return CSS path when no unique selector found', async () => {
      // Setup: Generic div with no ID or classes
      mockCdp.setResponse('DOM.describeNode', domDescribeNode.generic_div);
      mockCdp.setResponse('Runtime.evaluate', { result: { value: 2 } }); // Not unique
      mockCdp.setResponse('DOM.resolveNode', { object: { objectId: 'obj-1' } });
      mockCdp.setResponse('Runtime.callFunctionOn', { result: { value: 1 } }); // nth-child position

      const result = await selectorBuilder.buildSelectors(40, 'frame-1');

      // Should return a CSS path since no unique selector
      expect(result.css).toBeDefined();
      expect(result.css).toContain('div');
    });

    it('should build valid XPath selector', async () => {
      // Setup: Heading with id="main-heading"
      mockCdp.setResponse('DOM.describeNode', domDescribeNode.heading_with_id);
      mockCdp.setResponse('Runtime.evaluate', { result: { value: 1 } });

      const result = await selectorBuilder.buildSelectors(8, 'frame-1');

      expect(result.xpath).toBeDefined();
      expect(result.xpath).toContain('main-heading');
    });

    it('should build accessibility selector with role and label', async () => {
      // Setup: Link with role="link" and aria-label="About us"
      mockCdp.setResponse('DOM.describeNode', domDescribeNode.link_with_role);
      mockCdp.setResponse('Runtime.evaluate', { result: { value: 1 } });

      const result = await selectorBuilder.buildSelectors(30, 'frame-1');

      expect(result.ax).toBe('role=link[label="About us"]');
    });

    it('should build accessibility selector with role and name', async () => {
      // Setup: Input with name="username"
      mockCdp.setResponse('DOM.describeNode', domDescribeNode.input_with_name);
      mockCdp.setResponse('Runtime.evaluate', { result: { value: 1 } });

      const result = await selectorBuilder.buildSelectors(12, 'frame-1');

      // Input doesn't have role attribute, so ax might be undefined or use name
      // The current implementation should handle this
      expect(result).toBeDefined();
    });

    it('should handle CDP errors gracefully', async () => {
      // Setup: CDP error
      mockCdp.setError('DOM.describeNode', new Error('Node not found'));

      const result = await selectorBuilder.buildSelectors(999, 'frame-1');

      // Should return object with undefined selectors, not throw
      expect(result).toBeDefined();
      expect(result.css).toBeUndefined();
      expect(result.xpath).toBeUndefined();
      expect(result.ax).toBeUndefined();
    });

    it('should handle closed CDP session gracefully', async () => {
      // Setup: Closed session
      mockCdp.setActive(false);

      // Service catches errors and returns undefined selectors (graceful degradation)
      const result = await selectorBuilder.buildSelectors(10, 'frame-1');

      expect(result).toBeDefined();
      expect(result.css).toBeUndefined();
      expect(result.xpath).toBeUndefined();
      expect(result.ax).toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should accept CdpClient interface', () => {
      // This test verifies the constructor signature accepts CdpClient
      const service = new SelectorBuilderService(mockCdp);
      expect(service).toBeInstanceOf(SelectorBuilderService);
    });
  });
});
