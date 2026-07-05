/**
 * PluginHost - lightweight plugin system for HYDRACTRL.
 *
 * A plugin is a plain object:
 *
 *   {
 *     id: "my-plugin",            // required, unique
 *     name: "My Plugin",          // optional, for display
 *     description: "...",         // optional
 *     setup(ctx) { ... },         // called once when the host initializes
 *                                 // (or immediately when registered after init).
 *                                 // May return a cleanup function or an API object:
 *                                 //   return { api: {...}, dispose() {...} }
 *   }
 *
 * `ctx` is the shared application context assembled in index.js:
 *   { hydra, editor, runCode, events, storage, notify, getPanels() }
 *
 * Design goals:
 *  - Error isolation: a plugin that throws during setup or teardown is
 *    disabled and logged, but never breaks the app or other plugins.
 *  - No load-order coupling: plugins talk to each other through ctx.events.
 */
export function createPluginHost(ctx) {
  if (!ctx || typeof ctx !== "object") {
    throw new TypeError("createPluginHost requires a context object");
  }

  // Map<id, { plugin, status, api, dispose, error }>
  const registry = new Map();
  let initialized = false;

  function validate(plugin) {
    if (!plugin || typeof plugin !== "object") {
      return "plugin must be an object";
    }
    if (typeof plugin.id !== "string" || plugin.id.length === 0) {
      return "plugin.id must be a non-empty string";
    }
    if (registry.has(plugin.id)) {
      return `duplicate plugin id "${plugin.id}"`;
    }
    if (typeof plugin.setup !== "function") {
      return "plugin.setup must be a function";
    }
    return null;
  }

  function runSetup(entry) {
    const { plugin } = entry;
    try {
      const result = plugin.setup(ctx);
      if (typeof result === "function") {
        entry.dispose = result;
      } else if (result && typeof result === "object") {
        entry.api = result.api || null;
        entry.dispose = typeof result.dispose === "function" ? result.dispose : null;
      }
      entry.status = "active";
      ctx.events?.emit("plugin:activated", { id: plugin.id });
    } catch (error) {
      entry.status = "error";
      entry.error = error;
      console.error(`PluginHost: plugin "${plugin.id}" failed during setup:`, error);
      ctx.events?.emit("plugin:error", { id: plugin.id, error });
    }
  }

  /**
   * Register a plugin. If the host is already initialized the plugin is
   * set up immediately; otherwise setup is deferred until init().
   * @returns {boolean} true if the plugin was accepted.
   */
  function register(plugin) {
    const problem = validate(plugin);
    if (problem) {
      console.error(`PluginHost: rejected plugin: ${problem}`);
      return false;
    }
    const entry = { plugin, status: "registered", api: null, dispose: null, error: null };
    registry.set(plugin.id, entry);
    if (initialized) {
      runSetup(entry);
    }
    return true;
  }

  /** Set up all registered plugins. Safe to call once. */
  function init() {
    if (initialized) return;
    initialized = true;
    for (const entry of registry.values()) {
      if (entry.status === "registered") {
        runSetup(entry);
      }
    }
    ctx.events?.emit("plugins:ready", { ids: [...registry.keys()] });
  }

  /** Tear down and remove a plugin. @returns {boolean} */
  function unregister(id) {
    const entry = registry.get(id);
    if (!entry) return false;
    if (entry.dispose) {
      try {
        entry.dispose();
      } catch (error) {
        console.error(`PluginHost: plugin "${id}" failed during teardown:`, error);
      }
    }
    registry.delete(id);
    ctx.events?.emit("plugin:removed", { id });
    return true;
  }

  /** Public API object returned by a plugin's setup, if any. */
  function getApi(id) {
    return registry.get(id)?.api || null;
  }

  /** Status of one plugin: "registered" | "active" | "error" | null. */
  function getStatus(id) {
    return registry.get(id)?.status || null;
  }

  /** Snapshot of all plugins for diagnostics. */
  function list() {
    return [...registry.values()].map((entry) => ({
      id: entry.plugin.id,
      name: entry.plugin.name || entry.plugin.id,
      description: entry.plugin.description || "",
      status: entry.status,
    }));
  }

  return { register, unregister, init, getApi, getStatus, list };
}
