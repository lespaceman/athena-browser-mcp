/**
 * Renderer Module
 *
 * Exports for FactPack rendering to JSON and XML formats.
 */

// JSON serializer (primary format)
export { generatePageSummary, type PageSummary } from './json-serializer.js';

// XML renderer (legacy - kept for backward compatibility)
export {
  renderFactPackXml,
  renderFactPackXmlRaw,
  generatePageBrief,
  estimateFactPackTokens,
} from './xml-renderer.js';

// Budget management
export { applyBudget, isWithinBudget, getBudgetLimits } from './budget-manager.js';

// Token counting
export {
  estimateTokens,
  tokensOverBudget,
  isWithinBudget as isWithinTokenBudget,
  estimateTokenSavings,
} from './token-counter.js';

// Constants
export {
  TOKEN_BUDGETS,
  DEFAULT_BUDGET,
  MAX_TOKEN_CAP,
  DEFAULT_MAX_ACTIONS,
  MIN_ACTIONS_ON_TRUNCATE,
  CHARS_PER_TOKEN,
} from './constants.js';

// Types
export type {
  TokenBudget,
  OutputFormat,
  RenderOptions,
  PageBriefResult,
  RenderedSection,
  TruncationContext,
} from './types.js';

// Section renderers (for testing/customization)
export {
  renderPageSection,
  renderDialogsSection,
  renderFormsSection,
  renderActionsSection,
  renderStateSection,
  TRUNCATION_PRIORITY,
} from './section-renderers.js';
