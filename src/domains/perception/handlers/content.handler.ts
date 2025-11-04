/**
 * Content Handler
 *
 * Handles content_extract_main and content_to_text tools
 */

import type {
  ContentExtractMainParams,
  ContentExtractMainResponse,
  ContentToTextParams,
  ContentToTextResponse,
} from '../perception.types.js';

interface CdpBridge {
  executeDevToolsMethod<T>(method: string, params?: unknown): Promise<T>;
}

export class ContentHandler {
  constructor(private readonly cdpBridge: CdpBridge) {}

  /**
   * Extract content from the page
   */
  async extract(params: {
    selector?: string;
    format?: 'text' | 'html' | 'markdown';
  }): Promise<{ content: string }> {
    const selector = params.selector ?? 'body';
    const format = params.format ?? 'text';

    // Get the element by selector
    const result = await this.cdpBridge.executeDevToolsMethod<{
      nodeId?: number;
    }>('DOM.querySelector', {
      nodeId: await this.getDocumentNodeId(),
      selector,
    });

    if (!result.nodeId) {
      return { content: '' };
    }

    // Get the outer HTML
    const html = await this.cdpBridge.executeDevToolsMethod<{ outerHTML?: string }>(
      'DOM.getOuterHTML',
      {
        nodeId: result.nodeId,
      },
    );

    const sourceHtml = html.outerHTML ?? '';

    // Format the content
    let content = '';
    if (format === 'text') {
      content = this.htmlToText(sourceHtml, 'html-text');
    } else if (format === 'html') {
      content = sourceHtml;
    } else if (format === 'markdown') {
      // PLACEHOLDER: Would convert HTML to markdown
      content = this.htmlToText(sourceHtml, 'html-text');
    }

    return { content };
  }

  /**
   * Extract main content from the page using Readability-like algorithm
   */
  async extractMain(params: ContentExtractMainParams): Promise<ContentExtractMainResponse> {
    // Get page HTML
    const html = await this.cdpBridge.executeDevToolsMethod<{ outerHTML?: string }>(
      'DOM.getOuterHTML',
      {
        nodeId: 1, // document node
      },
    );

    const sourceHtml = html.outerHTML ?? '';

    // Run through content extraction algorithm
    const mode = params.mode ?? 'readability';
    const result = await this.extractMainContent(sourceHtml, mode);

    return result;
  }

  /**
   * Convert HTML to plain text
   */
  async toText(params: ContentToTextParams): Promise<ContentToTextResponse> {
    const mode = params.mode ?? 'html-text';
    const text = this.htmlToText(params.html, mode);

    return { text };
  }

  /**
   * Extract main content using Readability or similar algorithm
   *
   * PLACEHOLDER: In production, integrate @mozilla/readability or trafilatura
   */
  private async extractMainContent(
    html: string,
    mode: 'readability' | 'trafilatura',
  ): Promise<ContentExtractMainResponse> {
    // This is a placeholder implementation
    // In production, you would:
    // 1. Use @mozilla/readability for JavaScript implementation
    // 2. Use trafilatura Python library via subprocess
    // 3. Implement custom content extraction algorithm

    // For now, use a simple heuristic
    const result = this.simpleContentExtraction(html);

    return result;
  }

  /**
   * Simple content extraction heuristic (placeholder)
   */
  private simpleContentExtraction(html: string): ContentExtractMainResponse {
    // Extract title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '';

    // Extract meta description as excerpt
    const descMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i,
    );
    const excerpt = descMatch ? descMatch[1] : '';

    // Extract main content (very simplified - just get <main>, <article>, or <body>)
    let content = '';
    let textContent = '';

    const mainMatch =
      html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
      html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    if (mainMatch) {
      content = mainMatch[1];
      textContent = this.htmlToText(content, 'html-text');
    }

    return {
      title,
      excerpt,
      content,
      textContent,
    };
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string, mode: 'inscriptis' | 'html-text'): string {
    if (mode === 'inscriptis') {
      // PLACEHOLDER: Would use inscriptis library
      return this.stripHtmlTags(html);
    }

    // Simple HTML stripping
    return this.stripHtmlTags(html);
  }

  /**
   * Strip HTML tags and decode entities
   */
  private stripHtmlTags(html: string): string {
    return (
      html
        // Remove script and style tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        // Remove HTML tags
        .replace(/<[^>]+>/g, ' ')
        // Decode common HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * Get the document nodeId
   */
  private async getDocumentNodeId(): Promise<number> {
    const result = await this.cdpBridge.executeDevToolsMethod<{
      root: { nodeId: number };
    }>('DOM.getDocument', { depth: 0 });
    return result.root.nodeId;
  }
}
