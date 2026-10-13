const decision = (allowed, reason, lock = false, pause = false) => ({ allowed, reason, lock, pause });
const safeURL = value => {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null;
    return url;
  } catch { return null; }
};

// Pure trusted-panel boundary. No browser APIs, profile data, or persisted state.
export class SessionScope {
  #tabId; #origin; #startedAt; #lastActivity; #maxAgeMs; #idleMs;
  #contextKey = ''; #terminal = '';

  constructor({ tabId, origin, startedAt, maxAgeMs = 1800000, idleMs = 300000 }) {
    const url = safeURL(origin);
    if (!Number.isInteger(tabId) || tabId < 0 || !url || url.origin !== origin ||
        !Number.isFinite(startedAt) || startedAt < 0 || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0 ||
        !Number.isFinite(idleMs) || idleMs <= 0) throw new TypeError('Invalid session boundary');
    this.#tabId = tabId; this.#origin = origin; this.#startedAt = startedAt;
    this.#lastActivity = startedAt; this.#maxAgeMs = maxAgeMs; this.#idleMs = idleMs;
  }

  #deadline(now) {
    if (this.#terminal) return decision(false, this.#terminal, true);
    if (!Number.isFinite(now) || now < this.#lastActivity) return decision(false, 'invalid-time', false, true);
    if (now - this.#startedAt >= this.#maxAgeMs) this.#terminal = 'session-expired';
    else if (now - this.#lastActivity >= this.#idleMs) this.#terminal = 'idle-expired';
    return this.#terminal ? decision(false, this.#terminal, true) : null;
  }

  touch(now) {
    if (this.#deadline(now)) return false;
    this.#lastActivity = now;
    return true;
  }

  bindContext(key) {
    if (this.#terminal || typeof key !== 'string' || !key || (this.#contextKey && this.#contextKey !== key)) return false;
    this.#contextKey = key;
    return true;
  }

  inspect({ tabId, activeTabId, url, contextKey, now }) {
    const deadline = this.#deadline(now);
    if (deadline) return deadline;
    if (tabId !== this.#tabId) return decision(false, 'wrong-tab', false, true);
    if (activeTabId !== this.#tabId) return decision(false, 'inactive-tab', false, true);
    const parsed = safeURL(url);
    if (!parsed) return decision(false, 'invalid-url', false, true);
    if (parsed.origin !== this.#origin) return decision(false, 'origin-changed', false, true);
    if (typeof contextKey !== 'string') return decision(false, 'invalid-context', false, true);
    if (this.#contextKey && contextKey && this.#contextKey !== contextKey) return decision(false, 'context-changed', false, true);
    return decision(true, contextKey && this.#contextKey ? 'ok' : 'context-unconfirmed');
  }

  end() { this.#terminal = 'ended'; this.#contextKey = ''; }
}
