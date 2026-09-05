import { useAuthStore } from '../stores/authStore';

const SESSION_STORAGE_KEY = 'vastra_session_id';

/**
 * Retrieves the unified, persistent session ID across the Vastra.AI storefront and AI agent.
 * If user is authenticated, links to user identity.
 * Persists in localStorage across page refreshes and navigation.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return 'sess_default';
  }

  // Check if user is logged in
  try {
    const authState = useAuthStore.getState();
    if (authState.isLoggedIn && authState.user?.email) {
      const sanitizedEmail = authState.user.email.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      return `user_${sanitizedEmail}`;
    }
  } catch {
    // ignore if store not yet initialized
  }

  let storedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!storedSessionId || storedSessionId.trim().length === 0) {
    storedSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(SESSION_STORAGE_KEY, storedSessionId);
  }

  return storedSessionId;
}

/**
 * Resets or assigns a new session ID.
 */
export function setSessionId(newSessionId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
  }
}

/**
 * Clears the session ID to start a completely fresh session.
 */
export function resetSessionId(): string {
  const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
  }
  return newSessionId;
}

export default {
  getSessionId,
  setSessionId,
  resetSessionId,
};
