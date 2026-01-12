# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Athena Browser MCP is an MCP (Model Context Protocol) server for browser automation via Playwright and CDP (Chrome DevTools Protocol). It can launch new browsers or connect to existing Chromium-based browsers.

**Key Features**:

- **BaseSnapshot**: Canonical semantic representation of web pages
- **Page Brief**: Compact Markdown summary for LLM context
- **Structured Query Engine**: Find elements by semantic queries

## Build and Development Commands

```bash
# Build
npm run build              # Compile TypeScript

# Quality checks
npm run type-check         # TypeScript type checking
npm run lint               # ESLint
npm run lint:fix           # ESLint with auto-fix
npm run format             # Prettier format
npm run check              # Run all checks

# Testing (currently no tests - start fresh)
npm test                   # Run tests
npm run test:coverage      # With coverage
```

## Directory Structure

```
src/
├── browser/
│   ├── session-manager.ts      # Browser lifecycle (launch/connect/shutdown)
│   └── page-registry.ts        # Page tracking with MRU support
├── cdp/
│   ├── cdp-client.interface.ts # Generic CDP abstraction
│   └── playwright-cdp-client.ts # Playwright CDPSession implementation
├── server/
│   └── mcp-server.ts           # MCP server with tool registration
├── tools/
│   └── browser-tools.ts        # Tool handler implementations
├── snapshot/                    # BaseSnapshot extraction system
│   ├── snapshot-compiler.ts    # Orchestrates extraction
│   └── extractors/             # Modular extraction algorithms
├── factpack/                    # High-level semantic extraction
├── query/                       # Snapshot query engine
├── renderer/                    # XML output rendering
├── lib/                         # Reusable algorithms
└── index.ts                     # Entry point
```

## Key Components

### Session Manager (`src/browser/session-manager.ts`)

- Manages browser lifecycle (launch/connect/shutdown)
- Supports two modes: launch new browser or connect to existing (e.g., Athena)
- Uses Playwright for browser automation and CDP for low-level operations

### MCP Server (`src/server/mcp-server.ts`)

- MCP server with tool registration
- Uses stdio transport
- `registerTool()` method for adding new tools

### Extracted Library (`src/lib/`)

Reusable algorithms extracted from the original implementation:

- **constants.ts**: Interactive element detection constants
- **regions.ts**: Semantic page regions (header, footer, main, sidebar)
- **scoring.ts**: Element ranking by relevance signals
- **text-utils.ts**: Text normalization, XPath escaping, fuzzy matching
- **selectors.ts**: CSS/XPath selector building from semantic info

## Next Steps (Implementation Plan)

The new system will implement:

1. **BaseSnapshot extraction** - Compile CDP DOM/AX data into canonical IR
2. **Page Brief generation** - Derive grounded Markdown summary
3. **Structured Query Engine** - Find elements via semantic filters

See `docs/engineering-plan.md` and `docs/engineering-spec.md` for full specification.

## Technical Notes

- All imports use `.js` extensions (ESM with NodeNext resolution)
- CDP domains (Page, DOM, Network) are enabled on-demand
- The server currently has no registered tools (to be added)
