/**
 * XML Renderer
 *
 * Main orchestrator for rendering FactPack to XML-compact format.
 */

import type { FactPack } from '../factpack/types.js';
import type { RenderOptions, PageBriefResult, TokenBudget } from './types.js';
import { DEFAULT_BUDGET } from './constants.js';
import { applyBudget } from './budget-manager.js';
import {
  renderPageSection,
  renderDialogsSection,
  renderFormsSection,
  renderActionsSection,
  renderStateSection,
} from './section-renderers.js';

/**
 * Default render options.
 */
const DEFAULT_OPTIONS: RenderOptions = {
  format: 'xml-compact',
  budget: DEFAULT_BUDGET,
  include_state: true,
  include_url: true,
};

/**
 * Render a FactPack to XML-compact page brief format.
 *
 * @param factpack - The FactPack to render
 * @param options - Render options (budget, format, etc.)
 * @returns Page brief result with rendered content and token count
 */
export function renderFactPackXml(
  factpack: FactPack,
  options?: Partial<RenderOptions>
): PageBriefResult {
  const opts: RenderOptions = { ...DEFAULT_OPTIONS, ...options };

  // Render each section
  const sections = [
    renderPageSection(factpack.page_type),
    renderDialogsSection(factpack.dialogs),
    renderFormsSection(factpack.forms, opts),
    renderActionsSection(factpack.actions, opts),
  ];

  // Optionally add state section
  if (opts.include_state) {
    sections.push(renderStateSection(factpack, opts));
  }

  // Apply budget and get final content
  const budgetResult = applyBudget(sections, opts.budget);

  return {
    page_brief: budgetResult.content,
    page_brief_tokens: budgetResult.tokens,
    was_truncated: budgetResult.was_truncated,
    original_tokens: budgetResult.was_truncated
      ? budgetResult.original_tokens
      : undefined,
  };
}

/**
 * Quick render without budget management.
 * Use for testing or when you know the content is small.
 *
 * @param factpack - The FactPack to render
 * @param options - Render options
 * @returns Raw XML-compact string
 */
export function renderFactPackXmlRaw(
  factpack: FactPack,
  options?: Partial<RenderOptions>
): string {
  const opts: RenderOptions = { ...DEFAULT_OPTIONS, ...options };

  // Render each section
  const sections = [
    renderPageSection(factpack.page_type).content,
    renderDialogsSection(factpack.dialogs).content,
    renderFormsSection(factpack.forms, opts).content,
    renderActionsSection(factpack.actions, opts).content,
  ];

  // Optionally add state section
  if (opts.include_state) {
    sections.push(renderStateSection(factpack, opts).content);
  }

  return `<page_context>\n${sections.join('\n\n')}\n</page_context>`;
}

/**
 * Generate page brief with default options.
 * Convenience function for the most common use case.
 *
 * @param factpack - The FactPack to render
 * @param budget - Token budget tier (default: 'standard')
 * @returns Page brief result
 */
export function generatePageBrief(
  factpack: FactPack,
  budget: TokenBudget = DEFAULT_BUDGET
): PageBriefResult {
  return renderFactPackXml(factpack, { budget });
}

/**
 * Estimate tokens for a FactPack without full rendering.
 * Useful for deciding whether to use compact or detailed budget.
 *
 * @param factpack - The FactPack to estimate
 * @returns Rough token estimate
 */
export function estimateFactPackTokens(factpack: FactPack): number {
  // Quick estimation based on counts
  const dialogCount = factpack.dialogs.dialogs.length;
  const formCount = factpack.forms.forms.length;
  const fieldCount = factpack.forms.forms.reduce(
    (acc, f) => acc + f.fields.length,
    0
  );
  const actionCount = factpack.actions.actions.length;

  // Base tokens for structure
  let estimate = 100;

  // Add for content
  estimate += dialogCount * 30; // ~30 tokens per dialog
  estimate += formCount * 40; // ~40 tokens per form header
  estimate += fieldCount * 15; // ~15 tokens per field
  estimate += actionCount * 20; // ~20 tokens per action

  return estimate;
}
