/**
 * MCP Tools Module
 *
 * Browser automation tools exposed via MCP protocol.
 */

// Tool handlers - Legacy names (for backward compatibility during transition)
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

// Tool handlers - New simplified names
export {
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
} from './browser-tools.js';

// Schemas - Legacy (for backward compatibility during transition)
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

// Schemas - New simplified names
export {
  // open
  OpenInputSchema,
  OpenOutputSchema,
  type OpenInput,
  type OpenOutput,
  // close
  CloseInputSchema,
  CloseOutputSchema,
  type CloseInput,
  type CloseOutput,
  // goto
  GotoInputSchemaBase,
  GotoInputSchema,
  GotoOutputSchema,
  type GotoInput,
  type GotoOutput,
  // snapshot
  SnapshotInputSchema,
  SnapshotOutputSchema,
  type SnapshotInput,
  type SnapshotOutput,
  // find
  FindInputSchema,
  FindOutputSchema,
  type FindInput,
  type FindOutput,
  // click
  ClickInputSchema,
  ClickOutputSchema,
  type ClickInput,
  type ClickOutput,
  // type
  TypeInputSchema,
  TypeOutputSchema,
  type TypeInput,
  type TypeOutput,
  // press
  PressInputSchema,
  PressOutputSchema,
  type PressInput,
  type PressOutput,
  // select
  SelectInputSchema,
  SelectOutputSchema,
  type SelectInput,
  type SelectOutput,
  // hover
  HoverInputSchema,
  HoverOutputSchema,
  type HoverInput,
  type HoverOutput,
  // scroll
  ScrollInputSchemaBase,
  ScrollInputSchema,
  ScrollOutputSchema,
  type ScrollInput,
  type ScrollOutput,
} from './tool-schemas.js';
