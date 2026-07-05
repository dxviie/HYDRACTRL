import { describe, expect, test } from "bun:test";
import { createSafeStorage } from "./Storage.js";

/** Minimal in-memory implementation of the Web Storage interface. */
function createMemoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
    _map: map,
  };
}

/** Backend whose writes always fail, like a full or disabled localStorage. */
function createThrowingBackend() {
  const backend = createMemoryBackend();
  backend.setItem = () => {
    throw new DOMException("quota exceeded", "QuotaExceededError");
  };
  return backend;
}

describe("createSafeStorage", () => {
  test("get/set/remove round-trip", () => {
    const storage = createSafeStorage({ backend: createMemoryBackend() });

    expect(storage.set("k", "v")).toBe(true);
    expect(storage.get("k")).toBe("v");
    expect(storage.remove("k")).toBe(true);
    expect(storage.get("k")).toBe(null);
  });

  test("get returns fallback for missing keys", () => {
    const storage = createSafeStorage({ backend: createMemoryBackend() });
    expect(storage.get("missing", "default")).toBe("default");
  });

  test("set coerces values to strings like localStorage does", () => {
    const storage = createSafeStorage({ backend: createMemoryBackend() });
    storage.set("n", 42);
    storage.set("b", true);
    expect(storage.get("n")).toBe("42");
    expect(storage.get("b")).toBe("true");
  });

  test("write failure returns false and reports instead of throwing", () => {
    let reportedKey = null;
    const storage = createSafeStorage({
      backend: createThrowingBackend(),
      onWriteError: (_error, key) => {
        reportedKey = key;
      },
    });

    expect(() => storage.set("k", "v")).not.toThrow();
    expect(storage.set("k", "v")).toBe(false);
    expect(reportedKey).toBe("k");
  });

  test("getJSON/setJSON round-trip objects", () => {
    const storage = createSafeStorage({ backend: createMemoryBackend() });
    const value = { banks: [1, 2, 3], name: "live-set" };

    expect(storage.setJSON("cfg", value)).toBe(true);
    expect(storage.getJSON("cfg")).toEqual(value);
  });

  test("getJSON returns fallback for corrupt data", () => {
    const backend = createMemoryBackend();
    backend.setItem("cfg", "{not json");
    const storage = createSafeStorage({ backend });

    expect(storage.getJSON("cfg", { ok: true })).toEqual({ ok: true });
  });

  test("setJSON returns false for unserializable values", () => {
    const storage = createSafeStorage({ backend: createMemoryBackend() });
    const circular = {};
    circular.self = circular;
    expect(storage.setJSON("cfg", circular)).toBe(false);
  });

  test("keys filters by prefix", () => {
    const storage = createSafeStorage({ backend: createMemoryBackend() });
    storage.set("hydractrl-slot-1", "a");
    storage.set("hydractrl-slot-2", "b");
    storage.set("other", "c");

    expect(storage.keys("hydractrl-slot-").sort()).toEqual([
      "hydractrl-slot-1",
      "hydractrl-slot-2",
    ]);
    expect(storage.keys().length).toBe(3);
  });

  test("works degraded without any backend", () => {
    const storage = createSafeStorage({ backend: null });
    // In non-browser environments there is no localStorage at all;
    // every operation must still be safe to call.
    expect(storage.isAvailable()).toBe(false);
    expect(storage.get("k", "fallback")).toBe("fallback");
    expect(storage.set("k", "v")).toBe(false);
    expect(storage.remove("k")).toBe(false);
    expect(storage.keys()).toEqual([]);
  });

  test("isAvailable reflects backend health", () => {
    expect(createSafeStorage({ backend: createMemoryBackend() }).isAvailable()).toBe(true);
    expect(createSafeStorage({ backend: createThrowingBackend() }).isAvailable()).toBe(false);
  });
});
