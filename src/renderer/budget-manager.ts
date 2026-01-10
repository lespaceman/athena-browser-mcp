/**
 * Budget Manager
 *
 * Manages token budget and applies truncation when needed.
 */

import { TOKEN_BUDGETS } from './constants.js';
import { estimateTokens } from './token-counter.js';
import type { TokenBudget, RenderedSection } from './types.js';

/**
 * Result of budget application.
 */
export interface BudgetResult {
  /** Final content after budget application */
  content: string;

  /** Estimated token count */
  tokens: number;

  /** Was truncation applied? */
  was_truncated: boolean;

  /** Original token count before truncation */
  original_tokens: number;

  /** Which sections were truncated */
  truncated_sections: string[];
}

/**
 * Apply token budget to rendered sections.
 *
 * Strategy:
 * 1. If under target, return as-is
 * 2. If over target but under cap, progressively truncate by priority
 * 3. If still over cap, hard truncate with marker
 *
 * @param sections - Rendered sections sorted by document order
 * @param budget - Token budget tier
 * @returns Budget result with final content
 */
export function applyBudget(
  sections: RenderedSection[],
  budget: TokenBudget
): BudgetResult {
  const limits = TOKEN_BUDGETS[budget];

  // Join sections with newlines
  let content = joinSections(sections);
  const originalTokens = estimateTokens(content);

  // Under target? Return as-is
  if (originalTokens <= limits.target) {
    return {
      content: wrapInPageContext(content),
      tokens: estimateTokens(wrapInPageContext(content)),
      was_truncated: false,
      original_tokens: originalTokens,
      truncated_sections: [],
    };
  }

  // Over target - need to truncate
  const truncatedSections: string[] = [];

  // Sort sections by truncation priority (lower = truncate first)
  const sortedSections = [...sections].sort(
    (a, b) => a.truncation_priority - b.truncation_priority
  );

  // Progressive truncation
  const workingSections = [...sections];

  for (const section of sortedSections) {
    // Check if we're under cap now
    content = joinSections(workingSections);
    const currentTokens = estimateTokens(content);

    if (currentTokens <= limits.cap) {
      break;
    }

    // Try to truncate this section
    if (section.can_truncate) {
      const sectionIndex = workingSections.findIndex(
        (s) => s.name === section.name
      );
      if (sectionIndex !== -1) {
        const truncatedSection = {
          ...workingSections[sectionIndex],
          content:
            workingSections[sectionIndex].truncated_content ??
            workingSections[sectionIndex].content,
        };

        // If truncated_content is empty, remove the section entirely
        if (truncatedSection.content === '') {
          workingSections.splice(sectionIndex, 1);
        } else {
          workingSections[sectionIndex] = truncatedSection;
        }

        truncatedSections.push(section.name);
      }
    }
  }

  // Final content
  content = joinSections(workingSections);
  let tokens = estimateTokens(content);

  // If still over cap, hard truncate
  if (tokens > limits.cap) {
    content = hardTruncate(content, limits.cap);
    tokens = estimateTokens(content);
    if (!truncatedSections.includes('hard-truncate')) {
      truncatedSections.push('hard-truncate');
    }
  }

  return {
    content: wrapInPageContext(content),
    tokens: estimateTokens(wrapInPageContext(content)),
    was_truncated: true,
    original_tokens: originalTokens,
    truncated_sections: truncatedSections,
  };
}

/**
 * Join sections with double newlines.
 */
function joinSections(sections: RenderedSection[]): string {
  return sections.map((s) => s.content).join('\n\n');
}

/**
 * Wrap content in <page_context> root element.
 */
function wrapInPageContext(content: string): string {
  return `<page_context>\n${content}\n</page_context>`;
}

/**
 * Hard truncate content to fit within token limit.
 * Adds a truncation marker.
 */
function hardTruncate(content: string, maxTokens: number): string {
  const marker = '\n[...truncated]';
  const markerTokens = estimateTokens(marker);
  const targetContentTokens = maxTokens - markerTokens - 10; // Buffer for wrapper

  // Estimate characters for target tokens
  const targetChars = targetContentTokens * 4;

  if (content.length <= targetChars) {
    return content;
  }

  // Find a good break point (end of line)
  let breakPoint = content.lastIndexOf('\n', targetChars);
  if (breakPoint === -1 || breakPoint < targetChars * 0.7) {
    // No good line break, just truncate
    breakPoint = targetChars;
  }

  return content.slice(0, breakPoint) + marker;
}

/**
 * Check if content is within budget.
 */
export function isWithinBudget(content: string, budget: TokenBudget): boolean {
  const limits = TOKEN_BUDGETS[budget];
  return estimateTokens(content) <= limits.cap;
}

/**
 * Get budget limits for a tier.
 */
export function getBudgetLimits(
  budget: TokenBudget
): { target: number; cap: number } {
  return TOKEN_BUDGETS[budget];
}
