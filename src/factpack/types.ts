/**
 * FactPack Types
 *
 * Shared type definitions for FactPack extractors.
 *
 * Design Philosophy: Generic First, Specific Second
 * - Base detection (always populated) - generic facts that work on any page
 * - Classification (optional) - specific categorization with confidence scores
 * - 'unknown'/'generic' are valid results, not failures
 */

import type { NodeKind, SemanticRegion, BBox } from '../snapshot/snapshot.types.js';

// ============================================================================
// Dialog Types - Generic Detection + Optional Classification
// ============================================================================

/**
 * Dialog type classification.
 * May be 'unknown' if dialog is detected but type cannot be determined.
 */
export type DialogType =
  | 'modal' // Generic modal dialog
  | 'alert' // Alert/warning (role="alertdialog")
  | 'confirm' // Confirmation dialog
  | 'cookie-consent' // Cookie consent (detected by patterns)
  | 'newsletter' // Newsletter popup
  | 'login-prompt' // Login/auth modal
  | 'age-gate' // Age verification
  | 'unknown'; // Detected as dialog, but type unclear

/** How the dialog was detected */
export type DialogDetectionMethod =
  | 'role-dialog' // AX role="dialog"
  | 'role-alertdialog' // AX role="alertdialog"
  | 'html-dialog' // <dialog> element
  | 'aria-modal' // aria-modal="true"
  | 'heuristic'; // Visual/positional heuristics

/** Action role within a dialog */
export type DialogActionRole = 'primary' | 'secondary' | 'dismiss' | 'unknown';

/**
 * An interactive action within a dialog.
 */
export interface DialogAction {
  node_id: string;
  backend_node_id: number;
  label: string;
  role: DialogActionRole;
  kind: NodeKind;
}

/**
 * A detected dialog element.
 * Base detection fields are always populated.
 * Classification fields may indicate 'unknown'.
 */
export interface DetectedDialog {
  // --- Always populated (generic detection) ---

  /** Container node ID */
  node_id: string;

  /** Backend node ID for CDP interaction */
  backend_node_id: number;

  /** Bounding box */
  bbox: BBox;

  /** Is this a modal (blocks interaction with rest of page)? */
  is_modal: boolean;

  /** Title/heading if found */
  title?: string;

  /** Interactive elements within dialog */
  actions: DialogAction[];

  /** How was this detected? */
  detection_method: DialogDetectionMethod;

  // --- Optional classification ---

  /** Classified type (may be 'unknown') */
  type: DialogType;

  /** Classification confidence (0-1). Low for 'unknown'. */
  type_confidence: number;

  /** Signals that contributed to classification */
  classification_signals: string[];
}

/**
 * Result of dialog detection.
 */
export interface DialogDetectionResult {
  /** All detected dialogs (always includes generically detected ones) */
  dialogs: DetectedDialog[];

  /** Is any blocking dialog present? */
  has_blocking_dialog: boolean;

  /** Stats */
  meta: {
    total_detected: number;
    /** How many have type !== 'unknown' */
    classified_count: number;
    detection_time_ms: number;
  };
}

// ============================================================================
// Form Types - Generic Detection + Optional Purpose Inference
// ============================================================================

/**
 * Form purpose (inferred).
 * May be 'generic' if form is detected but purpose cannot be determined.
 */
export type FormPurpose =
  | 'login' // Login/sign-in
  | 'signup' // Registration
  | 'checkout' // Payment
  | 'contact' // Contact form
  | 'search' // Search form
  | 'newsletter' // Newsletter subscription
  | 'shipping' // Shipping address
  | 'billing' // Billing address
  | 'profile' // Profile/account
  | 'password-reset' // Password reset
  | 'generic'; // Form detected, purpose unclear

/**
 * Field semantic type (inferred).
 * May be 'unknown' if field purpose cannot be determined.
 */
export type FieldSemanticType =
  | 'username'
  | 'email'
  | 'password'
  | 'password-confirm'
  | 'phone'
  | 'first-name'
  | 'last-name'
  | 'full-name'
  | 'address-line1'
  | 'address-line2'
  | 'city'
  | 'state'
  | 'postal-code'
  | 'country'
  | 'card-number'
  | 'card-expiry'
  | 'card-cvv'
  | 'search-query'
  | 'message'
  | 'date'
  | 'number'
  | 'url'
  | 'unknown';

/**
 * A form field with extracted information.
 */
export interface FormField {
  // --- Always populated ---
  node_id: string;
  backend_node_id: number;
  kind: NodeKind;
  label: string;
  /** From attributes.input_type or 'text' */
  input_type: string;

  // --- State ---
  required: boolean;
  invalid: boolean;
  disabled: boolean;
  readonly: boolean;
  /** Whether field has a value (not the value itself for privacy) */
  has_value: boolean;

  // --- Optional enrichment ---
  placeholder?: string;
  autocomplete?: string;

  /** Inferred semantic type (may be 'unknown') */
  semantic_type: FieldSemanticType;
  /** Confidence in semantic_type (0-1) */
  semantic_confidence: number;
}

/**
 * Submit button for a form.
 */
export interface FormSubmitButton {
  node_id: string;
  backend_node_id: number;
  label: string;
  enabled: boolean;
  visible: boolean;
}

/**
 * Form validation state.
 */
export interface FormValidation {
  has_errors: boolean;
  error_count: number;
  required_unfilled: number;
  /** Can form likely be submitted? (enabled submit + no errors) */
  ready_to_submit: boolean;
}

/**
 * A detected form with extracted fields.
 * Base detection fields are always populated.
 * Purpose inference may indicate 'generic'.
 */
export interface DetectedForm {
  // --- Always populated (generic detection) ---
  node_id: string;
  backend_node_id: number;

  /** Heading context or title */
  title?: string;

  /** Form method/action (if explicit form element) */
  action?: string;
  method?: string;

  /** Fields in document order */
  fields: FormField[];

  /** Submit button (may be undefined for implicit forms) */
  submit_button?: FormSubmitButton;

  /** Validation state */
  validation: FormValidation;

  // --- Optional classification ---

  /** Inferred purpose (may be 'generic') */
  purpose: FormPurpose;
  /** Confidence in purpose (0-1) */
  purpose_confidence: number;

  /** Signals that contributed to purpose inference */
  purpose_signals: string[];
}

/**
 * Result of form detection.
 */
export interface FormDetectionResult {
  /** All detected forms */
  forms: DetectedForm[];

  /** Primary form (largest/most prominent) */
  primary_form?: DetectedForm;

  /** Stats */
  meta: {
    total_detected: number;
    /** How many have purpose !== 'generic' */
    classified_count: number;
    detection_time_ms: number;
  };
}

// ============================================================================
// Page Classification Types - Always Returns Something Useful
// ============================================================================

/**
 * Page type classification.
 * May be 'unknown' if page type cannot be determined.
 */
export type PageType =
  | 'homepage' // Landing/home page
  | 'product' // Product detail page
  | 'product-listing' // Product listing
  | 'category' // Category browsing
  | 'search-results' // Search results
  | 'article' // Blog/news article
  | 'login' // Login page
  | 'signup' // Registration page
  | 'checkout' // Checkout flow
  | 'cart' // Shopping cart
  | 'account' // Account/profile
  | 'contact' // Contact page
  | 'about' // About page
  | 'documentation' // Documentation/help
  | 'error' // Error page (404, 500)
  | 'unknown'; // Could not determine

/** Source of a classification signal */
export type PageSignalSource = 'url' | 'title' | 'content' | 'form' | 'element';

/**
 * A signal that contributed to page classification.
 */
export interface PageSignal {
  source: PageSignalSource;
  /** Signal identifier (e.g., 'url-pattern-product', 'form-purpose-login') */
  signal: string;
  /** Human-readable evidence */
  evidence: string;
  /** Weight contribution (0-1) */
  weight: number;
}

/** Type of extracted page entity */
export type PageEntityType =
  | 'product-name'
  | 'price'
  | 'article-title'
  | 'error-code'
  | 'search-query'
  | 'category-name'
  | 'unknown';

/**
 * An extracted entity from the page.
 */
export interface PageEntity {
  type: PageEntityType;
  value: string;
  node_id?: string;
  confidence: number;
}

/**
 * Page classification result.
 * Summary fields (has_forms, has_navigation, etc.) are always useful
 * even when type is 'unknown'.
 */
export interface PageClassification {
  // --- Always populated ---

  /** Primary page type (may be 'unknown') */
  type: PageType;

  /** Confidence (0-1). Low confidence for 'unknown'. */
  confidence: number;

  /** Alternative type if ambiguous */
  secondary_type?: PageType;
  secondary_confidence?: number;

  /** Signals that contributed to classification */
  signals: PageSignal[];

  /** Extracted entities (may be empty) */
  entities: PageEntity[];

  // --- Summary info (always useful even for 'unknown') ---

  /** Does page have forms? */
  has_forms: boolean;

  /** Does page have navigation? */
  has_navigation: boolean;

  /** Primary content region detected? */
  has_main_content: boolean;

  /** Is there a search box? */
  has_search: boolean;
}

/**
 * Result of page classification.
 */
export interface PageClassificationResult {
  classification: PageClassification;
  meta: {
    signals_evaluated: number;
    classification_time_ms: number;
  };
}

// ============================================================================
// Action Selection Types - Generic Scoring
// ============================================================================

/**
 * Action category.
 * May be 'generic' if action cannot be categorized.
 */
export type ActionCategory =
  | 'primary-cta' // Primary call-to-action
  | 'secondary-cta' // Secondary action
  | 'navigation' // Navigation link
  | 'form-submit' // Form submission
  | 'search' // Search action
  | 'cart-action' // Add to cart, checkout
  | 'auth-action' // Login, logout, sign up
  | 'dialog-action' // Dialog confirm/dismiss
  | 'media-control' // Play, pause, etc.
  | 'generic'; // Interactive but uncategorized

/**
 * A signal that contributed to action scoring.
 */
export interface ActionSignal {
  type: string;
  weight: number;
}

/**
 * A selected key action.
 */
export interface SelectedAction {
  // --- Always populated ---
  node_id: string;
  backend_node_id: number;
  label: string;
  kind: NodeKind;
  region: SemanticRegion;

  /** Locator for interaction */
  locator: string;

  /** Is action enabled? */
  enabled: boolean;

  /** Relevance score (0-1) */
  score: number;

  /** Scoring signals */
  signals: ActionSignal[];

  // --- Optional classification ---

  /** Action category (may be 'generic') */
  category: ActionCategory;
  /** Confidence in category (0-1) */
  category_confidence: number;
}

/**
 * Result of action selection.
 */
export interface ActionSelectionResult {
  /** Top actions sorted by score */
  actions: SelectedAction[];

  /** Highest-scoring primary CTA (if identifiable) */
  primary_cta?: SelectedAction;

  /** Stats */
  meta: {
    candidates_evaluated: number;
    selection_time_ms: number;
  };
}

// ============================================================================
// Orchestration Types
// ============================================================================

/**
 * Complete FactPack extraction result.
 */
export interface FactPack {
  page_type: PageClassificationResult;
  dialogs: DialogDetectionResult;
  forms: FormDetectionResult;
  actions: ActionSelectionResult;
  meta: {
    snapshot_id: string;
    extraction_time_ms: number;
  };
}

/**
 * Options for FactPack extraction.
 */
export interface FactPackOptions {
  /** Max actions to select (default: 12) */
  max_actions?: number;

  /** Min action score threshold (default: 0.2) */
  min_action_score?: number;

  /** Include disabled form fields (default: true) */
  include_disabled_fields?: boolean;
}
