/**
 * Tool Registry
 *
 * Registers all MCP tools and maps them to their handlers
 */

import { z } from 'zod';
import type { ToolDefinition } from './types.js';

// Import all handler types
import type { DomTreeHandler, AxTreeHandler, UiDiscoverHandler, LayoutHandler, VisionHandler, ContentHandler, NetworkHandler } from '../domains/perception/handlers/index.js';
import type { ActionHandler, FormHandler, KeyboardHandler } from '../domains/interaction/handlers/index.js';
import type { NavigationHandler } from '../domains/navigation/handlers/index.js';
import type { SessionHandler } from '../domains/session/handlers/index.js';

/**
 * Handler collection interface
 */
export interface Handlers {
  // Perception
  domTree: DomTreeHandler;
  axTree: AxTreeHandler;
  uiDiscover: UiDiscoverHandler;
  layout: LayoutHandler;
  vision: VisionHandler;
  content: ContentHandler;
  network: NetworkHandler;

  // Interaction
  action: ActionHandler;
  form: FormHandler;
  keyboard: KeyboardHandler;

  // Navigation
  navigation: NavigationHandler;

  // Session
  session: SessionHandler;
}

/**
 * Tool Registry
 *
 * Central registry for all MCP tools
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(private readonly handlers: Handlers) {
    this.registerAllTools();
  }

  /**
   * Register all tools
   */
  private registerAllTools(): void {
    // Perception tools
    this.registerPerceptionTools();

    // Interaction tools
    this.registerInteractionTools();

    // Navigation tools
    this.registerNavigationTools();

    // Session tools
    this.registerSessionTools();
  }

  /**
   * Register perception domain tools
   */
  private registerPerceptionTools(): void {
    // dom_get_tree
    this.register({
      name: 'dom_get_tree',
      description: 'Get the DOM tree structure',
      inputSchema: z.object({
        maxDepth: z.number().optional(),
        visibleOnly: z.boolean().optional(),
      }),
      handler: async (params) => this.handlers.domTree.handle(params),
    });

    // ax_get_tree
    this.register({
      name: 'ax_get_tree',
      description: 'Get the accessibility tree',
      inputSchema: z.object({
        frameId: z.string().optional(),
      }),
      handler: async (params) => this.handlers.axTree.handle(params),
    });

    // ui_discover
    this.register({
      name: 'ui_discover',
      description: 'Discover interactive UI elements',
      inputSchema: z.object({
        scope: z.object({
          css: z.string().optional(),
          xpath: z.string().optional(),
        }).optional(),
        visibleOnly: z.boolean().optional(),
      }),
      handler: async (params) => this.handlers.uiDiscover.handle(params),
    });

    // layout_get_box_model
    this.register({
      name: 'layout_get_box_model',
      description: 'Get element box model (position, size)',
      inputSchema: z.object({
        target: z.object({
          css: z.string().optional(),
          xpath: z.string().optional(),
          nodeId: z.number().optional(),
        }),
        frameId: z.string().optional(),
      }),
      handler: async (params) => this.handlers.layout.getBoxModel(params),
    });

    // layout_is_visible
    this.register({
      name: 'layout_is_visible',
      description: 'Check if element is visible',
      inputSchema: z.object({
        target: z.object({
          css: z.string().optional(),
          xpath: z.string().optional(),
          nodeId: z.number().optional(),
        }),
        frameId: z.string().optional(),
      }),
      handler: async (params) => this.handlers.layout.isVisible(params),
    });

    // vision_find_by_text
    this.register({
      name: 'vision_find_by_text',
      description: 'Find elements by visible text (OCR)',
      inputSchema: z.object({
        text: z.string(),
        exact: z.boolean().optional(),
      }),
      handler: async (params) => this.handlers.vision.findByText(params),
    });

    // content_extract
    this.register({
      name: 'content_extract',
      description: 'Extract page content',
      inputSchema: z.object({
        selector: z.string().optional(),
        format: z.enum(['text', 'html', 'markdown']).optional(),
      }),
      handler: async (params) => this.handlers.content.extract(params),
    });

    // network_observe
    this.register({
      name: 'network_observe',
      description: 'Observe network activity',
      inputSchema: z.object({
        patterns: z.array(z.string()).optional(),
        captureHeaders: z.boolean().optional(),
        captureBodies: z.boolean().optional(),
      }),
      handler: async (params) => this.handlers.network.observe(params),
    });
  }

  /**
   * Register interaction domain tools
   */
  private registerInteractionTools(): void {
    // targets_resolve
    this.register({
      name: 'targets_resolve',
      description: 'Resolve a locator hint to an element reference',
      inputSchema: z.object({
        hint: z.object({
          css: z.string().optional(),
          xpath: z.string().optional(),
          ax: z.string().optional(),
          label: z.string().optional(),
          role: z.string().optional(),
          name: z.string().optional(),
          nearText: z.string().optional(),
          bbox: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
          }).optional(),
        }),
        frameId: z.string().optional(),
      }),
      handler: async (params) => this.handlers.action.resolve(params),
    });

    // act_click
    this.register({
      name: 'act_click',
      description: 'Click an element',
      inputSchema: z.object({
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
      }),
      handler: async (params) => this.handlers.action.click(params),
    });

    // act_type
    this.register({
      name: 'act_type',
      description: 'Type text into an input field',
      inputSchema: z.object({
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
      }),
      handler: async (params) => this.handlers.action.type(params),
    });

    // act_scroll_into_view
    this.register({
      name: 'act_scroll_into_view',
      description: 'Scroll element into viewport',
      inputSchema: z.object({
        target: z.object({
          css: z.string().optional(),
          xpath: z.string().optional(),
          nodeId: z.number().optional(),
        }),
        frameId: z.string().optional(),
      }),
      handler: async (params) => this.handlers.action.scrollIntoView(params),
    });

    // act_upload
    this.register({
      name: 'act_upload',
      description: 'Upload files to file input',
      inputSchema: z.object({
        target: z.object({
          css: z.string().optional(),
          xpath: z.string().optional(),
          nodeId: z.number().optional(),
        }),
        files: z.array(z.string()),
        frameId: z.string().optional(),
      }),
      handler: async (params) => this.handlers.action.upload(params),
    });

    // form_detect
    this.register({
      name: 'form_detect',
      description: 'Detect form fields and submit buttons',
      inputSchema: z.object({
        scope: z.object({
          css: z.string().optional(),
          xpath: z.string().optional(),
        }).optional(),
        frameId: z.string().optional(),
        visibleOnly: z.boolean().optional(),
        maxDepth: z.number().optional(),
      }),
      handler: async (params) => this.handlers.form.detect(params),
    });

    // form_fill
    this.register({
      name: 'form_fill',
      description: 'Fill multiple form fields at once',
      inputSchema: z.object({
        fields: z.record(z.string()),
        scope: z.object({
          css: z.string().optional(),
          xpath: z.string().optional(),
        }).optional(),
        submit: z.boolean().optional(),
        frameId: z.string().optional(),
      }),
      handler: async (params) => this.handlers.form.fill(params),
    });

    // kb_press
    this.register({
      name: 'kb_press',
      description: 'Press a key or key combination',
      inputSchema: z.object({
        key: z.string(),
        code: z.string().optional(),
        modifiers: z.array(z.enum(['Alt', 'Ctrl', 'Meta', 'Shift'])).optional(),
        delayMs: z.number().optional(),
      }),
      handler: async (params) => this.handlers.keyboard.press(params),
    });

    // kb_hotkey
    this.register({
      name: 'kb_hotkey',
      description: 'Execute common hotkey (copy, paste, etc.)',
      inputSchema: z.object({
        hotkey: z.enum(['copy', 'paste', 'cut', 'selectAll', 'undo', 'redo', 'save', 'find', 'refresh', 'newTab', 'closeTab']),
      }),
      handler: async (params) => this.handlers.keyboard.hotkey(params),
    });
  }

  /**
   * Register navigation domain tools
   */
  private registerNavigationTools(): void {
    // nav_goto
    this.register({
      name: 'nav_goto',
      description: 'Navigate to URL',
      inputSchema: z.object({
        url: z.string(),
        waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
        timeout: z.number().optional(),
      }),
      handler: async (params) => this.handlers.navigation.goto(params),
    });

    // nav_back
    this.register({
      name: 'nav_back',
      description: 'Go back in history',
      inputSchema: z.object({}),
      handler: async (params) => this.handlers.navigation.back(params),
    });

    // nav_forward
    this.register({
      name: 'nav_forward',
      description: 'Go forward in history',
      inputSchema: z.object({}),
      handler: async (params) => this.handlers.navigation.forward(params),
    });

    // nav_reload
    this.register({
      name: 'nav_reload',
      description: 'Reload current page',
      inputSchema: z.object({
        ignoreCache: z.boolean().optional(),
      }),
      handler: async (params) => this.handlers.navigation.reload(params),
    });

    // nav_get_url
    this.register({
      name: 'nav_get_url',
      description: 'Get current URL and title',
      inputSchema: z.object({}),
      handler: async (params) => this.handlers.navigation.getUrl(params),
    });
  }

  /**
   * Register session domain tools
   */
  private registerSessionTools(): void {
    // session_cookies_get
    this.register({
      name: 'session_cookies_get',
      description: 'Get cookies',
      inputSchema: z.object({
        urls: z.array(z.string()).optional(),
      }),
      handler: async (params) => this.handlers.session.getCookies(params),
    });

    // session_cookies_set
    this.register({
      name: 'session_cookies_set',
      description: 'Set cookies',
      inputSchema: z.object({
        cookies: z.array(z.object({
          name: z.string(),
          value: z.string(),
          url: z.string().optional(),
          domain: z.string().optional(),
          path: z.string().optional(),
          secure: z.boolean().optional(),
          httpOnly: z.boolean().optional(),
          sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
          expires: z.number().optional(),
        })),
      }),
      handler: async (params) => this.handlers.session.setCookies(params),
    });

    // session_state_get
    this.register({
      name: 'session_state_get',
      description: 'Get session state',
      inputSchema: z.object({}),
      handler: async (params) => this.handlers.session.getState(params),
    });

    // session_state_set
    this.register({
      name: 'session_state_set',
      description: 'Restore session state',
      inputSchema: z.object({
        state: z.object({
          url: z.string().optional(),
          title: z.string().optional(),
          cookies: z.array(z.any()).optional(),
          localStorage: z.record(z.string()).optional(),
          timestamp: z.number().optional(),
        }),
      }),
      handler: async (params) => this.handlers.session.setState(params),
    });

    // session_close
    this.register({
      name: 'session_close',
      description: 'Close browser session',
      inputSchema: z.object({
        saveState: z.boolean().optional(),
      }),
      handler: async (params) => this.handlers.session.close(params),
    });
  }

  /**
   * Register a single tool
   */
  private register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}
