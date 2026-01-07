/**
 * Session Store
 *
 * Tracks active sessions per MCP client (tenant isolation).
 * Simple in-memory storage with no TTL auto-cleanup.
 */

import { randomUUID } from 'crypto';

/**
 * Represents a tenant session
 */
export interface TenantSession {
  /** Unique session identifier */
  session_id: string;

  /** Tenant/client identifier */
  tenant_id: string;

  /** Page IDs associated with this session */
  page_ids: Set<string>;

  /** When the session was created */
  created_at: Date;
}

/**
 * In-memory session store for tenant isolation
 */
export class SessionStore {
  private readonly sessions = new Map<string, TenantSession>();

  /**
   * Create a new session for a tenant
   *
   * @param tenant_id - The tenant/client identifier
   * @returns The new session_id
   */
  createSession(tenant_id: string): string {
    const session_id = `session-${randomUUID()}`;

    const session: TenantSession = {
      session_id,
      tenant_id,
      page_ids: new Set(),
      created_at: new Date(),
    };

    this.sessions.set(session_id, session);

    return session_id;
  }

  /**
   * Get a session by its ID
   *
   * @param session_id - The session identifier
   * @returns TenantSession if found, undefined otherwise
   */
  getSession(session_id: string): TenantSession | undefined {
    return this.sessions.get(session_id);
  }

  /**
   * Add a page to a session
   *
   * @param session_id - The session identifier
   * @param page_id - The page identifier to add
   */
  addPage(session_id: string, page_id: string): void {
    const session = this.sessions.get(session_id);
    if (session) {
      session.page_ids.add(page_id);
    }
  }

  /**
   * Remove a page from a session
   *
   * @param session_id - The session identifier
   * @param page_id - The page identifier to remove
   */
  removePage(session_id: string, page_id: string): void {
    const session = this.sessions.get(session_id);
    if (session) {
      session.page_ids.delete(page_id);
    }
  }

  /**
   * Get all pages for a session
   *
   * @param session_id - The session identifier
   * @returns Array of page_ids (empty if session not found)
   */
  getPages(session_id: string): string[] {
    const session = this.sessions.get(session_id);
    if (!session) {
      return [];
    }
    return Array.from(session.page_ids);
  }

  /**
   * Destroy a session completely
   *
   * @param session_id - The session identifier
   */
  destroySession(session_id: string): void {
    this.sessions.delete(session_id);
  }

  /**
   * List all active sessions
   *
   * @returns Array of all TenantSession objects
   */
  listSessions(): TenantSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get sessions for a specific tenant
   *
   * @param tenant_id - The tenant identifier
   * @returns Array of sessions for this tenant
   */
  getSessionsByTenant(tenant_id: string): TenantSession[] {
    return this.listSessions().filter((s) => s.tenant_id === tenant_id);
  }

  /**
   * Get the total number of sessions
   *
   * @returns Session count
   */
  sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Check if a session exists
   *
   * @param session_id - The session identifier
   * @returns true if session exists
   */
  hasSession(session_id: string): boolean {
    return this.sessions.has(session_id);
  }

  /**
   * Clear all sessions (for testing or shutdown)
   */
  clear(): void {
    this.sessions.clear();
  }
}
