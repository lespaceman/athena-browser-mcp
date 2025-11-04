/**
 * MCP Server
 *
 * Main server orchestration for the Browser Automation MCP Server
 * Handles tool registration, request routing, and MCP protocol implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ServerConfig, ToolContext, ToolResult } from './types.js';
import type { ToolRegistry } from './tool-registry.js';

/**
 * MCP Server
 *
 * Implements the Model Context Protocol for browser automation
 */
export class MCPServer {
  private server: Server;
  private transport: StdioServerTransport;

  constructor(
    private readonly config: ServerConfig,
    private readonly toolRegistry: ToolRegistry,
  ) {
    // Create MCP server instance
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: config.capabilities,
      },
    );

    // Create stdio transport
    this.transport = new StdioServerTransport();

    // Set up request handlers
    this.setupHandlers();
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.toolRegistry.getAllTools();

      return {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: this.zodToJsonSchema(tool.inputSchema),
          },
        })),
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const params = request.params.arguments || {};

      // Execute tool
      const result = await this.executeTool(toolName, params);

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${result.error}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(toolName: string, params: unknown): Promise<ToolResult> {
    const context: ToolContext = {
      toolName,
      params,
      startTime: Date.now(),
    };

    try {
      // Get tool definition
      const tool = this.toolRegistry.getTool(toolName);
      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${toolName}`,
        };
      }

      // Validate parameters
      const validationResult = tool.inputSchema.safeParse(params);
      if (!validationResult.success) {
        return {
          success: false,
          error: `Invalid parameters: ${validationResult.error.message}`,
        };
      }

      // Execute handler
      const data = await tool.handler(validationResult.data);

      const executionTimeMs = Date.now() - context.startTime;

      return {
        success: true,
        data,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - context.startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs,
      };
    }
  }

  /**
   * Convert Zod schema to JSON Schema (simplified)
   */
  private zodToJsonSchema(schema: any): Record<string, any> {
    // This is a simplified conversion
    // In production, use a library like zod-to-json-schema
    return {};
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // Connect transport
    await this.server.connect(this.transport);

    console.error(`${this.config.name} v${this.config.version} started`);
    console.error(`Registered ${this.toolRegistry.getAllTools().length} tools`);
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    await this.server.close();
  }
}
