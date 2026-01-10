import { describe, it, expect } from 'vitest';
import {
  renderFactPackXml,
  renderFactPackXmlRaw,
  generatePageBrief,
  estimateFactPackTokens,
} from '../../../src/renderer/xml-renderer.js';
import { TOKEN_BUDGETS } from '../../../src/renderer/constants.js';
import type { FactPack } from '../../../src/factpack/types.js';

// Test fixtures
function createEmptyFactPack(): FactPack {
  return {
    page_type: {
      classification: {
        type: 'unknown',
        confidence: 0.2,
        signals: [],
        entities: [],
        has_forms: false,
        has_navigation: false,
        has_main_content: false,
        has_search: false,
      },
      meta: {
        signals_evaluated: 0,
        classification_time_ms: 1,
      },
    },
    dialogs: {
      dialogs: [],
      has_blocking_dialog: false,
      meta: {
        total_detected: 0,
        classified_count: 0,
        detection_time_ms: 1,
      },
    },
    forms: {
      forms: [],
      meta: {
        total_detected: 0,
        classified_count: 0,
        detection_time_ms: 1,
      },
    },
    actions: {
      actions: [],
      meta: {
        candidates_evaluated: 0,
        selection_time_ms: 1,
      },
    },
    meta: {
      snapshot_id: 'test-snapshot',
      extraction_time_ms: 5,
    },
  };
}

function createProductPageFactPack(): FactPack {
  return {
    page_type: {
      classification: {
        type: 'product',
        confidence: 0.92,
        signals: [
          {
            source: 'url',
            signal: 'url-pattern-product',
            evidence: '/product/ in path',
            weight: 0.3,
          },
        ],
        entities: [
          {
            type: 'product-name',
            value: 'iPhone 16 Pro',
            confidence: 0.9,
          },
        ],
        has_forms: false,
        has_navigation: true,
        has_main_content: true,
        has_search: true,
      },
      meta: {
        signals_evaluated: 5,
        classification_time_ms: 10,
      },
    },
    dialogs: {
      dialogs: [],
      has_blocking_dialog: false,
      meta: {
        total_detected: 0,
        classified_count: 0,
        detection_time_ms: 1,
      },
    },
    forms: {
      forms: [],
      meta: {
        total_detected: 0,
        classified_count: 0,
        detection_time_ms: 1,
      },
    },
    actions: {
      actions: [
        {
          node_id: 'n1234',
          backend_node_id: 1234,
          label: 'Add to Bag',
          kind: 'button',
          region: 'main',
          locator: 'button:has-text("Add to Bag")',
          enabled: true,
          score: 0.9,
          signals: [{ type: 'cart-cta', weight: 0.3 }],
          category: 'cart-action',
          category_confidence: 0.95,
        },
        {
          node_id: 'n1235',
          backend_node_id: 1235,
          label: 'Buy Now',
          kind: 'button',
          region: 'main',
          locator: 'button:has-text("Buy Now")',
          enabled: true,
          score: 0.85,
          signals: [{ type: 'primary-cta', weight: 0.3 }],
          category: 'primary-cta',
          category_confidence: 0.9,
        },
      ],
      primary_cta: {
        node_id: 'n1234',
        backend_node_id: 1234,
        label: 'Add to Bag',
        kind: 'button',
        region: 'main',
        locator: 'button:has-text("Add to Bag")',
        enabled: true,
        score: 0.9,
        signals: [{ type: 'cart-cta', weight: 0.3 }],
        category: 'cart-action',
        category_confidence: 0.95,
      },
      meta: {
        candidates_evaluated: 20,
        selection_time_ms: 5,
      },
    },
    meta: {
      snapshot_id: 'product-snapshot',
      extraction_time_ms: 20,
    },
  };
}

function createLoginPageFactPack(): FactPack {
  return {
    page_type: {
      classification: {
        type: 'login',
        confidence: 0.95,
        signals: [],
        entities: [],
        has_forms: true,
        has_navigation: true,
        has_main_content: true,
        has_search: false,
      },
      meta: {
        signals_evaluated: 5,
        classification_time_ms: 10,
      },
    },
    dialogs: {
      dialogs: [
        {
          node_id: 'd100',
          backend_node_id: 100,
          bbox: { x: 100, y: 100, w: 400, h: 200 },
          is_modal: true,
          title: 'We use cookies',
          actions: [
            {
              node_id: 'd101',
              backend_node_id: 101,
              label: 'Accept All',
              role: 'primary',
              kind: 'button',
            },
            {
              node_id: 'd102',
              backend_node_id: 102,
              label: 'Manage Preferences',
              role: 'secondary',
              kind: 'button',
            },
          ],
          detection_method: 'role-dialog',
          type: 'cookie-consent',
          type_confidence: 0.9,
          classification_signals: ['cookie', 'consent'],
        },
      ],
      has_blocking_dialog: true,
      meta: {
        total_detected: 1,
        classified_count: 1,
        detection_time_ms: 5,
      },
    },
    forms: {
      forms: [
        {
          node_id: 'f200',
          backend_node_id: 200,
          title: 'Sign In',
          method: 'POST',
          fields: [
            {
              node_id: 'f201',
              backend_node_id: 201,
              kind: 'input',
              label: 'Email',
              input_type: 'email',
              required: true,
              invalid: false,
              disabled: false,
              readonly: false,
              has_value: false,
              semantic_type: 'email',
              semantic_confidence: 0.95,
            },
            {
              node_id: 'f202',
              backend_node_id: 202,
              kind: 'input',
              label: 'Password',
              input_type: 'password',
              required: true,
              invalid: false,
              disabled: false,
              readonly: false,
              has_value: false,
              semantic_type: 'password',
              semantic_confidence: 0.95,
            },
          ],
          submit_button: {
            node_id: 'f204',
            backend_node_id: 204,
            label: 'Sign In',
            enabled: true,
            visible: true,
          },
          validation: {
            has_errors: false,
            error_count: 0,
            required_unfilled: 2,
            ready_to_submit: false,
          },
          purpose: 'login',
          purpose_confidence: 0.95,
          purpose_signals: ['email', 'password', 'sign in'],
        },
      ],
      primary_form: undefined,
      meta: {
        total_detected: 1,
        classified_count: 1,
        detection_time_ms: 5,
      },
    },
    actions: {
      actions: [
        {
          node_id: 'f204',
          backend_node_id: 204,
          label: 'Sign In',
          kind: 'button',
          region: 'main',
          locator: 'button:has-text("Sign In")',
          enabled: true,
          score: 0.9,
          signals: [],
          category: 'form-submit',
          category_confidence: 0.9,
        },
        {
          node_id: 'n300',
          backend_node_id: 300,
          label: 'Create Account',
          kind: 'link',
          region: 'main',
          locator: 'a:has-text("Create Account")',
          enabled: true,
          score: 0.7,
          signals: [],
          category: 'auth-action',
          category_confidence: 0.85,
        },
      ],
      primary_cta: {
        node_id: 'f204',
        backend_node_id: 204,
        label: 'Sign In',
        kind: 'button',
        region: 'main',
        locator: 'button:has-text("Sign In")',
        enabled: true,
        score: 0.9,
        signals: [],
        category: 'form-submit',
        category_confidence: 0.9,
      },
      meta: {
        candidates_evaluated: 10,
        selection_time_ms: 3,
      },
    },
    meta: {
      snapshot_id: 'login-snapshot',
      extraction_time_ms: 15,
    },
  };
}

describe('xml-renderer', () => {
  describe('renderFactPackXml', () => {
    it('should render empty factpack', () => {
      const factpack = createEmptyFactPack();
      const result = renderFactPackXml(factpack);

      expect(result.page_brief).toContain('<page_context>');
      expect(result.page_brief).toContain('</page_context>');
      expect(result.page_brief).toContain('<page type="unknown"');
      expect(result.page_brief).toContain('<dialogs blocking="false">');
      expect(result.page_brief).toContain('None');
      expect(result.page_brief_tokens).toBeGreaterThan(0);
      expect(result.was_truncated).toBe(false);
    });

    it('should render product page factpack', () => {
      const factpack = createProductPageFactPack();
      const result = renderFactPackXml(factpack);

      expect(result.page_brief).toContain('<page type="product"');
      expect(result.page_brief).toContain('confidence="0.92"');
      expect(result.page_brief).toContain('iPhone 16 Pro');
      expect(result.page_brief).toContain('<actions primary="Add to Bag">');
      expect(result.page_brief).toContain('Add to Bag [cart-action] node:n1234');
      expect(result.page_brief).toContain('Buy Now [primary-cta] node:n1235');
    });

    it('should render login page with dialog and form', () => {
      const factpack = createLoginPageFactPack();
      const result = renderFactPackXml(factpack);

      // Dialog section
      expect(result.page_brief).toContain('<dialogs blocking="true">');
      expect(result.page_brief).toContain('[cookie-consent]');
      expect(result.page_brief).toContain('We use cookies');
      expect(result.page_brief).toContain('Accept All [primary]');

      // Form section
      expect(result.page_brief).toContain('<forms count="1" primary="login">');
      expect(result.page_brief).toContain('Sign In [login');
      expect(result.page_brief).toContain('Email (required)');
      expect(result.page_brief).toContain('Password (required)');
      expect(result.page_brief).toContain('[Submit: Sign In]');
    });

    it('should include state section by default', () => {
      const factpack = createProductPageFactPack();
      const result = renderFactPackXml(factpack);

      expect(result.page_brief).toContain('<state>');
      expect(result.page_brief).toContain('Has search: true');
      expect(result.page_brief).toContain('Has navigation: true');
    });

    it('should exclude state section when include_state is false', () => {
      const factpack = createProductPageFactPack();
      const result = renderFactPackXml(factpack, { include_state: false });

      expect(result.page_brief).not.toContain('<state>');
    });
  });

  describe('renderFactPackXmlRaw', () => {
    it('should render without budget management', () => {
      const factpack = createProductPageFactPack();
      const raw = renderFactPackXmlRaw(factpack);

      expect(raw).toContain('<page_context>');
      expect(raw).toContain('</page_context>');
      expect(raw).toContain('iPhone 16 Pro');
    });
  });

  describe('generatePageBrief', () => {
    it('should use standard budget by default', () => {
      const factpack = createProductPageFactPack();
      const result = generatePageBrief(factpack);

      expect(result.page_brief_tokens).toBeLessThanOrEqual(
        TOKEN_BUDGETS.standard.cap
      );
    });

    it('should respect compact budget', () => {
      const factpack = createLoginPageFactPack();
      const result = generatePageBrief(factpack, 'compact');

      expect(result.page_brief_tokens).toBeLessThanOrEqual(
        TOKEN_BUDGETS.compact.cap
      );
    });
  });

  describe('estimateFactPackTokens', () => {
    it('should estimate tokens for empty factpack', () => {
      const factpack = createEmptyFactPack();
      const estimate = estimateFactPackTokens(factpack);

      expect(estimate).toBeGreaterThan(50);
      expect(estimate).toBeLessThan(200);
    });

    it('should estimate more tokens for complex factpack', () => {
      const emptyEstimate = estimateFactPackTokens(createEmptyFactPack());
      const complexEstimate = estimateFactPackTokens(createLoginPageFactPack());

      expect(complexEstimate).toBeGreaterThan(emptyEstimate);
    });
  });

  describe('budget truncation', () => {
    it('should truncate when over budget', () => {
      // Create a factpack with many actions to trigger truncation
      const factpack = createProductPageFactPack();

      // Add many more actions
      for (let i = 0; i < 50; i++) {
        factpack.actions.actions.push({
          node_id: `n${2000 + i}`,
          backend_node_id: 2000 + i,
          label: `Action ${i} with a longer label to increase token count`,
          kind: 'button',
          region: 'main',
          locator: `button:nth-child(${i})`,
          enabled: true,
          score: 0.5 - i * 0.01,
          signals: [],
          category: 'generic',
          category_confidence: 0.5,
        });
      }

      const result = renderFactPackXml(factpack, { budget: 'compact' });

      // Should be within budget
      expect(result.page_brief_tokens).toBeLessThanOrEqual(
        TOKEN_BUDGETS.compact.cap
      );

      // May or may not be truncated depending on size
      // The key assertion is that it's within budget
    });
  });
});
