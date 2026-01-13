/**
 * Vitest Setup File
 *
 * Configures test environment, including suppressing logs during tests.
 */

import { vi } from 'vitest';
import { getLogger } from '../src/shared/services/logging.service.js';

// Suppress logger output during tests by setting minimum level to emergency
// This prevents log pollution in test output
getLogger().setMinLevel('emergency');

// Also suppress console.warn for deprecation warnings during tests
// eslint-disable-next-line @typescript-eslint/no-empty-function
vi.spyOn(console, 'warn').mockImplementation(() => {});
