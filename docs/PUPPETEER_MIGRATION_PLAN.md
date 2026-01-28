# Playwright to Puppeteer Migration Plan

This document outlines the detailed migration plan from Playwright to Puppeteer for the Athena Browser MCP project. Since the use case is **connecting to an existing Chrome app** (not launching browsers), this simplifies the migration significantly.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope Analysis](#2-scope-analysis)
3. [API Differences](#3-api-differences)
4. [Migration Phases](#4-migration-phases)
5. [Detailed File Changes](#5-detailed-file-changes)
6. [Type System Migration](#6-type-system-migration)
7. [Test Infrastructure](#7-test-infrastructure)
8. [Risk Assessment](#8-risk-assessment)
9. [Rollback Strategy](#9-rollback-strategy)

---

## 1. Executive Summary

### Current State
- **Framework**: Playwright v1.40.0
- **Primary Use**: Connect to existing Chrome via CDP (port 9223)
- **Secondary Use**: Launch browser (can be removed)
- **Abstraction**: `CdpClient` interface already abstracts CDP operations

### Target State
- **Framework**: Puppeteer (latest stable)
- **Use Case**: Connect-only mode to user's Chrome installation
- **Benefits**:
  - Smaller dependency footprint (no browser downloads)
  - Native CDP support (Puppeteer is CDP-first)
  - Simpler API for CDP-focused operations

### Migration Complexity: **Medium**
- Good abstraction layer exists (`CdpClient` interface)
- ~35 files reference Playwright types
- Core changes concentrated in 3-4 files

---

## 2. Scope Analysis

### Files Requiring Changes

#### Core Source Files (11 files)

| File | Impact | Changes Required |
|------|--------|------------------|
| `src/browser/session-manager.ts` | **High** | Rewrite connection logic |
| `src/cdp/playwright-cdp-client.ts` | **High** | Rename + rewrite for Puppeteer CDPSession |
| `src/browser/page-registry.ts` | **Medium** | Change `Page` type import |
| `src/browser/page-stabilization.ts` | **Medium** | Update Page API usage |
| `src/browser/page-network-tracker.ts` | **Medium** | Update Page/Request types |
| `src/delta/dom-stabilizer.ts` | **Low** | Change type import |
| `src/observation/observation-accumulator.ts` | **Low** | Change type import |
| `src/snapshot/snapshot-compiler.ts` | **Low** | Change type import |
| `src/snapshot/snapshot-health.ts` | **Low** | Change type import |
| `src/tools/execute-action.ts` | **Low** | Change type import |

#### Test Files (15+ files)

| Category | Files | Changes Required |
|----------|-------|------------------|
| Mocks | `tests/mocks/playwright.mock.ts` | Rename + update mock structure |
| Unit tests | 10+ files | Update imports |
| Integration tests | 4 files | Update browser connection |

### Files That Can Be Removed

Since we're removing browser launch capability:

```
- LaunchOptions interface (session-manager.ts)
- launch() method (session-manager.ts)
- launchPersistentContext logic (session-manager.ts)
- isPersistentContext tracking (session-manager.ts)
```

---

## 3. API Differences

### Connection API

| Operation | Playwright | Puppeteer |
|-----------|------------|-----------|
| Connect to CDP | `chromium.connectOverCDP(url)` | `puppeteer.connect({ browserWSEndpoint })` |
| Get contexts | `browser.contexts()` | `browser.browserContexts()` |
| Get pages | `context.pages()` | `context.pages()` or `browser.pages()` |
| Create CDP session | `context.newCDPSession(page)` | `page.target().createCDPSession()` |
| Check connected | `browser.isConnected()` | `browser.connected` (property) |
| Disconnect event | `browser.on('disconnected')` | `browser.on('disconnected')` |

### Page API

| Operation | Playwright | Puppeteer |
|-----------|------------|-----------|
| Get URL | `page.url()` | `page.url()` |
| Get title | `await page.title()` | `await page.title()` |
| Navigate | `page.goto(url, { waitUntil })` | `page.goto(url, { waitUntil })` |
| Close | `page.close()` | `page.close()` |
| Is closed | `page.isClosed()` | `page.isClosed()` |
| Wait load state | `page.waitForLoadState('networkidle')` | `page.waitForNetworkIdle()` |
| Evaluate | `page.evaluate(fn)` | `page.evaluate(fn)` |
| Viewport | `page.viewportSize()` | `page.viewport()` |
| Events | `page.on('request', ...)` | `page.on('request', ...)` |

### CDP Session API

| Operation | Playwright | Puppeteer |
|-----------|------------|-----------|
| Send command | `session.send(method, params)` | `session.send(method, params)` |
| Subscribe | `session.on(event, handler)` | `session.on(event, handler)` |
| Unsubscribe | `session.off(event, handler)` | `session.off(event, handler)` |
| Detach | `session.detach()` | `session.detach()` |

### Type Differences

| Playwright Type | Puppeteer Type |
|-----------------|----------------|
| `Browser` | `Browser` |
| `BrowserContext` | `BrowserContext` |
| `Page` | `Page` |
| `CDPSession` | `CDPSession` |
| `Request` | `HTTPRequest` |
| `Response` | `HTTPResponse` |

---

## 4. Migration Phases

### Phase 1: Preparation (Foundation)

**Goal**: Set up Puppeteer and create parallel infrastructure

1. **Add Puppeteer dependency**
   ```bash
   npm install puppeteer-core
   npm uninstall playwright  # After migration complete
   ```

   > Using `puppeteer-core` avoids downloading Chromium (we connect to existing Chrome)

2. **Create new CDP client**
   - Create `src/cdp/puppeteer-cdp-client.ts`
   - Implement `CdpClient` interface
   - Keep `PlaywrightCdpClient` for parallel testing

3. **Create type compatibility layer**
   - Create `src/types/browser.types.ts`
   - Define framework-agnostic page interface

### Phase 2: Core Migration (Session Manager)

**Goal**: Replace browser connection logic

1. **Update SessionManager imports**
   ```typescript
   // Before
   import { chromium, type Browser, type BrowserContext } from 'playwright';

   // After
   import puppeteer, { type Browser, type BrowserContext } from 'puppeteer-core';
   ```

2. **Rewrite connect() method**
   - Replace `chromium.connectOverCDP()` with `puppeteer.connect()`
   - Update context retrieval logic
   - Update CDP session creation

3. **Remove launch() method**
   - Delete `launch()` and related code
   - Remove `LaunchOptions` interface
   - Remove persistent context logic

4. **Update disconnect handling**
   - `browser.isConnected()` → `browser.connected`
   - Event handling remains similar

### Phase 3: Page Operations Migration

**Goal**: Update all page-related code

1. **Update page-registry.ts**
   - Change import from Playwright to Puppeteer
   - `Page` type is compatible

2. **Update page-stabilization.ts**
   - `page.waitForLoadState('networkidle')` → `page.waitForNetworkIdle()`
   - Add timeout options mapping

3. **Update page-network-tracker.ts**
   - `Request` → `HTTPRequest`
   - Method names are mostly compatible

4. **Update remaining files**
   - Update type imports in all affected files
   - Most usage patterns remain the same

### Phase 4: Test Infrastructure

**Goal**: Update test mocks and fixtures

1. **Rename mock file**
   - `playwright.mock.ts` → `puppeteer.mock.ts`
   - Update mock interfaces

2. **Update mock implementations**
   ```typescript
   // Key differences
   isConnected: vi.fn() → connected: true (property)
   viewportSize: vi.fn() → viewport: vi.fn()
   ```

3. **Update all test imports**
   - Search and replace across test files
   - Verify test compatibility

### Phase 5: Cleanup and Verification

**Goal**: Remove Playwright, verify functionality

1. **Remove Playwright**
   ```bash
   npm uninstall playwright
   npm uninstall @types/playwright  # if exists
   ```

2. **Remove deprecated code**
   - Delete `playwright-cdp-client.ts`
   - Remove launch-related types and code

3. **Run full test suite**
   ```bash
   npm run check
   ```

4. **Integration testing**
   - Test connection to real Chrome instance
   - Verify all tools work correctly

---

## 5. Detailed File Changes

### 5.1 `src/browser/session-manager.ts`

#### Imports
```typescript
// BEFORE
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { PlaywrightCdpClient } from '../cdp/playwright-cdp-client.js';

// AFTER
import puppeteer, { type Browser, type BrowserContext, type Page } from 'puppeteer-core';
import { PuppeteerCdpClient } from '../cdp/puppeteer-cdp-client.js';
```

#### Remove These Members
```typescript
// DELETE these
private isPersistentContext = false;
export interface LaunchOptions { ... }
async launch(options: LaunchOptions = {}): Promise<void> { ... }
```

#### Modify connect() Method
```typescript
// BEFORE (lines 293-370)
async connect(options: ConnectOptions = {}): Promise<void> {
  // ...
  const connectionPromise = chromium.connectOverCDP(endpointUrl);
  // ...
  browser = await Promise.race([connectionPromise, timeoutPromise]);
  const contexts = browser.contexts();
  // ...
  const cdpSession = await this.context.newCDPSession(page);
}

// AFTER
async connect(options: ConnectOptions = {}): Promise<void> {
  if (this._connectionState !== 'idle' && this._connectionState !== 'failed') {
    throw BrowserSessionError.invalidState(this._connectionState, 'connect');
  }

  const host = options.host ?? process.env.CEF_BRIDGE_HOST ?? DEFAULT_CDP_HOST;
  const port = options.port ?? Number(process.env.CEF_BRIDGE_PORT ?? DEFAULT_CDP_PORT);
  const endpointUrl = options.endpointUrl ?? `http://${host}:${port}`;
  const timeout = options.timeout ?? DEFAULT_CONNECTION_TIMEOUT;

  if (!isValidHttpUrl(endpointUrl)) {
    throw BrowserSessionError.invalidUrl(endpointUrl);
  }

  this.transitionTo('connecting');
  this.logger.info('Connecting to browser via CDP', { endpointUrl, timeout });

  let browser: Browser | null = null;
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    // Fetch browser WebSocket endpoint from CDP
    const wsEndpoint = await this.fetchWebSocketEndpoint(endpointUrl, timeout);

    const connectionPromise = puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
      defaultViewport: null, // Use browser's viewport
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(BrowserSessionError.connectionTimeout(endpointUrl, timeout));
      }, timeout);
    });

    browser = await Promise.race([connectionPromise, timeoutPromise]);

    // Get the default context
    const contexts = browser.browserContexts();
    if (contexts.length > 0) {
      this.context = contexts[0];
    } else {
      this.context = await browser.createBrowserContext();
    }

    this.browser = browser;
    this.isExternalBrowser = true;
    this.setupBrowserListeners();
    this.transitionTo('connected');

    this.logger.info('Connected to browser successfully', {
      contexts: contexts.length,
      pages: (await this.context.pages()).length,
    });
  } catch (error) {
    if (browser) {
      await browser.disconnect().catch(() => {});
    }
    this.transitionTo('failed');

    if (BrowserSessionError.isBrowserSessionError(error)) {
      throw error;
    }
    throw BrowserSessionError.connectionFailed(
      error instanceof Error ? error : new Error(String(error)),
      { endpointUrl }
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// NEW helper method
private async fetchWebSocketEndpoint(httpEndpoint: string, timeout: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${httpEndpoint}/json/version`, {
      signal: controller.signal,
    });
    const data = await response.json();
    return data.webSocketDebuggerUrl;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

#### Modify adoptPage() Method
```typescript
// BEFORE (line 417)
const cdpSession = await this.context.newCDPSession(page);

// AFTER
const cdpSession = await page.createCDPSession();
```

#### Modify createPage() Method
```typescript
// BEFORE (line 458)
const cdpSession = await this.context.newCDPSession(page);

// AFTER
const cdpSession = await page.createCDPSession();
```

#### Modify isRunning() Method
```typescript
// BEFORE
return this.browser?.isConnected() ?? false;

// AFTER
return this.browser?.connected ?? false;
```

#### Modify rebindCdpSession() Method
```typescript
// BEFORE (line 816)
const cdpSession = await this.context.newCDPSession(handle.page);

// AFTER
const cdpSession = await handle.page.createCDPSession();
```

#### Modify shutdown() Method
```typescript
// BEFORE
await this.browser.close();

// AFTER (for external browser, just disconnect)
await this.browser.disconnect();
```

### 5.2 `src/cdp/puppeteer-cdp-client.ts` (New File)

```typescript
/**
 * Puppeteer CDP Client
 *
 * CdpClient implementation wrapping Puppeteer's CDPSession.
 */

import type { CDPSession } from 'puppeteer-core';
import type { CdpClient, CdpEventHandler, CdpClientOptions } from './cdp-client.interface.js';
import type { CdpHealthDiagnostics } from '../state/health.types.js';
import { getLogger } from '../shared/services/logging.service.js';

export class PuppeteerCdpClient implements CdpClient {
  private static readonly DEFAULT_DOMAINS_WITHOUT_ENABLE = new Set([
    'Browser',
    'Target',
    'SystemInfo',
    'Input',
    'IO',
    'DeviceAccess',
    'Tethering',
    'HeapProfiler',
    'Schema',
  ]);

  private active = true;
  private readonly logger = getLogger();
  private readonly timeout: number;
  private readonly enabledDomains = new Set<string>();
  private readonly eventHandlers = new Map<string, Set<CdpEventHandler>>();
  private readonly domainsWithoutEnable: Set<string>;
  private lastError?: string;
  private lastErrorTime?: Date;

  constructor(
    private readonly session: CDPSession,
    options: CdpClientOptions = {}
  ) {
    this.timeout = options.timeout ?? 30000;
    this.domainsWithoutEnable = options.domainsWithoutEnable
      ? new Set(options.domainsWithoutEnable)
      : PuppeteerCdpClient.DEFAULT_DOMAINS_WITHOUT_ENABLE;
  }

  async send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.active) {
      throw new Error('CDP session is closed');
    }

    if (!method.includes('.')) {
      throw new Error(`Invalid CDP method format: "${method}". Expected "Domain.method" format.`);
    }

    const domain = method.split('.')[0];

    if (
      !this.enabledDomains.has(domain) &&
      !method.endsWith('.enable') &&
      !method.endsWith('.disable')
    ) {
      await this.enableDomain(domain);
    }

    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const result = await Promise.race([
        this.session.send(method as any, params),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`CDP command timed out after ${this.timeout}ms: ${method}`));
          }, this.timeout);
        }),
      ]);

      return result as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError = errorMessage;
      this.lastErrorTime = new Date();

      if (
        errorMessage.includes('Target closed') ||
        errorMessage.includes('Session closed') ||
        errorMessage.includes('detached')
      ) {
        this.active = false;
        this.enabledDomains.clear();
      }

      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  on(event: string, handler: CdpEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    this.session.on(event as any, handler as any);
  }

  off(event: string, handler: CdpEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    handlers?.delete(handler);
    if (handlers?.size === 0) {
      this.eventHandlers.delete(event);
    }
    this.session.off(event as any, handler as any);
  }

  once(event: string, handler: CdpEventHandler): void {
    const wrappedHandler = (params: Record<string, unknown>) => {
      this.off(event, wrappedHandler);
      handler(params);
    };
    this.on(event, wrappedHandler);
  }

  async close(): Promise<void> {
    if (this.active) {
      try {
        this.removeAllEventHandlers();
        await this.session.detach();
      } catch (error) {
        this.logger.debug('Error detaching CDP session', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.active = false;
        this.enabledDomains.clear();
        this.eventHandlers.clear();
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getHealth(): CdpHealthDiagnostics {
    return {
      active: this.active,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
    };
  }

  getEnabledDomains(): ReadonlySet<string> {
    return this.enabledDomains;
  }

  private async enableDomain(domain: string): Promise<void> {
    if (this.domainsWithoutEnable.has(domain)) {
      this.enabledDomains.add(domain);
      return;
    }

    try {
      await this.session.send(`${domain}.enable` as any);
      this.enabledDomains.add(domain);
    } catch {
      this.enabledDomains.add(domain);
    }
  }

  private removeAllEventHandlers(): void {
    for (const [event, handlers] of this.eventHandlers) {
      for (const handler of handlers) {
        try {
          this.session.off(event as any, handler as any);
        } catch {
          // Handler may already be removed
        }
      }
    }
  }
}
```

### 5.3 `src/browser/page-registry.ts`

```typescript
// BEFORE (line 8)
import type { Page } from 'playwright';

// AFTER
import type { Page } from 'puppeteer-core';
```

### 5.4 `src/browser/page-stabilization.ts`

```typescript
// BEFORE
import type { Page } from 'playwright';

// Changes needed in waitForNetworkQuiet():
// BEFORE
await page.waitForLoadState('networkidle', { timeout });

// AFTER
await page.waitForNetworkIdle({ timeout, idleTime: 500 });
```

### 5.5 `src/browser/page-network-tracker.ts`

```typescript
// BEFORE
import type { Page, Request } from 'playwright';

// AFTER
import type { Page, HTTPRequest } from 'puppeteer-core';

// Update all Request references to HTTPRequest
```

### 5.6 Other Files (Type Import Only)

These files only need import changes:

```typescript
// src/delta/dom-stabilizer.ts
// src/observation/observation-accumulator.ts
// src/snapshot/snapshot-compiler.ts
// src/snapshot/snapshot-health.ts
// src/tools/execute-action.ts

// BEFORE
import type { Page } from 'playwright';

// AFTER
import type { Page } from 'puppeteer-core';
```

---

## 6. Type System Migration

### 6.1 Package.json Changes

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.2",
    "chrome-remote-interface": "^0.33.3",
    "puppeteer-core": "^22.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    // Remove @types/playwright if present
    // puppeteer-core includes types
  }
}
```

### 6.2 Type Compatibility Notes

| Aspect | Playwright | Puppeteer | Notes |
|--------|------------|-----------|-------|
| Page events | Full TypeScript support | Less strict typing | May need type assertions |
| CDP types | Uses devtools-protocol | Uses devtools-protocol | Compatible |
| Async patterns | All async | All async | No change |

---

## 7. Test Infrastructure

### 7.1 Mock File Rename and Update

**File**: `tests/mocks/puppeteer.mock.ts` (renamed from playwright.mock.ts)

Key changes:
```typescript
// Interface updates
export interface MockBrowser {
  // BEFORE
  isConnected: Mock;

  // AFTER
  connected: boolean;  // Property, not method
  disconnect: Mock;    // Add for Puppeteer
}

export interface MockPage {
  // BEFORE
  viewportSize: Mock;

  // AFTER
  viewport: Mock;
  createCDPSession: Mock;  // Add - Puppeteer uses page.createCDPSession()
}

// Update createMockBrowser
export function createMockBrowser(): MockBrowser {
  return {
    // ...
    connected: true,  // Property
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}
```

### 7.2 Test File Updates

All test files importing from `playwright.mock.ts`:

```typescript
// BEFORE
import { createLinkedMocks } from '../../mocks/playwright.mock.js';

// AFTER
import { createLinkedMocks } from '../../mocks/puppeteer.mock.js';
```

### 7.3 Integration Test Updates

Files: `tests/integration/*.test.ts`

```typescript
// BEFORE
import { chromium, type Browser, type Page } from 'playwright';

// AFTER
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

// Connection change
// BEFORE
browser = await chromium.launch({ headless: true });

// AFTER (for connect-only mode in tests)
// Option 1: Use a test Chrome instance
browser = await puppeteer.connect({ browserWSEndpoint: TEST_WS_ENDPOINT });

// Option 2: Skip integration tests that require launch
// Mark as integration-only with real Chrome
```

---

## 8. Risk Assessment

### High Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| CDP session creation | API differs significantly | Thorough testing of CDP operations |
| Network idle detection | Different API | Create wrapper function |
| Event typing | Less strict in Puppeteer | Add type assertions where needed |

### Medium Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| WebSocket endpoint discovery | Needs HTTP fetch first | Add helper method |
| Browser disconnect detection | Property vs method | Simple refactor |
| Test infrastructure | Significant mock changes | Update incrementally |

### Low Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| CDP commands | Same protocol | None needed |
| Page navigation | Similar API | Minor syntax changes |
| Type imports | Straightforward | Search/replace |

---

## 9. Rollback Strategy

### Pre-Migration Checklist

1. Create git branch: `feature/puppeteer-migration`
2. Tag current state: `pre-puppeteer-migration`
3. Document all Playwright-specific behaviors

### Rollback Steps

If migration fails:

1. **Immediate rollback**:
   ```bash
   git checkout main
   npm install
   ```

2. **Partial rollback** (keep parallel implementations):
   - Keep both CDP clients
   - Use feature flag to switch
   - Gradually migrate

### Success Criteria

Migration is complete when:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Connection to Chrome works
- [ ] All 20 MCP tools function correctly
- [ ] CDP operations perform equivalently
- [ ] No Playwright dependencies remain

---

## Appendix A: Command Reference

```bash
# Install Puppeteer
npm install puppeteer-core

# Remove Playwright (after migration)
npm uninstall playwright

# Run tests
npm run check

# Test specific file
npx vitest run tests/unit/browser/session-manager.test.ts

# Build
npm run build
```

## Appendix B: File Change Summary

| Category | Files | Action |
|----------|-------|--------|
| New | 1 | `src/cdp/puppeteer-cdp-client.ts` |
| Major rewrite | 1 | `src/browser/session-manager.ts` |
| Rename + update | 1 | `tests/mocks/puppeteer.mock.ts` |
| Import updates | ~30 | Various source and test files |
| Delete | 1 | `src/cdp/playwright-cdp-client.ts` |

## Appendix C: API Quick Reference

```typescript
// Puppeteer Connection
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/...',
  defaultViewport: null,
});

// Get pages
const pages = await browser.pages();
const page = pages[0];

// Create CDP session
const cdpSession = await page.createCDPSession();

// CDP command
const doc = await cdpSession.send('DOM.getDocument', { depth: -1 });

// Disconnect (don't close external browser)
await browser.disconnect();
```
