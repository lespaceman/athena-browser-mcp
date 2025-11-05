/**
 * MCP Server
 *
 * Main server orchestration for the Browser Automation MCP Server
 * Handles tool registration, request routing, and MCP protocol implementation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { ServerConfig } from './types.js';
import type { Handlers } from './tool-registry.js';

/**
 * Helper function to wrap handler output for MCP
 */
function wrapOutput(output: unknown): {
  content: { type: 'text'; text: string }[];
  structuredContent: Record<string, unknown>;
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    structuredContent: output as Record<string, unknown>,
  };
}

/**
 * Browser Automation MCP Server
 *
 * Modern implementation using McpServer with native Zod integration
 * and structured output support
 */
export class BrowserAutomationServer {
  private server: McpServer;
  private transport: StdioServerTransport;

  constructor(
    private readonly config: ServerConfig,
    private readonly handlers: Handlers,
  ) {
    // Create modern MCP server instance
    this.server = new McpServer({
      name: config.name,
      version: config.version,
    });

    // Create stdio transport
    this.transport = new StdioServerTransport();

    // Register all tools with native Zod support
    this.registerAllTools();
  }

  /**
   * Register all tools using the modern McpServer API
   */
  private registerAllTools(): void {
    // Register perception tools
    this.registerPerceptionTools();

    // Register interaction tools
    this.registerInteractionTools();

    // Register navigation tools
    this.registerNavigationTools();

    // Register session tools
    this.registerSessionTools();
  }

  /**
   * Register perception domain tools
   */
  private registerPerceptionTools(): void {
    // dom_get_tree
    this.server.registerTool(
      'dom_get_tree',
      {
        title: 'Get DOM Tree',
        description: 'Get the DOM tree structure',
        inputSchema: {
          maxDepth: z.number().optional(),
          visibleOnly: z.boolean().optional(),
        },
        outputSchema: {
          tree: z.any(),
          timestamp: z.number(),
        },
      },
      async (input) => wrapOutput(await this.handlers.domTree.handle(input)),
    );

    // ax_get_tree
    this.server.registerTool(
      'ax_get_tree',
      {
        title: 'Get Accessibility Tree',
        description: 'Get the accessibility tree',
        inputSchema: {
          frameId: z.string().optional(),
        },
        outputSchema: {
          tree: z.any(),
          timestamp: z.number(),
        },
      },
      async (input) => wrapOutput(await this.handlers.axTree.handle(input)),
    );

    // ui_discover
    this.server.registerTool(
      'ui_discover',
      {
        title: 'Discover UI Elements',
        description: 'Discover interactive UI elements',
        inputSchema: {
          scope: z
            .object({
              css: z.string().optional(),
              xpath: z.string().optional(),
            })
            .optional(),
          visibleOnly: z.boolean().optional(),
        },
        outputSchema: {
          elements: z.array(z.any()),
          count: z.number(),
        },
      },
      async (input) => wrapOutput(await this.handlers.uiDiscover.handle(input)),
    );

    // layout_get_box_model
    this.server.registerTool(
      'layout_get_box_model',
      {
        title: 'Get Box Model',
        description: 'Get element box model (position, size)',
        inputSchema: {
          target: z.object({
            css: z.string().optional(),
            xpath: z.string().optional(),
            nodeId: z.number().optional(),
          }),
          frameId: z.string().optional(),
        },
        outputSchema: {
          boxModel: z.any(),
        },
      },
      async (input) => wrapOutput(await this.handlers.layout.getBoxModel(input)),
    );

    // layout_is_visible
    this.server.registerTool(
      'layout_is_visible',
      {
        title: 'Check Visibility',
        description: 'Check if element is visible',
        inputSchema: {
          target: z.object({
            css: z.string().optional(),
            xpath: z.string().optional(),
            nodeId: z.number().optional(),
          }),
          frameId: z.string().optional(),
        },
        outputSchema: {
          visible: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.layout.isVisible(input)),
    );

    // vision_find_by_text
    this.server.registerTool(
      'vision_find_by_text',
      {
        title: 'Find by Text',
        description: 'Find elements by visible text (OCR)',
        inputSchema: {
          text: z.string(),
          exact: z.boolean().optional(),
        },
        outputSchema: {
          elements: z.array(z.any()),
        },
      },
      async (input) => wrapOutput(await this.handlers.vision.findByText(input)),
    );

    // content_extract
    this.server.registerTool(
      'content_extract',
      {
        title: 'Extract Content',
        description: 'Extract page content',
        inputSchema: {
          selector: z.string().optional(),
          format: z.enum(['text', 'html', 'markdown']).optional(),
        },
        outputSchema: {
          content: z.string(),
        },
      },
      async (input) => wrapOutput(await this.handlers.content.extract(input)),
    );

    // network_observe
    this.server.registerTool(
      'network_observe',
      {
        title: 'Observe Network',
        description: 'Observe network activity',
        inputSchema: {
          patterns: z.array(z.string()).optional(),
          captureHeaders: z.boolean().optional(),
          captureBodies: z.boolean().optional(),
        },
        outputSchema: {
          requests: z.array(z.any()),
        },
      },
      async (input) => wrapOutput(await this.handlers.network.observe(input)),
    );
  }

  /**
   * Register interaction domain tools
   */
  private registerInteractionTools(): void {
    // targets_resolve
    this.server.registerTool(
      'targets_resolve',
      {
        title: 'Resolve Target',
        description: 'Resolve a locator hint to an element reference',
        inputSchema: {
          hint: z.object({
            css: z.string().optional(),
            xpath: z.string().optional(),
            ax: z.string().optional(),
            label: z.string().optional(),
            role: z.string().optional(),
            name: z.string().optional(),
            nearText: z.string().optional(),
            bbox: z
              .object({
                x: z.number(),
                y: z.number(),
                width: z.number(),
                height: z.number(),
              })
              .optional(),
          }),
          frameId: z.string().optional(),
        },
        outputSchema: {
          element: z.any(),
        },
      },
      async (input) => wrapOutput(await this.handlers.action.resolve(input)),
    );

    // act_click
    this.server.registerTool(
      'act_click',
      {
        title: 'Click Element',
        description: 'Click an element',
        inputSchema: {
          target: z.object({
            css: z.string().optional(),
            xpath: z.string().optional(),
            ax: z.string().optional(),
            label: z.string().optional(),
            role: z.string().optional(),
            nodeId: z.number().optional(),
          }),
          frameId: z.string().optional(),
          waitAfterMs: z.number().optional(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.action.click(input)),
    );

    // act_type
    this.server.registerTool(
      'act_type',
      {
        title: 'Type Text',
        description: 'Type text into an input field',
        inputSchema: {
          target: z.object({
            css: z.string().optional(),
            xpath: z.string().optional(),
            nodeId: z.number().optional(),
          }),
          text: z.string(),
          clearFirst: z.boolean().optional(),
          pressEnterAfter: z.boolean().optional(),
          simulateTyping: z.boolean().optional(),
          frameId: z.string().optional(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.action.type(input)),
    );

    // act_scroll_into_view
    this.server.registerTool(
      'act_scroll_into_view',
      {
        title: 'Scroll Into View',
        description: 'Scroll element into viewport',
        inputSchema: {
          target: z.object({
            css: z.string().optional(),
            xpath: z.string().optional(),
            nodeId: z.number().optional(),
          }),
          frameId: z.string().optional(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.action.scrollIntoView(input)),
    );

    // act_upload
    this.server.registerTool(
      'act_upload',
      {
        title: 'Upload Files',
        description: 'Upload files to file input',
        inputSchema: {
          target: z.object({
            css: z.string().optional(),
            xpath: z.string().optional(),
            nodeId: z.number().optional(),
          }),
          files: z.array(z.string()),
          frameId: z.string().optional(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.action.upload(input)),
    );

    // form_detect
    this.server.registerTool(
      'form_detect',
      {
        title: 'Detect Form',
        description: 'Detect form fields and submit buttons',
        inputSchema: {
          scope: z
            .object({
              css: z.string().optional(),
              xpath: z.string().optional(),
            })
            .optional(),
          frameId: z.string().optional(),
          visibleOnly: z.boolean().optional(),
          maxDepth: z.number().optional(),
        },
        outputSchema: {
          forms: z.array(z.any()),
        },
      },
      async (input) => wrapOutput(await this.handlers.form.detect(input)),
    );

    // form_fill
    this.server.registerTool(
      'form_fill',
      {
        title: 'Fill Form',
        description: 'Fill multiple form fields at once',
        inputSchema: {
          fields: z.record(z.string()),
          scope: z
            .object({
              css: z.string().optional(),
              xpath: z.string().optional(),
            })
            .optional(),
          submit: z.boolean().optional(),
          frameId: z.string().optional(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.form.fill(input)),
    );

    // kb_press
    this.server.registerTool(
      'kb_press',
      {
        title: 'Press Key',
        description: 'Press a key or key combination',
        inputSchema: {
          key: z.string(),
          code: z.string().optional(),
          modifiers: z.array(z.enum(['Alt', 'Ctrl', 'Meta', 'Shift'])).optional(),
          delayMs: z.number().optional(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.keyboard.press(input)),
    );

    // kb_hotkey
    this.server.registerTool(
      'kb_hotkey',
      {
        title: 'Execute Hotkey',
        description: 'Execute common hotkey (copy, paste, etc.)',
        inputSchema: {
          hotkey: z.enum([
            'copy',
            'paste',
            'cut',
            'selectAll',
            'undo',
            'redo',
            'save',
            'find',
            'refresh',
            'newTab',
            'closeTab',
          ]),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.keyboard.hotkey(input)),
    );
  }

  /**
   * Register navigation domain tools
   */
  private registerNavigationTools(): void {
    // nav_goto
    this.server.registerTool(
      'nav_goto',
      {
        title: 'Navigate to URL',
        description: 'Navigate to URL',
        inputSchema: {
          url: z.string(),
          waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
          timeout: z.number().optional(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.navigation.goto(input)),
    );

    // nav_back
    this.server.registerTool(
      'nav_back',
      {
        title: 'Go Back',
        description: 'Go back in history',
        inputSchema: {},
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.navigation.back(input)),
    );

    // nav_forward
    this.server.registerTool(
      'nav_forward',
      {
        title: 'Go Forward',
        description: 'Go forward in history',
        inputSchema: {},
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.navigation.forward(input)),
    );

    // nav_reload
    this.server.registerTool(
      'nav_reload',
      {
        title: 'Reload Page',
        description: 'Reload current page',
        inputSchema: {
          ignoreCache: z.boolean().optional(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.navigation.reload(input)),
    );

    // nav_get_url
    this.server.registerTool(
      'nav_get_url',
      {
        title: 'Get Current URL',
        description: 'Get current URL and title',
        inputSchema: {},
        outputSchema: {
          url: z.string(),
          title: z.string(),
        },
      },
      async (input) => wrapOutput(await this.handlers.navigation.getUrl(input)),
    );
  }

  /**
   * Register session domain tools
   */
  private registerSessionTools(): void {
    // session_cookies_get
    this.server.registerTool(
      'session_cookies_get',
      {
        title: 'Get Cookies',
        description: 'Get cookies',
        inputSchema: {
          urls: z.array(z.string()).optional(),
        },
        outputSchema: {
          cookies: z.array(z.any()),
        },
      },
      async (input) => wrapOutput(await this.handlers.session.getCookies(input)),
    );

    // session_cookies_set
    this.server.registerTool(
      'session_cookies_set',
      {
        title: 'Set Cookies',
        description: 'Set cookies',
        inputSchema: {
          cookies: z.array(
            z.object({
              name: z.string(),
              value: z.string(),
              url: z.string().optional(),
              domain: z.string().optional(),
              path: z.string().optional(),
              secure: z.boolean().optional(),
              httpOnly: z.boolean().optional(),
              sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
              expires: z.number().optional(),
            }),
          ),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.session.setCookies(input)),
    );

    // session_state_get
    this.server.registerTool(
      'session_state_get',
      {
        title: 'Get Session State',
        description: 'Get session state',
        inputSchema: {},
        outputSchema: {
          state: z.any(),
        },
      },
      async (input) => wrapOutput(await this.handlers.session.getState(input)),
    );

    // session_state_set
    this.server.registerTool(
      'session_state_set',
      {
        title: 'Set Session State',
        description: 'Restore session state',
        inputSchema: {
          state: z.object({
            url: z.string(),
            title: z.string().optional(),
            cookies: z.array(z.any()),
            localStorage: z.record(z.string()),
            timestamp: z.number(),
          }),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.session.setState(input)),
    );

    // session_close
    this.server.registerTool(
      'session_close',
      {
        title: 'Close Session',
        description: 'Close browser session',
        inputSchema: {
          saveState: z.boolean().optional(),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      async (input) => wrapOutput(await this.handlers.session.close(input)),
    );
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // Connect transport
    await this.server.connect(this.transport);

    console.error(`${this.config.name} v${this.config.version} started`);
    console.error(`Registered 32 tools`);
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    await this.server.close();
  }
}

// Export legacy MCPServer for backward compatibility (deprecated)
export { BrowserAutomationServer as MCPServer };
