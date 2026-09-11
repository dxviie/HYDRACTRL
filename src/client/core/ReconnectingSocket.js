/**
 * ReconnectingSocket - a WebSocket that comes back on its own.
 *
 * Used on both ends of the output link: the UI (output-sync plugin) and the
 * output page. Reconnects with exponential backoff, never throws, and hands
 * parsed JSON messages to the caller. All platform pieces (WebSocket, timers)
 * are injectable for tests.
 */
import { parseSocketMessage } from "./outputProtocol.js";

const OPEN = 1;

/** Backoff delay in ms for the given attempt (0-based): 1s, 2s, 4s ... capped. */
export function nextReconnectDelay(attempt, { base = 1000, max = 30000 } = {}) {
  const exponent = Math.max(0, Math.min(attempt, 30));
  return Math.min(base * 2 ** exponent, max);
}

export function createReconnectingSocket({
  url,
  onOpen,
  onMessage,
  onClose,
  backoff = {},
  log = () => {},
  WebSocketImpl = globalThis.WebSocket,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
}) {
  let socket = null;
  let attempt = 0;
  let timer = null;
  let disposed = false;

  function isOpen() {
    return socket !== null && socket.readyState === OPEN;
  }

  /** Send an object (JSON-encoded) or a string. Returns false when not connected. */
  function send(message) {
    if (!isOpen()) return false;
    socket.send(typeof message === "string" ? message : JSON.stringify(message));
    return true;
  }

  function scheduleReconnect() {
    if (disposed || timer !== null) return;
    const delay = nextReconnectDelay(attempt, backoff);
    attempt += 1;
    timer = setTimeoutImpl(() => {
      timer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (disposed || socket !== null) return;
    let next;
    try {
      next = new WebSocketImpl(url);
    } catch (error) {
      log(`connect to ${url} failed: ${error && error.message ? error.message : error}`);
      scheduleReconnect();
      return;
    }
    socket = next;
    next.onopen = () => {
      attempt = 0;
      if (onOpen) onOpen(api);
    };
    next.onmessage = (event) => {
      const message = parseSocketMessage(event.data);
      if (message && onMessage) onMessage(message, api);
    };
    next.onerror = () => {
      // The browser follows every error with a close event; reconnect happens there.
    };
    next.onclose = () => {
      if (socket === next) socket = null;
      if (disposed) return;
      if (onClose) onClose(api);
      scheduleReconnect();
    };
  }

  function dispose() {
    disposed = true;
    if (timer !== null) {
      clearTimeoutImpl(timer);
      timer = null;
    }
    if (socket !== null) {
      const current = socket;
      socket = null;
      current.onclose = null;
      current.close();
    }
  }

  const api = {
    connect,
    send,
    isOpen,
    dispose,
    get attempt() {
      return attempt;
    },
  };
  return api;
}
