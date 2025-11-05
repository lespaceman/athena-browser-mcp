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

type EmptyParams = Record<string, never>;

/**
 * nav_back tool - Go back in history
 */
export type NavBackParams = EmptyParams;

export interface NavBackResponse {
  success: boolean;
  currentUrl?: string;
  error?: string;
}

/**
 * nav_forward tool - Go forward in history
 */
export type NavForwardParams = EmptyParams;

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
export type NavGetUrlParams = EmptyParams;

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
