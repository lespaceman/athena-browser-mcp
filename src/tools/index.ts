/**
 * MCP Tools Module
 *
 * Browser automation tools exposed via MCP protocol.
 */

export {
  initializeTools,
  getSnapshotStore,
} from './browser-tools.js';

// Tool handlers - V2 Simplified API
export {
  launchBrowser,
  connectBrowser,
  closePage,
  closeSession,
  navigate,
  goBack,
  goForward,
  reload,
  findElementsV2,
  getNodeDetailsV2,
  scrollElementIntoView,
  scrollPageV2,
  clickV2,
  typeV2,
  pressV2,
  selectV2,
  hoverV2,
} from './browser-tools.js';

// Schemas - V2 Simplified API
export {
  // launch_browser
  LaunchBrowserInputSchema,
  LaunchBrowserOutputSchema,
  type LaunchBrowserInput,
  type LaunchBrowserOutput,
  // connect_browser
  ConnectBrowserInputSchema,
  ConnectBrowserOutputSchema,
  type ConnectBrowserInput,
  type ConnectBrowserOutput,
  // close_page
  ClosePageInputSchema,
  ClosePageOutputSchema,
  type ClosePageInput,
  type ClosePageOutput,
  // close_session
  CloseSessionInputSchema,
  CloseSessionOutputSchema,
  type CloseSessionInput,
  type CloseSessionOutput,
  // navigate
  NavigateInputSchema,
  NavigateOutputSchema,
  type NavigateInput,
  type NavigateOutput,
  // go_back
  GoBackInputSchema,
  GoBackOutputSchema,
  type GoBackInput,
  type GoBackOutput,
  // go_forward
  GoForwardInputSchema,
  GoForwardOutputSchema,
  type GoForwardInput,
  type GoForwardOutput,
  // reload
  ReloadInputSchema,
  ReloadOutputSchema,
  type ReloadInput,
  type ReloadOutput,
  // find_elements_v2
  FindElementsV2InputSchema,
  FindElementsV2OutputSchema,
  type FindElementsV2Input,
  type FindElementsV2Output,
  // get_node_details_v2
  GetNodeDetailsV2InputSchema,
  GetNodeDetailsV2OutputSchema,
  type GetNodeDetailsV2Input,
  type GetNodeDetailsV2Output,
  // scroll_element_into_view
  ScrollElementIntoViewInputSchema,
  ScrollElementIntoViewOutputSchema,
  type ScrollElementIntoViewInput,
  type ScrollElementIntoViewOutput,
  // scroll_page
  ScrollPageInputSchema,
  ScrollPageOutputSchema,
  type ScrollPageInput,
  type ScrollPageOutput,
  // click_v2
  ClickV2InputSchema,
  ClickV2OutputSchema,
  type ClickV2Input,
  type ClickV2Output,
  // type_v2
  TypeV2InputSchema,
  TypeV2OutputSchema,
  type TypeV2Input,
  type TypeV2Output,
  // press_v2
  PressV2InputSchema,
  PressV2OutputSchema,
  type PressV2Input,
  type PressV2Output,
  // select_v2
  SelectV2InputSchema,
  SelectV2OutputSchema,
  type SelectV2Input,
  type SelectV2Output,
  // hover_v2
  HoverV2InputSchema,
  HoverV2OutputSchema,
  type HoverV2Input,
  type HoverV2Output,
} from './tool-schemas.js';
