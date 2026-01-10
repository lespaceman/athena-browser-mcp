/**
 * MCP Tools Module
 *
 * Browser automation tools exposed via MCP protocol.
 */

// Tool handlers
export {
  initializeTools,
  getSnapshotStore,
  browserLaunch,
  browserNavigate,
  browserClose,
  snapshotCapture,
  actionClick,
  getNodeDetails,
  findElements,
  getFactPack,
} from './browser-tools.js';

// Schemas
export {
  // browser_launch
  BrowserLaunchInputSchema,
  BrowserLaunchOutputSchema,
  type BrowserLaunchInput,
  type BrowserLaunchOutput,
  // browser_navigate
  BrowserNavigateInputSchema,
  BrowserNavigateOutputSchema,
  type BrowserNavigateInput,
  type BrowserNavigateOutput,
  // browser_close
  BrowserCloseInputSchema,
  BrowserCloseOutputSchema,
  type BrowserCloseInput,
  type BrowserCloseOutput,
  // snapshot_capture
  SnapshotCaptureInputSchema,
  SnapshotCaptureOutputSchema,
  NodeSummarySchema,
  type SnapshotCaptureInput,
  type SnapshotCaptureOutput,
  type NodeSummary,
  // action_click
  ActionClickInputSchema,
  ActionClickOutputSchema,
  type ActionClickInput,
  type ActionClickOutput,
  // get_node_details
  GetNodeDetailsInputSchema,
  GetNodeDetailsOutputSchema,
  NodeDetailsSchema,
  type GetNodeDetailsInput,
  type GetNodeDetailsOutput,
  type NodeDetails,
  // find_elements
  FindElementsInputSchema,
  FindElementsOutputSchema,
  type FindElementsInput,
  type FindElementsOutput,
  // get_factpack
  GetFactPackInputSchema,
  GetFactPackOutputSchema,
  type GetFactPackInput,
  type GetFactPackOutput,
  // FactPack schemas
  FactPackOptionsSchema,
  FactPackSchema,
  type FactPackOptions,
  type FactPackOutput,
} from './tool-schemas.js';
