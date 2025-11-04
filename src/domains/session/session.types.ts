/**
 * Session Domain Types
 *
 * All parameter and response types for session-related tools
 */

import type { BrowserCookie, SessionState } from '../../shared/types/index.js';

/**
 * session_cookies_get tool - Get cookies
 */
export interface SessionCookiesGetParams {
  urls?: string[];
}

export interface SessionCookiesGetResponse {
  cookies: BrowserCookie[];
}

/**
 * session_cookies_set tool - Set cookies
 */
export interface SessionCookiesSetParams {
  cookies: Array<{
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    expires?: number;
  }>;
}

export interface SessionCookiesSetResponse {
  success: boolean;
  error?: string;
}

/**
 * session_state_get tool - Get current session state
 */
export interface SessionStateGetParams {
  // No parameters
}

export interface SessionStateGetResponse {
  state: SessionState;
}

/**
 * session_state_set tool - Set session state (restore)
 */
export interface SessionStateSetParams {
  state: SessionState;
}

export interface SessionStateSetResponse {
  success: boolean;
  error?: string;
}

/**
 * session_close tool - Close browser session
 */
export interface SessionCloseParams {
  saveState?: boolean;
}

export interface SessionCloseResponse {
  success: boolean;
  state?: SessionState;
  error?: string;
}
