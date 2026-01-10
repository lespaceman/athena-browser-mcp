/**
 * Section Renderers
 *
 * Individual renderers for each FactPack section.
 * Each renderer produces XML-compact output.
 */

import type {
  PageClassificationResult,
  DialogDetectionResult,
  FormDetectionResult,
  ActionSelectionResult,
  DetectedDialog,
  DetectedForm,
  FormField,
  SelectedAction,
  FactPack,
} from '../factpack/types.js';
import type { RenderOptions, RenderedSection } from './types.js';
import { DEFAULT_MAX_ACTIONS, MIN_ACTIONS_ON_TRUNCATE } from './constants.js';

/**
 * Truncation priority constants (lower = cut first).
 */
export const TRUNCATION_PRIORITY = {
  STATE: 1, // Cut first
  ACTIONS_EXTRA: 2, // Cut extra actions (keep top 5)
  FORM_DETAILS: 3, // Cut form field details
  DIALOG_SECONDARY: 4, // Cut secondary dialog actions
  FORMS: 5, // Full forms section
  DIALOGS: 6, // Full dialogs section (if not blocking)
  ACTIONS_CORE: 7, // Core actions (top 5)
  PAGE: 8, // Never cut
} as const;

/**
 * Render the <page> section.
 */
export function renderPageSection(
  pageResult: PageClassificationResult
): RenderedSection {
  const { type, confidence, secondary_type } = pageResult.classification;

  // Find page title from entities
  const titleEntity = pageResult.classification.entities.find(
    (e) =>
      e.type === 'product-name' ||
      e.type === 'article-title' ||
      e.type === 'category-name'
  );
  const title = titleEntity?.value ?? '';

  // Build attributes
  const attrs = [`type="${type}"`, `confidence="${confidence.toFixed(2)}"`];
  if (secondary_type) {
    attrs.push(`secondary="${secondary_type}"`);
  }

  const content = `<page ${attrs.join(' ')}>\n${title}\n</page>`;

  return {
    name: 'page',
    content,
    truncation_priority: TRUNCATION_PRIORITY.PAGE,
    can_truncate: false,
  };
}

/**
 * Render the <dialogs> section.
 */
export function renderDialogsSection(
  dialogResult: DialogDetectionResult
): RenderedSection {
  const { dialogs, has_blocking_dialog } = dialogResult;

  if (dialogs.length === 0) {
    return {
      name: 'dialogs',
      content: `<dialogs blocking="false">\nNone\n</dialogs>`,
      truncation_priority: TRUNCATION_PRIORITY.DIALOGS,
      can_truncate: false, // Empty section, nothing to truncate
    };
  }

  const lines: string[] = [];
  for (let i = 0; i < dialogs.length; i++) {
    const dialog = dialogs[i];
    lines.push(renderDialogItem(dialog, i + 1));
  }

  const content = `<dialogs blocking="${has_blocking_dialog}">\n${lines.join('\n')}\n</dialogs>`;

  // Build truncated version (just dialog types, no actions)
  const truncatedLines = dialogs.map(
    (d, i) => `${i + 1}. [${d.type}] "${d.title ?? 'Untitled'}" node:${d.node_id}`
  );
  const truncatedContent = `<dialogs blocking="${has_blocking_dialog}">\n${truncatedLines.join('\n')}\n</dialogs>`;

  return {
    name: 'dialogs',
    content,
    truncation_priority: has_blocking_dialog
      ? TRUNCATION_PRIORITY.PAGE // Never cut blocking dialogs
      : TRUNCATION_PRIORITY.DIALOGS,
    can_truncate: dialogs.some((d) => d.actions.length > 0),
    truncated_content: truncatedContent,
  };
}

/**
 * Render a single dialog item with its actions.
 */
function renderDialogItem(dialog: DetectedDialog, index: number): string {
  const lines: string[] = [];

  // Dialog header
  lines.push(
    `${index}. [${dialog.type}] "${dialog.title ?? 'Untitled'}" node:${dialog.node_id}`
  );

  // Dialog actions
  for (const action of dialog.actions) {
    lines.push(`   - ${action.label} [${action.role}] node:${action.node_id}`);
  }

  return lines.join('\n');
}

/**
 * Render the <forms> section.
 */
export function renderFormsSection(
  formResult: FormDetectionResult,
  _options: RenderOptions
): RenderedSection {
  const { forms, primary_form } = formResult;

  if (forms.length === 0) {
    return {
      name: 'forms',
      content: `<forms count="0">\nNone\n</forms>`,
      truncation_priority: TRUNCATION_PRIORITY.FORMS,
      can_truncate: false,
    };
  }

  // Build attributes
  const primaryPurpose = primary_form?.purpose ?? forms[0]?.purpose;
  const attrs = [`count="${forms.length}"`];
  if (primaryPurpose && primaryPurpose !== 'generic') {
    attrs.push(`primary="${primaryPurpose}"`);
  }

  const lines: string[] = [];
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    lines.push(renderFormItem(form, i + 1, false));
  }

  const content = `<forms ${attrs.join(' ')}>\n${lines.join('\n')}\n</forms>`;

  // Build truncated version (forms without field details)
  const truncatedLines: string[] = [];
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    truncatedLines.push(renderFormItem(form, i + 1, true));
  }
  const truncatedContent = `<forms ${attrs.join(' ')}>\n${truncatedLines.join('\n')}\n</forms>`;

  return {
    name: 'forms',
    content,
    truncation_priority: TRUNCATION_PRIORITY.FORMS,
    can_truncate: forms.some((f) => f.fields.length > 0),
    truncated_content: truncatedContent,
  };
}

/**
 * Render a single form item with its fields.
 */
function renderFormItem(
  form: DetectedForm,
  index: number,
  compact: boolean
): string {
  const lines: string[] = [];

  // Form header
  const confidenceStr =
    form.purpose_confidence >= 0.5
      ? `, ${form.purpose_confidence.toFixed(1)}`
      : '';
  lines.push(
    `${index}. ${form.title ?? 'Form'} [${form.purpose}${confidenceStr}] node:${form.node_id}`
  );

  if (compact) {
    // Just show field count
    const fieldCount = form.fields.length;
    const requiredCount = form.fields.filter((f) => f.required).length;
    lines.push(`   - ${fieldCount} fields (${requiredCount} required)`);
  } else {
    // Show all fields
    for (const field of form.fields) {
      lines.push(renderFormField(field));
    }
  }

  // Submit button
  if (form.submit_button) {
    const submitLabel = form.submit_button.label || 'Submit';
    lines.push(`   - [Submit: ${submitLabel}] node:${form.submit_button.node_id}`);
  }

  return lines.join('\n');
}

/**
 * Render a single form field.
 */
function renderFormField(field: FormField): string {
  const parts: string[] = [];

  // Field name/label
  parts.push(field.label ?? field.semantic_type ?? 'field');

  // State indicators
  const stateIndicators: string[] = [];
  if (field.required) stateIndicators.push('required');
  if (field.invalid) stateIndicators.push('invalid');
  if (field.disabled) stateIndicators.push('disabled');
  if (field.readonly) stateIndicators.push('readonly');

  const state =
    stateIndicators.length > 0 ? ` (${stateIndicators.join(', ')})` : '';

  return `   - ${parts.join('')}${state} node:${field.node_id}`;
}

/**
 * Render the <actions> section.
 */
export function renderActionsSection(
  actionResult: ActionSelectionResult,
  options: RenderOptions
): RenderedSection {
  const { actions, primary_cta } = actionResult;
  const maxActions = options.max_actions ?? DEFAULT_MAX_ACTIONS;

  if (actions.length === 0) {
    return {
      name: 'actions',
      content: `<actions>\nNone\n</actions>`,
      truncation_priority: TRUNCATION_PRIORITY.ACTIONS_CORE,
      can_truncate: false,
    };
  }

  // Limit to max actions
  const displayActions = actions.slice(0, maxActions);

  // Build attributes
  const attrs: string[] = [];
  if (primary_cta) {
    attrs.push(`primary="${escapeXmlAttr(primary_cta.label)}"`);
  }
  const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';

  const lines = displayActions.map((action, i) => renderActionItem(action, i + 1));
  const content = `<actions${attrStr}>\n${lines.join('\n')}\n</actions>`;

  // Build truncated version (top 5 only)
  const truncatedActions = actions.slice(0, MIN_ACTIONS_ON_TRUNCATE);
  const truncatedLines = truncatedActions.map((action, i) =>
    renderActionItem(action, i + 1)
  );
  const truncatedContent = `<actions${attrStr}>\n${truncatedLines.join('\n')}\n</actions>`;

  return {
    name: 'actions',
    content,
    truncation_priority: TRUNCATION_PRIORITY.ACTIONS_CORE,
    can_truncate: actions.length > MIN_ACTIONS_ON_TRUNCATE,
    truncated_content: truncatedContent,
  };
}

/**
 * Render a single action item.
 */
function renderActionItem(action: SelectedAction, index: number): string {
  return `${index}. ${action.label} [${action.category}] node:${action.node_id}`;
}

/**
 * Render the <state> section.
 */
export function renderStateSection(
  factpack: FactPack,
  options: RenderOptions
): RenderedSection {
  const { classification } = factpack.page_type;
  const lines: string[] = [];

  // URL would need to be passed in; for now skip or use placeholder
  if (options.include_url !== false) {
    // Note: URL is not in FactPack - would need to be passed from snapshot
    // For now we omit it or the caller can add it
  }

  // Page capabilities from classification
  lines.push(`- Has search: ${classification.has_search}`);
  lines.push(`- Has navigation: ${classification.has_navigation}`);
  lines.push(`- Has main content: ${classification.has_main_content}`);
  lines.push(`- Has forms: ${classification.has_forms}`);

  const content = `<state>\n${lines.join('\n')}\n</state>`;

  return {
    name: 'state',
    content,
    truncation_priority: TRUNCATION_PRIORITY.STATE,
    can_truncate: true, // Can be completely removed
    truncated_content: '', // Remove entirely when truncated
  };
}

/**
 * Escape special characters for XML attribute values.
 */
function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
