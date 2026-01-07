# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Athena Browser MCP is an MCP (Model Context Protocol) server for browser automation via CDP (Chrome DevTools Protocol). It connects to a CEF-based browser.

**Current State**: The codebase has been cleaned up and prepared for a major overhaul to implement:

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
├── bridge/
│   └── cef-bridge.ts           # CDP connection to CEF browser
├── server/
│   └── mcp-server.ts           # MCP server shell (minimal)
├── shared/
│   ├── services/
│   │   ├── logging.service.ts       # Structured logging with MCP support
│   │   ├── selector-builder.service.ts  # CSS/XPath selector generation
│   │   └── dom-transformer.service.ts   # DOM tree utilities
│   └── types/
│       └── base.types.ts        # Shared types (BBox, Selectors, DomTreeNode)
├── lib/                         # Extracted reusable algorithms
│   ├── constants.ts             # INTERACTIVE_ROLES, INTERACTIVE_TAGS, etc.
│   ├── regions.ts               # Semantic region resolution
│   ├── scoring.ts               # Multi-signal element scoring
│   ├── text-utils.ts            # Text normalization utilities
│   ├── selectors.ts             # Selector building utilities
│   └── index.ts                 # Re-exports
└── index.ts                     # Entry point
```

## Key Components

### CEF Bridge (`src/bridge/cef-bridge.ts`)

- Connects to CEF browser via CDP (chrome-remote-interface)
- Auto-reconnect on disconnect
- Environment variables: `CEF_BRIDGE_HOST` (default: 127.0.0.1), `CEF_BRIDGE_PORT` (default: 9223)

### MCP Server (`src/server/mcp-server.ts`)

- Minimal shell ready for new tool registrations
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
