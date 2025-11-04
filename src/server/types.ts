/**
 * Server Types
 *
 * Core types for server orchestration
 */

import type { z } from 'zod';

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  handler: (params: any) => Promise<any>;
}

/**
 * MCP Server configuration
 */
export interface ServerConfig {
  name: string;
  version: string;
  capabilities: {
    tools?: {};
    prompts?: {};
    resources?: {};
  };
}

/**
 * Tool execution context
 */
export interface ToolContext {
  toolName: string;
  params: unknown;
  startTime: number;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs?: number;
}
