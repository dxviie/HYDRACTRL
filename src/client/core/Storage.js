/**
 * Storage - a safe wrapper around localStorage.
 *
 * Every direct localStorage call can throw: quota exceeded (thumbnails add up
 * fast), privacy mode, or disabled storage. During a live set an unhandled
 * QuotaExceededError must never take the app down, so all operations here are
 * guarded and report failures through their return values instead of throwing.
 */

/**
 * @param {object} [options]
 * @param {Storage} [options.backend] - Storage backend, defaults to window.localStorage.
 *   Injectable for tests and non-browser environments.
 * @param {(error: Error, key: string) => void} [options.onWriteError] - Called when a
 *   write fails even after quota recovery was attempted.
 */
export function createSafeStorage(options = {}) {
  const backend = options.backend || (typeof localStorage !== "undefined" ? localStorage : null);
  const onWriteError = options.onWriteError || (() => {});

  function isAvailable() {
    if (!backend) return false;
    try {
      const probe = "__hydractrl_probe__";
      backend.setItem(probe, "1");
      backend.removeItem(probe);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /** @returns {string|null} */
  function get(key, fallback = null) {
    if (!backend) return fallback;
    try {
      const value = backend.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      console.warn(`Storage: failed to read "${key}":`, error);
      return fallback;
    }
  }

  /** @returns {boolean} true if the write succeeded */
  function set(key, value) {
    if (!backend) return false;
    try {
      backend.setItem(key, String(value));
      return true;
    } catch (error) {
      console.warn(`Storage: failed to write "${key}":`, error);
      onWriteError(error, key);
      return false;
    }
  }

  function remove(key) {
    if (!backend) return false;
    try {
      backend.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Storage: failed to remove "${key}":`, error);
      return false;
    }
  }

  /** Read and JSON-parse a value. Returns fallback on missing or corrupt data. */
  function getJSON(key, fallback = null) {
    const raw = get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Storage: corrupt JSON in "${key}", using fallback:`, error);
      return fallback;
    }
  }

  /** JSON-stringify and store a value. @returns {boolean} */
  function setJSON(key, value) {
    try {
      return set(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Storage: failed to serialize "${key}":`, error);
      return false;
    }
  }

  /** All keys, optionally filtered by prefix. Never throws. */
  function keys(prefix = "") {
    if (!backend) return [];
    try {
      const result = [];
      for (let i = 0; i < backend.length; i++) {
        const key = backend.key(i);
        if (key !== null && key.startsWith(prefix)) {
          result.push(key);
        }
      }
      return result;
    } catch (error) {
      console.warn("Storage: failed to enumerate keys:", error);
      return [];
    }
  }

  return { get, set, remove, getJSON, setJSON, keys, isAvailable };
}
