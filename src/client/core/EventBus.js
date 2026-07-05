/**
 * EventBus - minimal publish/subscribe hub used to decouple panels and plugins.
 *
 * Listener errors are isolated: a throwing listener never prevents other
 * listeners from running (critical during live performances).
 */
export function createEventBus() {
  // Map<eventName, Set<listener>>
  const listeners = new Map();

  /**
   * Subscribe to an event.
   * @param {string} event - Event name (e.g. "code:run").
   * @param {(payload: any) => void} handler
   * @returns {() => void} Unsubscribe function.
   */
  function on(event, handler) {
    if (typeof event !== "string" || typeof handler !== "function") {
      throw new TypeError("EventBus.on requires an event name and a handler function");
    }
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(handler);
    return () => off(event, handler);
  }

  /**
   * Subscribe to an event, automatically unsubscribing after the first call.
   */
  function once(event, handler) {
    const unsubscribe = on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  /** Unsubscribe a handler from an event. */
  function off(event, handler) {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      listeners.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers. Errors thrown by individual handlers
   * are logged and swallowed so one broken subscriber can't break the rest.
   * @returns {number} Number of handlers invoked.
   */
  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set || set.size === 0) return 0;
    let invoked = 0;
    // Copy so handlers that unsubscribe during emit don't skip others
    for (const handler of [...set]) {
      try {
        handler(payload);
        invoked++;
      } catch (error) {
        console.error(`EventBus: error in listener for "${event}":`, error);
      }
    }
    return invoked;
  }

  /** Number of listeners for an event (mainly for tests/diagnostics). */
  function listenerCount(event) {
    return listeners.get(event)?.size || 0;
  }

  /** Remove all listeners (for teardown in tests). */
  function clear() {
    listeners.clear();
  }

  return { on, once, off, emit, listenerCount, clear };
}
