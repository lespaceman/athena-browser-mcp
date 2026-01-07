/**
 * Selector Building Utilities
 *
 * Functions for building CSS and XPath selectors
 * from semantic element information.
 */

import { escapeAttributeValue, escapeXPathValue, tokenizeForMatching } from './text-utils.js';

/**
 * Build CSS selector for a given ARIA role
 * Maps roles to both native HTML elements and ARIA attributes
 */
export function buildRoleSelector(role?: string): string | undefined {
  if (!role) return undefined;

  const normalized = role.trim().toLowerCase();
  switch (normalized) {
    case 'link':
      return 'a,[role="link"]';
    case 'button':
      return 'button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"]';
    case 'textbox':
    case 'searchbox':
      return 'input[type="text"],input[type="search"],textarea,[role="textbox"]';
    case 'checkbox':
      return 'input[type="checkbox"],[role="checkbox"]';
    case 'radio':
      return 'input[type="radio"],[role="radio"]';
    case 'combobox':
      return 'select,[role="combobox"],input[list]';
    case 'listbox':
      return 'select[multiple],[role="listbox"]';
    case 'option':
      return 'option,[role="option"]';
    case 'tab':
      return '[role="tab"],.tab';
    case 'menuitem':
      return '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';
    case 'switch':
      return '[role="switch"]';
    case 'slider':
      return 'input[type="range"],[role="slider"]';
    default:
      return undefined;
  }
}

/**
 * Build CSS attribute selector for aria-label
 */
export function buildAriaLabelSelector(label: string): string {
  const escaped = escapeAttributeValue(label);
  return `[aria-label*="${escaped}"]`;
}

/**
 * Build CSS attribute selector for name attribute
 */
export function buildNameSelector(name: string): string {
  const escaped = escapeAttributeValue(name);
  return `[name*="${escaped}"]`;
}

/**
 * Build XPath selector for text content matching
 * Used when accessible name comes from text content (not HTML attribute)
 */
export function buildTextContentXPath(text: string, role?: string): string | undefined {
  const tokens = tokenizeForMatching(text);
  if (tokens.length === 0) return undefined;

  const parts: string[] = [];

  // Add role constraint if available
  if (role) {
    parts.push(`@role='${escapeXPathValue(role)}'`);
  }

  // Add text matching for each significant token
  const textMatches = tokens
    .map((token) => `contains(., '${escapeXPathValue(token)}')`)
    .join(' and ');
  parts.push(textMatches);

  return `//*[${parts.join(' and ')}]`;
}

/**
 * Build AX selector format: role=button[name*="..."]
 */
export function buildAxSelector(role?: string, name?: string, label?: string): string | undefined {
  const qualifierSource = name ?? label;
  const snippet = qualifierSource?.trim();

  if (!role && !snippet) {
    return undefined;
  }

  if (!snippet && role) {
    return `role=${role}`;
  }

  if (!snippet) {
    return undefined;
  }

  const qualifierKey = name ? 'name' : 'label';
  const qualifier = escapeAttributeValue(snippet, 160);
  const prefix = role ? `role=${role}` : '';
  return `${prefix}[${qualifierKey}*="${qualifier}"]`.trim();
}

/**
 * Combine role selector with attribute clause
 */
export function combineRoleAndAttribute(
  roleSelector?: string,
  attrClause?: string
): string | undefined {
  if (roleSelector && attrClause) {
    return roleSelector
      .split(',')
      .map((segment) => `${segment.trim()}${attrClause}`)
      .join(',');
  }
  if (roleSelector) {
    return roleSelector;
  }
  if (attrClause) {
    return `*${attrClause}`;
  }
  return undefined;
}

/**
 * Determine if element.name likely represents an HTML name attribute
 * vs an accessible name computed from text content
 *
 * HTML name attribute is only valid on specific elements:
 * - Form elements: input, button, select, textarea, fieldset
 * - Embedded content: iframe, object
 */
export function isLikelyHtmlNameAttribute(role?: string): boolean {
  if (!role) return true; // No role info, assume it could be HTML name attribute

  const normalized = role.toLowerCase();

  // Native HTML elements that have actual name attributes
  const NATIVE_HTML_ROLES = new Set([
    'textbox', // Could be <input> or <textarea> with name attribute
    'searchbox', // Could be <input type="search"> with name attribute
    'combobox', // Could be <select> with name attribute
  ]);

  return NATIVE_HTML_ROLES.has(normalized);
}
