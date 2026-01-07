/**
 * Semantic Region Resolver
 *
 * Maps string region names to CSS selectors and keywords
 * for scoping element discovery to specific page areas.
 */

export interface NamedRegion {
  summary: string;
  cssSelector: string;
  keywords: string[];
}

/**
 * Mapping of region aliases to their properties
 */
const NAMED_REGIONS: Record<string, NamedRegion> = {};

function registerRegion(aliases: string[], region: NamedRegion): void {
  for (const alias of aliases) {
    NAMED_REGIONS[alias] = region;
  }
}

// Header/Navigation
registerRegion(['header', 'top', 'topnav', 'navigation', 'nav'], {
  summary: 'header',
  cssSelector: 'header',
  keywords: ['header', 'banner', 'nav', 'globalnav'],
});

// Footer
registerRegion(['footer', 'bottom'], {
  summary: 'footer',
  cssSelector: 'footer',
  keywords: ['footer', 'contentinfo'],
});

// Main content
registerRegion(['main', 'content'], {
  summary: 'main content',
  cssSelector: 'main',
  keywords: ['main', 'content'],
});

// Sidebar
registerRegion(['sidebar', 'aside'], {
  summary: 'sidebar',
  cssSelector: 'aside',
  keywords: ['sidebar', 'aside', 'complementary'],
});

// Hero section
registerRegion(['hero'], {
  summary: 'hero region',
  cssSelector: '[data-hero]',
  keywords: ['hero'],
});

// Dialog/Modal
registerRegion(['dialog', 'modal'], {
  summary: 'dialog',
  cssSelector: '[role="dialog"], dialog',
  keywords: ['dialog', 'modal'],
});

export interface RegionResolution {
  cssSelector?: string;
  summary: string;
  keywords?: string[];
}

/**
 * Resolve a region string to its CSS selector and metadata
 */
export function resolveRegion(region?: string): RegionResolution {
  if (!region) {
    return { summary: 'main frame' };
  }

  const normalized = region.trim().toLowerCase();
  if (!normalized) {
    return { summary: 'main frame' };
  }

  const named = NAMED_REGIONS[normalized];
  if (named) {
    return {
      cssSelector: named.cssSelector,
      summary: named.summary,
      keywords: [...named.keywords],
    };
  }

  // Unknown region - treat as nearText search hint
  return {
    summary: region,
    keywords: normalized.split(/\s+/).filter(Boolean),
  };
}

/**
 * Get all registered region names
 */
export function getRegisteredRegions(): string[] {
  return Object.keys(NAMED_REGIONS);
}

/**
 * Structured region selectors for content extraction
 */
export const STRUCTURED_REGION_SELECTORS: Record<string, string> = {
  header: 'header',
  main: 'main',
  footer: 'footer',
  sidebar: 'aside,[role="complementary"]',
  article: 'article',
};
