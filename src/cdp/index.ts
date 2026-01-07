/**
 * CDP Module
 *
 * Exports CDP client interfaces and implementations.
 */

// Interface
export type { CdpClient, CdpEventHandler, CdpClientOptions } from './cdp-client.interface.js';

// Implementations
export { PlaywrightCdpClient } from './playwright-cdp-client.js';
