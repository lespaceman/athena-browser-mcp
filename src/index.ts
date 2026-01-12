#!/usr/bin/env node

/**
 * Browser Automation MCP Server
 *
 * Main entry point - initializes the MCP server with Playwright-based browser automation.
 */

import { BrowserAutomationServer } from './server/mcp-server.js';
import { SessionManager } from './browser/session-manager.js';
import {
  initializeTools,
  // New simplified tool handlers
  open,
  close,
  goto,
  snapshot,
  find,
  click,
  type,
  press,
  select,
  hover,
  scroll,
  // New simplified schemas
  OpenInputSchema,
  OpenOutputSchema,
  CloseInputSchema,
  CloseOutputSchema,
  GotoInputSchemaBase,
  GotoOutputSchema,
  SnapshotInputSchema,
  SnapshotOutputSchema,
  FindInputSchema,
  FindOutputSchema,
  ClickInputSchema,
  ClickOutputSchema,
  TypeInputSchema,
  TypeOutputSchema,
  PressInputSchema,
  PressOutputSchema,
  SelectInputSchema,
  SelectOutputSchema,
  HoverInputSchema,
  HoverOutputSchema,
  ScrollInputSchemaBase,
  ScrollOutputSchema,
} from './tools/index.js';

// Singleton session manager (initialized lazily on first tool use)
let sessionManager: SessionManager | null = null;

/**
 * Get or create the session manager
 */
export function getSessionManager(): SessionManager {
  sessionManager ??= new SessionManager();
  return sessionManager;
}

/**
 * Initialize all services and start the server
 */
function initializeServer(): BrowserAutomationServer {
  // Create MCP server shell
  // Note: Don't pass tools/logging capabilities - McpServer registers them automatically
  // when tools are registered via .tool() or .registerTool()
  const server = new BrowserAutomationServer({
    name: 'athena-browser-mcp',
    version: '2.0.0',
  });

  // Initialize session manager and tools
  const session = getSessionManager();
  initializeTools(session);

  // ============================================================================
  // SESSION TOOLS
  // ============================================================================

  server.registerTool(
    'open',
    {
      title: 'Open Browser',
      description:
        'Launch a new browser or connect to an existing one (e.g., Athena browser). ' +
        'Returns page state with page_brief (compact XML) by default. ' +
        'Use include_factpack: true for FactPack JSON with dialogs, forms, actions. ' +
        'Use include_nodes: true for raw node list.',
      inputSchema: OpenInputSchema.shape,
      outputSchema: OpenOutputSchema.shape,
    },
    open
  );

  server.registerTool(
    'close',
    {
      title: 'Close Browser',
      description:
        'Close a specific page or the entire browser session. ' +
        'If page_id is omitted, closes the entire session.',
      inputSchema: CloseInputSchema.shape,
      outputSchema: CloseOutputSchema.shape,
    },
    close
  );

  // ============================================================================
  // NAVIGATION TOOLS
  // ============================================================================

  server.registerTool(
    'goto',
    {
      title: 'Navigate',
      description:
        'Navigate a page: go to URL, back, forward, or refresh. ' +
        'For URL navigation, provide { url: "https://..." }. ' +
        'For history navigation, use { back: true } or { forward: true }. ' +
        'For refresh, use { refresh: true }. ' +
        'Returns page state after navigation.',
      inputSchema: GotoInputSchemaBase.shape,
      outputSchema: GotoOutputSchema.shape,
    },
    goto
  );

  // ============================================================================
  // OBSERVATION TOOLS
  // ============================================================================

  server.registerTool(
    'snapshot',
    {
      title: 'Capture Snapshot',
      description:
        'Capture a fresh snapshot of the page using CDP accessibility tree. ' +
        'Returns page_brief (compact XML) by default. ' +
        'Use include_factpack: true for FactPack JSON. ' +
        'Use include_nodes: true for raw node list.',
      inputSchema: SnapshotInputSchema.shape,
      outputSchema: SnapshotOutputSchema.shape,
    },
    snapshot
  );

  server.registerTool(
    'find',
    {
      title: 'Find Elements',
      description:
        'Find elements in the current snapshot by semantic filters, OR get details for a specific node. ' +
        'Query mode: filter by kind (button, link, input), label, region (header, footer, nav, main). ' +
        'Detail mode: pass node_id to get full info including layout, state, and attributes.',
      inputSchema: FindInputSchema.shape,
      outputSchema: FindOutputSchema.shape,
    },
    (input) => Promise.resolve(find(input))
  );

  // ============================================================================
  // INTERACTION TOOLS
  // ============================================================================

  server.registerTool(
    'click',
    {
      title: 'Click Element',
      description:
        'Click an element by its node_id from a previous snapshot. ' +
        'Uses CDP for reliable clicking with scrolling into view.',
      inputSchema: ClickInputSchema.shape,
      outputSchema: ClickOutputSchema.shape,
    },
    click
  );

  server.registerTool(
    'type',
    {
      title: 'Type Text',
      description:
        'Type text into an element. ' +
        'If node_id is provided, clicks the element first to focus it. ' +
        'Use clear: true to clear existing text before typing.',
      inputSchema: TypeInputSchema.shape,
      outputSchema: TypeOutputSchema.shape,
    },
    type
  );

  server.registerTool(
    'press',
    {
      title: 'Press Key',
      description:
        'Press a keyboard key. ' +
        'Supports: Enter, Tab, Escape, Backspace, Delete, Space, ' +
        'ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown. ' +
        'Optional modifiers: Control, Shift, Alt, Meta.',
      inputSchema: PressInputSchema.shape,
      outputSchema: PressOutputSchema.shape,
    },
    press
  );

  server.registerTool(
    'select',
    {
      title: 'Select Option',
      description:
        'Select an option from a <select> dropdown element. ' +
        'Provide the node_id of the select element and the value or visible text of the option.',
      inputSchema: SelectInputSchema.shape,
      outputSchema: SelectOutputSchema.shape,
    },
    select
  );

  server.registerTool(
    'hover',
    {
      title: 'Hover Element',
      description:
        'Hover over an element to reveal menus or tooltips. ' +
        'Scrolls the element into view and moves the mouse to its center.',
      inputSchema: HoverInputSchema.shape,
      outputSchema: HoverOutputSchema.shape,
    },
    hover
  );

  server.registerTool(
    'scroll',
    {
      title: 'Scroll',
      description:
        'Scroll the page or an element into view. ' +
        'If node_id is provided, scrolls that element into view. ' +
        'Otherwise, scrolls the page up or down by the specified amount.',
      inputSchema: ScrollInputSchemaBase.shape,
      outputSchema: ScrollOutputSchema.shape,
    },
    scroll
  );

  return server;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const server = initializeServer();
    await server.start();

    // Handle shutdown gracefully
    const shutdown = (signal: NodeJS.Signals) => {
      console.error(`Shutting down... (${signal})`);
      void (async () => {
        try {
          // Shutdown browser session first (if initialized)
          if (sessionManager) {
            await sessionManager.shutdown();
          }
          await server.stop();
          process.exit(0);
        } catch (shutdownError) {
          console.error('Error during shutdown:', shutdownError);
          process.exit(1);
        }
      })();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server
void main();
