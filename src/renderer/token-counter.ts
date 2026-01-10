/**
 * Token Counter
 *
 * Estimates token count for rendered content.
 * Uses a simple character-based heuristic since we don't have
 * access to the actual tokenizer in the runtime environment.
 */

import { CHARS_PER_TOKEN } from './constants.js';

/**
 * Estimate token count for a string.
 *
 * Uses a simple heuristic: tokens ≈ characters / 4
 * This is reasonably accurate for English text with XML tags.
 *
 * For more accurate counting in production, consider:
 * - tiktoken (OpenAI's tokenizer)
 * - claude-tokenizer (if available)
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Base estimate: characters / 4
  const baseEstimate = Math.ceil(text.length / CHARS_PER_TOKEN);

  // Adjust for XML tags (they tend to tokenize more efficiently)
  // XML tags like <page> become ~2 tokens, not 6 characters / 4 = 1.5
  const tagMatches = text.match(/<\/?[a-z_-]+(?:\s+[^>]*)?>/gi);
  const tagCount = tagMatches?.length ?? 0;

  // Each tag adds roughly 1 extra token beyond char estimate
  const tagAdjustment = Math.ceil(tagCount * 0.5);

  return baseEstimate + tagAdjustment;
}

/**
 * Calculate tokens needed to reach target.
 *
 * @param currentTokens - Current token count
 * @param targetTokens - Target token count
 * @returns Tokens over budget (negative if under budget)
 */
export function tokensOverBudget(currentTokens: number, targetTokens: number): number {
  return currentTokens - targetTokens;
}

/**
 * Check if content is within budget.
 *
 * @param text - Text to check
 * @param targetTokens - Target token count
 * @returns True if within budget
 */
export function isWithinBudget(text: string, targetTokens: number): boolean {
  return estimateTokens(text) <= targetTokens;
}

/**
 * Estimate tokens saved by removing a section.
 *
 * @param section - Section content to measure
 * @returns Estimated tokens that would be saved
 */
export function estimateTokenSavings(section: string): number {
  // Account for the newlines between sections too
  return estimateTokens(section) + 1;
}
