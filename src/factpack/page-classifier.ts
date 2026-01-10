/**
 * Page Classifier
 *
 * Classifies page type based on URL, title, and content analysis.
 *
 * Design: Generic First, Specific Second
 * 1. Collect signals from URL, title, and content (always useful)
 * 2. Calculate type scores (may result in 'unknown')
 * 3. Extract entities where possible
 * 4. Always return useful summary info (has_forms, has_navigation, etc.)
 */

import type { BaseSnapshot } from '../snapshot/snapshot.types.js';
import { QueryEngine } from '../query/query-engine.js';
import { normalizeText } from '../lib/text-utils.js';
import type {
  PageClassificationResult,
  PageClassification,
  PageSignal,
  PageEntity,
  PageType,
  FormDetectionResult,
} from './types.js';

// ============================================================================
// URL Pattern Mappings
// ============================================================================

/** URL path patterns that indicate page types */
const URL_PATTERNS: { pattern: RegExp; type: PageType; weight: number }[] = [
  // High confidence patterns
  { pattern: /\/cart\/?$/i, type: 'cart', weight: 0.9 },
  { pattern: /\/basket\/?$/i, type: 'cart', weight: 0.9 },
  { pattern: /\/checkout/i, type: 'checkout', weight: 0.9 },
  { pattern: /\/login\/?$/i, type: 'login', weight: 0.85 },
  { pattern: /\/signin\/?$/i, type: 'login', weight: 0.85 },
  { pattern: /\/sign-in\/?$/i, type: 'login', weight: 0.85 },
  { pattern: /\/auth\/?$/i, type: 'login', weight: 0.7 },
  { pattern: /\/signup\/?$/i, type: 'signup', weight: 0.85 },
  { pattern: /\/sign-up\/?$/i, type: 'signup', weight: 0.85 },
  { pattern: /\/register\/?$/i, type: 'signup', weight: 0.85 },

  // Product patterns
  { pattern: /\/product\//i, type: 'product', weight: 0.8 },
  { pattern: /\/item\//i, type: 'product', weight: 0.8 },
  { pattern: /\/p\//i, type: 'product', weight: 0.7 },
  { pattern: /\/dp\//i, type: 'product', weight: 0.8 }, // Amazon style
  { pattern: /\/products\/?$/i, type: 'product-listing', weight: 0.75 },
  { pattern: /\/shop\/?$/i, type: 'product-listing', weight: 0.6 },

  // Category/listing patterns
  { pattern: /\/category\//i, type: 'category', weight: 0.75 },
  { pattern: /\/c\//i, type: 'category', weight: 0.6 },
  { pattern: /\/collections?\//i, type: 'category', weight: 0.7 },

  // Search patterns
  { pattern: /\/search/i, type: 'search-results', weight: 0.8 },
  { pattern: /[?&]q=/i, type: 'search-results', weight: 0.75 },
  { pattern: /[?&]query=/i, type: 'search-results', weight: 0.75 },
  { pattern: /[?&]search=/i, type: 'search-results', weight: 0.75 },

  // Content patterns
  { pattern: /\/blog\//i, type: 'article', weight: 0.75 },
  { pattern: /\/article\//i, type: 'article', weight: 0.8 },
  { pattern: /\/post\//i, type: 'article', weight: 0.75 },
  { pattern: /\/news\//i, type: 'article', weight: 0.7 },

  // Account patterns
  { pattern: /\/account\/?$/i, type: 'account', weight: 0.8 },
  { pattern: /\/profile\/?$/i, type: 'account', weight: 0.8 },
  { pattern: /\/settings\/?$/i, type: 'account', weight: 0.7 },
  { pattern: /\/my-account/i, type: 'account', weight: 0.8 },

  // Info pages
  { pattern: /\/about\/?$/i, type: 'about', weight: 0.8 },
  { pattern: /\/about-us\/?$/i, type: 'about', weight: 0.8 },
  { pattern: /\/contact\/?$/i, type: 'contact', weight: 0.8 },
  { pattern: /\/contact-us\/?$/i, type: 'contact', weight: 0.8 },
  { pattern: /\/help\/?$/i, type: 'documentation', weight: 0.7 },
  { pattern: /\/docs?\/?$/i, type: 'documentation', weight: 0.8 },
  { pattern: /\/documentation\//i, type: 'documentation', weight: 0.85 },
  { pattern: /\/faq\/?$/i, type: 'documentation', weight: 0.7 },

  // Error pages
  { pattern: /\/404\/?$/i, type: 'error', weight: 0.9 },
  { pattern: /\/error\/?$/i, type: 'error', weight: 0.8 },
  { pattern: /\/not-found\/?$/i, type: 'error', weight: 0.85 },

  // Homepage (low weight - needs corroboration)
  { pattern: /^\/?$/, type: 'homepage', weight: 0.5 },
];

// ============================================================================
// Title Pattern Mappings
// ============================================================================

/** Title patterns that indicate page types */
const TITLE_PATTERNS: { pattern: RegExp; type: PageType; weight: number }[] = [
  // Auth
  { pattern: /\bsign in\b/i, type: 'login', weight: 0.7 },
  { pattern: /\blog in\b/i, type: 'login', weight: 0.7 },
  { pattern: /\blogin\b/i, type: 'login', weight: 0.7 },
  { pattern: /\bsign up\b/i, type: 'signup', weight: 0.7 },
  { pattern: /\bregister\b/i, type: 'signup', weight: 0.65 },
  { pattern: /\bcreate account\b/i, type: 'signup', weight: 0.7 },

  // Commerce
  { pattern: /\bshopping cart\b/i, type: 'cart', weight: 0.85 },
  { pattern: /\byour cart\b/i, type: 'cart', weight: 0.85 },
  { pattern: /\bcheckout\b/i, type: 'checkout', weight: 0.8 },
  { pattern: /\bpayment\b/i, type: 'checkout', weight: 0.6 },

  // Content
  { pattern: /\b(blog|article|post)\b/i, type: 'article', weight: 0.5 },

  // Error
  { pattern: /\b404\b/i, type: 'error', weight: 0.9 },
  { pattern: /\bpage not found\b/i, type: 'error', weight: 0.9 },
  { pattern: /\berror\b/i, type: 'error', weight: 0.5 },
  { pattern: /\b500\b/i, type: 'error', weight: 0.85 },
  { pattern: /\bserver error\b/i, type: 'error', weight: 0.85 },

  // Info
  { pattern: /\babout us\b/i, type: 'about', weight: 0.8 },
  { pattern: /\bcontact us\b/i, type: 'contact', weight: 0.8 },
  { pattern: /\bhelp\b/i, type: 'documentation', weight: 0.5 },
  { pattern: /\bdocumentation\b/i, type: 'documentation', weight: 0.7 },

  // Search
  { pattern: /\bsearch results\b/i, type: 'search-results', weight: 0.85 },
];

// ============================================================================
// Content Patterns
// ============================================================================

/** Button/link labels indicating cart functionality */
const CART_ACTION_PATTERNS = [
  /\badd to cart\b/i,
  /\badd to bag\b/i,
  /\badd to basket\b/i,
  /\bbuy now\b/i,
  /\bpurchase\b/i,
];

/** Patterns for auth-related actions */
const AUTH_ACTION_PATTERNS = [/\bsign in\b/i, /\blog in\b/i, /\bsign up\b/i, /\bregister\b/i];

/** Patterns for price display */
const PRICE_PATTERNS = [
  /\$\d+(\.\d{2})?/, // $XX.XX
  /€\d+([.,]\d{2})?/, // €XX,XX
  /£\d+(\.\d{2})?/, // £XX.XX
  /\d+([.,]\d{2})?\s*(USD|EUR|GBP)/i,
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Analyze URL for page type signals.
 */
function analyzeUrl(url: string): PageSignal[] {
  const signals: PageSignal[] = [];

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    for (const { pattern, type, weight } of URL_PATTERNS) {
      if (pattern.test(pathname) || pattern.test(url)) {
        signals.push({
          source: 'url',
          signal: `url-pattern-${type}`,
          evidence: `URL matches pattern: ${pattern.source}`,
          weight,
        });
      }
    }
  } catch {
    // Invalid URL - no signals
  }

  return signals;
}

/**
 * Analyze title for page type signals.
 */
function analyzeTitle(title: string): PageSignal[] {
  const signals: PageSignal[] = [];
  const normalized = normalizeText(title);

  for (const { pattern, type, weight } of TITLE_PATTERNS) {
    if (pattern.test(normalized)) {
      signals.push({
        source: 'title',
        signal: `title-pattern-${type}`,
        evidence: `Title contains: ${pattern.source}`,
        weight,
      });
    }
  }

  return signals;
}

/**
 * Analyze content for page type signals.
 */
function analyzeContent(
  snapshot: BaseSnapshot,
  engine: QueryEngine,
  formResult?: FormDetectionResult
): PageSignal[] {
  const signals: PageSignal[] = [];

  // Check for forms with specific purposes
  if (formResult) {
    for (const form of formResult.forms) {
      if (form.purpose === 'login') {
        signals.push({
          source: 'form',
          signal: 'form-purpose-login',
          evidence: 'Login form detected',
          weight: 0.85,
        });
      } else if (form.purpose === 'signup') {
        signals.push({
          source: 'form',
          signal: 'form-purpose-signup',
          evidence: 'Signup form detected',
          weight: 0.85,
        });
      } else if (form.purpose === 'checkout') {
        signals.push({
          source: 'form',
          signal: 'form-purpose-checkout',
          evidence: 'Checkout form detected',
          weight: 0.9,
        });
      } else if (form.purpose === 'contact') {
        signals.push({
          source: 'form',
          signal: 'form-purpose-contact',
          evidence: 'Contact form detected',
          weight: 0.8,
        });
      } else if (form.purpose === 'search') {
        signals.push({
          source: 'form',
          signal: 'form-purpose-search',
          evidence: 'Search form detected',
          weight: 0.5, // Low weight - many pages have search
        });
      }
    }
  }

  // Check for cart action buttons
  const buttons = engine.find({ kind: 'button', limit: 50 });
  for (const match of buttons.matches) {
    const label = normalizeText(match.node.label);
    if (CART_ACTION_PATTERNS.some((p) => p.test(label))) {
      signals.push({
        source: 'element',
        signal: 'cart-action-button',
        evidence: `Add to cart button: "${match.node.label}"`,
        weight: 0.75,
      });
      break; // Only count once
    }
  }

  // Check for auth action buttons
  for (const match of buttons.matches) {
    const label = normalizeText(match.node.label);
    if (AUTH_ACTION_PATTERNS.some((p) => p.test(label))) {
      // Context matters - in header vs main content
      if (match.node.where.region === 'main') {
        signals.push({
          source: 'element',
          signal: 'auth-action-main',
          evidence: `Auth action in main: "${match.node.label}"`,
          weight: 0.5,
        });
      }
      break;
    }
  }

  // Check for price elements (indicates product page)
  const texts = engine.find({ kind: 'text', limit: 100 });
  for (const match of texts.matches) {
    const label = match.node.label;
    if (PRICE_PATTERNS.some((p) => p.test(label))) {
      signals.push({
        source: 'element',
        signal: 'price-element',
        evidence: `Price found: "${label.substring(0, 30)}"`,
        weight: 0.5,
      });
      break; // Only count once
    }
  }

  // Check for long paragraphs (indicates article)
  const paragraphs = engine.find({ kind: 'paragraph', limit: 20 });
  const longParagraphs = paragraphs.matches.filter((m) => m.node.label.length > 200);
  if (longParagraphs.length >= 3) {
    signals.push({
      source: 'content',
      signal: 'long-paragraphs',
      evidence: `${longParagraphs.length} long paragraphs found`,
      weight: 0.6,
    });
  }

  // Check for error indicators
  const headings = engine.find({ kind: 'heading', limit: 10 });
  for (const match of headings.matches) {
    const label = normalizeText(match.node.label);
    if (/\b404\b/.test(label) || /\bnot found\b/i.test(label)) {
      signals.push({
        source: 'element',
        signal: 'error-heading-404',
        evidence: `Error heading: "${match.node.label}"`,
        weight: 0.95,
      });
      break;
    }
    if (/\b500\b/.test(label) || /\bserver error\b/i.test(label)) {
      signals.push({
        source: 'element',
        signal: 'error-heading-500',
        evidence: `Error heading: "${match.node.label}"`,
        weight: 0.95,
      });
      break;
    }
  }

  return signals;
}

/**
 * Calculate page summary info.
 */
function calculateSummaryInfo(
  snapshot: BaseSnapshot,
  engine: QueryEngine,
  formResult?: FormDetectionResult
): {
  has_forms: boolean;
  has_navigation: boolean;
  has_main_content: boolean;
  has_search: boolean;
} {
  // Has forms
  const has_forms = (formResult?.forms.length ?? 0) > 0;

  // Has navigation
  const navNodes = engine.find({ kind: 'navigation', limit: 1 });
  const navRegion = engine.find({ region: 'nav', limit: 1 });
  const has_navigation = navNodes.matches.length > 0 || navRegion.matches.length > 0;

  // Has main content
  const mainRegion = engine.find({ region: 'main', limit: 1 });
  const has_main_content = mainRegion.matches.length > 0;

  // Has search
  const searchForms =
    formResult?.forms.filter((f) => f.purpose === 'search').length ?? 0;
  const searchInputs = engine.find({ kind: 'input', limit: 50 }).matches.filter(
    (m) =>
      m.node.attributes?.input_type === 'search' ||
      m.node.attributes?.autocomplete === 'search' ||
      /search/i.test(m.node.label)
  );
  const has_search = searchForms > 0 || searchInputs.length > 0;

  return { has_forms, has_navigation, has_main_content, has_search };
}

/**
 * Calculate type scores from signals.
 */
function calculateTypeScores(signals: PageSignal[]): Map<PageType, number> {
  const scores = new Map<PageType, number>();

  // All possible types
  const allTypes: PageType[] = [
    'homepage',
    'product',
    'product-listing',
    'category',
    'search-results',
    'article',
    'login',
    'signup',
    'checkout',
    'cart',
    'account',
    'contact',
    'about',
    'documentation',
    'error',
  ];

  // Initialize all to 0
  for (const type of allTypes) {
    scores.set(type, 0);
  }

  // Accumulate signal weights
  for (const signal of signals) {
    // Extract type from signal name if it follows pattern
    const match = /-(login|signup|checkout|cart|product|article|error|contact|about|documentation|search-results|homepage|product-listing|category|account)/.exec(signal.signal);
    if (match) {
      const type = match[1] as PageType;
      const current = scores.get(type) ?? 0;
      scores.set(type, current + signal.weight);
    }
  }

  return scores;
}

/**
 * Select primary and secondary types from scores.
 */
function selectTypes(scores: Map<PageType, number>): {
  primary: { type: PageType; score: number };
  secondary?: { type: PageType; score: number };
} {
  const sorted = [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return { primary: { type: 'unknown', score: 0.2 } };
  }

  const [primaryType, primaryScore] = sorted[0];

  // Normalize score to 0-1 range (cap at 1.0)
  const normalizedPrimary = Math.min(primaryScore, 1.0);

  // If score is too low, return unknown
  if (normalizedPrimary < 0.4) {
    return { primary: { type: 'unknown', score: normalizedPrimary } };
  }

  const result: ReturnType<typeof selectTypes> = {
    primary: { type: primaryType, score: normalizedPrimary },
  };

  // Add secondary if close to primary
  if (sorted.length > 1) {
    const [secondaryType, secondaryScore] = sorted[1];
    const normalizedSecondary = Math.min(secondaryScore, 1.0);

    // Only include if secondary is at least 60% of primary
    if (normalizedSecondary >= normalizedPrimary * 0.6) {
      result.secondary = { type: secondaryType, score: normalizedSecondary };
    }
  }

  return result;
}

/**
 * Extract entities from the page.
 */
function extractEntities(
  snapshot: BaseSnapshot,
  engine: QueryEngine,
  pageType: PageType
): PageEntity[] {
  const entities: PageEntity[] = [];

  // Extract based on page type
  if (pageType === 'product') {
    // Try to find product name from main heading
    const mainHeadings = engine.find({ kind: 'heading', region: 'main', limit: 3 });
    if (mainHeadings.matches.length > 0) {
      const heading = mainHeadings.matches[0].node;
      if (heading.attributes?.heading_level === 1 || heading.label.length > 5) {
        entities.push({
          type: 'product-name',
          value: heading.label,
          node_id: heading.node_id,
          confidence: 0.7,
        });
      }
    }

    // Try to find price
    const texts = engine.find({ kind: 'text', limit: 100 });
    for (const match of texts.matches) {
      for (const pattern of PRICE_PATTERNS) {
        const priceMatch = match.node.label.match(pattern);
        if (priceMatch) {
          entities.push({
            type: 'price',
            value: priceMatch[0],
            node_id: match.node.node_id,
            confidence: 0.8,
          });
          break;
        }
      }
      if (entities.some((e) => e.type === 'price')) break;
    }
  }

  if (pageType === 'article') {
    // Article title from main H1
    const h1s = engine
      .find({ kind: 'heading', limit: 10 })
      .matches.filter((m) => m.node.attributes?.heading_level === 1);

    if (h1s.length > 0) {
      entities.push({
        type: 'article-title',
        value: h1s[0].node.label,
        node_id: h1s[0].node.node_id,
        confidence: 0.8,
      });
    }
  }

  if (pageType === 'error') {
    // Error code
    const headings = engine.find({ kind: 'heading', limit: 5 });
    for (const match of headings.matches) {
      const codeMatch = /\b(404|500|403|401|503)\b/.exec(match.node.label);
      if (codeMatch) {
        entities.push({
          type: 'error-code',
          value: codeMatch[1],
          node_id: match.node.node_id,
          confidence: 0.95,
        });
        break;
      }
    }
  }

  if (pageType === 'search-results') {
    // Try to extract search query from URL or title
    try {
      const url = new URL(snapshot.url);
      const query =
        url.searchParams.get('q') ??
        url.searchParams.get('query') ??
        url.searchParams.get('search');
      if (query) {
        entities.push({
          type: 'search-query',
          value: query,
          confidence: 0.9,
        });
      }
    } catch {
      // Invalid URL
    }
  }

  return entities;
}

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * Classify a page based on URL, title, and content analysis.
 *
 * @param snapshot - The snapshot to analyze
 * @param formResult - Optional form detection result for context
 * @returns Classification result with type, confidence, signals, and entities
 */
export function classifyPage(
  snapshot: BaseSnapshot,
  formResult?: FormDetectionResult
): PageClassificationResult {
  const startTime = performance.now();
  const engine = new QueryEngine(snapshot);

  // Step 1: Collect signals from all sources
  const signals: PageSignal[] = [
    ...analyzeUrl(snapshot.url),
    ...analyzeTitle(snapshot.title),
    ...analyzeContent(snapshot, engine, formResult),
  ];

  // Step 2: Calculate type scores
  const scores = calculateTypeScores(signals);

  // Step 3: Select primary/secondary types
  const { primary, secondary } = selectTypes(scores);

  // Step 4: Calculate summary info (always useful even for unknown)
  const summaryInfo = calculateSummaryInfo(snapshot, engine, formResult);

  // Step 5: Extract entities
  const entities = extractEntities(snapshot, engine, primary.type);

  const classificationTimeMs = performance.now() - startTime;

  const classification: PageClassification = {
    type: primary.type,
    confidence: primary.score,
    secondary_type: secondary?.type,
    secondary_confidence: secondary?.score,
    signals,
    entities,
    ...summaryInfo,
  };

  return {
    classification,
    meta: {
      signals_evaluated: signals.length,
      classification_time_ms: classificationTimeMs,
    },
  };
}
