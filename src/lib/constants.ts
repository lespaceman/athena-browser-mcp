/**
 * Shared constants for interactive element discovery
 *
 * These constants define what elements are considered interactive
 * for browser automation purposes.
 */

/**
 * ARIA roles that indicate interactive elements
 */
export const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'checkbox',
  'switch',
  'tab',
  'slider',
  'spinbutton',
  'scrollbar',
]);

/**
 * HTML tags that are inherently interactive
 */
export const INTERACTIVE_TAGS = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'option',
  'details',
  'summary',
]);

/**
 * ARIA roles that indicate form input controls
 */
export const ARIA_INPUT_ROLES = new Set([
  'radio',
  'checkbox',
  'switch',
  'combobox',
  'option',
  'menuitemradio',
  'menuitemcheckbox',
  'tab',
]);

/**
 * Click handler attributes that indicate clickable elements
 */
export const CLICK_HANDLER_ATTRIBUTES = ['onclick', '@click', 'v-on:click', 'ng-click'];

/**
 * Generic HTML tags that shouldn't be used for selector hints
 */
export const GENERIC_TAGS = new Set(['html', 'body', 'main', 'article', 'section', 'div', 'span']);
