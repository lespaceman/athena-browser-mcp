// tests/unit/diagnostics/page-health.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPageHealth, PageHealthReport } from '../../../src/diagnostics/page-health.js';
import type { Page } from 'puppeteer-core';
import { createMockPage, MockPage } from '../../mocks/puppeteer.mock.js';

describe('checkPageHealth', () => {
  let mockPage: MockPage;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage({
      url: 'https://example.com',
      title: 'Example',
    });
  });

  it('should return healthy status for a normal page', async () => {
    // Mock content() to return HTML
    mockPage.content.mockResolvedValue('<html><body>Hello</body></html>');

    const report = await checkPageHealth(mockPage as unknown as Page);

    expect(report.isHealthy).toBe(true);
    expect(report.url).toBe('https://example.com');
    expect(report.title).toBe('Example');
    expect(report.contentLength).toBeGreaterThan(0);
  });

  it('should detect empty title as warning', async () => {
    mockPage = createMockPage({
      url: 'https://example.com',
      title: '',
    });
    mockPage.content.mockResolvedValue('<html><body></body></html>');

    const report = await checkPageHealth(mockPage as unknown as Page);

    expect(report.warnings).toContain('empty_title');
  });

  it('should detect empty content', async () => {
    mockPage.content.mockResolvedValue('');

    const report = await checkPageHealth(mockPage as unknown as Page);

    expect(report.isHealthy).toBe(false);
    expect(report.errors).toContain('empty_content');
  });

  it('should detect closed page', async () => {
    mockPage.isClosed.mockReturnValue(true);

    const report = await checkPageHealth(mockPage as unknown as Page);

    expect(report.isHealthy).toBe(false);
    expect(report.errors).toContain('page_closed');
  });

  it('should handle content() throwing error', async () => {
    mockPage.content.mockRejectedValue(new Error('Execution context was destroyed'));

    const report = await checkPageHealth(mockPage as unknown as Page);

    expect(report.isHealthy).toBe(false);
    expect(report.errors).toContain('content_error');
    expect(report.contentError).toContain('Execution context was destroyed');
  });

  it('should include main frame info', async () => {
    mockPage.content.mockResolvedValue('<html></html>');
    // The mainFrame is already set up by createMockPage with the page URL

    const report = await checkPageHealth(mockPage as unknown as Page);

    expect(report.mainFrameUrl).toBe('https://example.com');
  });

  it('should handle page.title() throwing error gracefully', async () => {
    vi.mocked(mockPage.title).mockRejectedValue(new Error('Page crashed'));
    mockPage.content.mockResolvedValue('<html></html>');

    const report = await checkPageHealth(mockPage as unknown as Page);

    // Should still return a report, just with empty title
    expect(report.url).toBe('https://example.com');
    expect(report.title).toBe('');
    expect(report.warnings).toContain('empty_title');
  });

  it('should handle mainFrame() throwing error gracefully', async () => {
    mockPage.content.mockResolvedValue('<html></html>');
    vi.mocked(mockPage.mainFrame).mockImplementation(() => {
      throw new Error('Frame detached');
    });

    const report = await checkPageHealth(mockPage as unknown as Page);

    // Should still return a report, just without mainFrameUrl
    expect(report.mainFrameUrl).toBeUndefined();
    expect(report.isHealthy).toBe(true);
  });
});

describe('formatHealthReport', () => {
  it('should format healthy report', async () => {
    const { formatHealthReport } = await import('../../../src/diagnostics/page-health.js');

    const report: PageHealthReport = {
      isHealthy: true,
      url: 'https://example.com',
      title: 'Example Page',
      contentLength: 1234,
      mainFrameUrl: 'https://example.com',
      isClosed: false,
      warnings: [],
      errors: [],
      timestamp: Date.now(),
    };

    const formatted = formatHealthReport(report);

    expect(formatted).toContain('HEALTHY');
    expect(formatted).toContain('https://example.com');
    expect(formatted).toContain('Example Page');
    expect(formatted).toContain('1234');
  });

  it('should format unhealthy report with errors', async () => {
    const { formatHealthReport } = await import('../../../src/diagnostics/page-health.js');

    const report: PageHealthReport = {
      isHealthy: false,
      url: 'https://example.com',
      title: '',
      contentLength: 0,
      contentError: 'Execution context destroyed',
      isClosed: false,
      warnings: ['empty_title'],
      errors: ['empty_content', 'content_error'],
      timestamp: Date.now(),
    };

    const formatted = formatHealthReport(report);

    expect(formatted).toContain('UNHEALTHY');
    expect(formatted).toContain('(empty)');
    expect(formatted).toContain('empty_title');
    expect(formatted).toContain('empty_content');
    expect(formatted).toContain('content_error');
    expect(formatted).toContain('Execution context destroyed');
  });
});
