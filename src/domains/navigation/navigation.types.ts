/**
 * Navigation Domain Types
 *
 * All parameter and response types for navigation-related tools
 */

/**
 * nav_goto tool - Navigate to a URL
 */
export interface NavGotoParams {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface NavGotoResponse {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * nav_back tool - Go back in history
 */
export interface NavBackParams {
  // No parameters needed
}

export interface NavBackResponse {
  success: boolean;
  currentUrl?: string;
  error?: string;
}

/**
 * nav_forward tool - Go forward in history
 */
export interface NavForwardParams {
  // No parameters needed
}

export interface NavForwardResponse {
  success: boolean;
  currentUrl?: string;
  error?: string;
}

/**
 * nav_reload tool - Reload current page
 */
export interface NavReloadParams {
  ignoreCache?: boolean;
}

export interface NavReloadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * nav_get_url tool - Get current URL
 */
export interface NavGetUrlParams {
  // No parameters needed
}

export interface NavGetUrlResponse {
  url: string;
  title?: string;
}

/**
 * nav_wait_for_navigation tool - Wait for navigation to complete
 */
export interface NavWaitForNavigationParams {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface NavWaitForNavigationResponse {
  success: boolean;
  url?: string;
  error?: string;
}
