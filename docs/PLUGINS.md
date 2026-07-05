# HYDRACTRL Plugin System

HYDRACTRL has a small plugin system so new features can be added without
touching (or breaking) the core. The two first features built on it are
URL sketch sharing (`src/client/plugins/UrlSharePlugin.js`) and the audio
watchdog (`src/client/plugins/AudioWatchdogPlugin.js`) — read them as
reference implementations.

## Anatomy of a plugin

A plugin is a plain object with an `id` and a `setup` function:

```js
export function createMyPlugin() {
  return {
    id: "my-plugin",              // required, unique
    name: "My Plugin",            // optional, shown in diagnostics
    description: "What it does",  // optional

    setup(ctx) {
      // Wire up your feature here. Runs once when the app initializes.
      const onKeyDown = (e) => { /* ... */ };
      document.addEventListener("keydown", onKeyDown);

      // Optionally return an API and/or cleanup:
      return {
        api: { doSomething() { /* ... */ } },
        dispose() {
          document.removeEventListener("keydown", onKeyDown);
        },
      };
      // (returning just a function is also supported — it's treated as dispose)
    },
  };
}
```

## The context object (`ctx`)

`setup` receives a shared application context:

| Field | Description |
| --- | --- |
| `hydra` | The main hydra-synth instance. |
| `editor` | The editor proxy (`editor.state.doc.toString()` reads the code, `editor.dispatch({changes: {insert}})` replaces it, `editor.focus()`). |
| `runCode()` | Run the current editor code on the main and breakout instances. |
| `events` | App-wide event bus: `on(event, fn)`, `once`, `off`, `emit(event, payload)`. |
| `storage` | Quota-safe localStorage wrapper: `get`, `set`, `remove`, `getJSON`, `setJSON`, `keys(prefix)`. Never throws. |
| `notify(msg, {type, duration})` | Toast notifications (`type`: `"info"`, `"success"`, `"error"`). |
| `getPanels()` | Returns `{ stats, slots, doc, xyPad }` panel objects (may contain `undefined` on mobile). |

## Events you can listen to

| Event | Payload | Emitted when |
| --- | --- | --- |
| `plugins:ready` | `{ ids }` | All plugins finished setup. |
| `plugin:activated` / `plugin:error` / `plugin:removed` | `{ id, ... }` | Plugin lifecycle changes. |
| `ui:visibility` | `{ visible }` | The UI is hidden/shown (Ctrl/⌘+`, Esc). |
| `sketch:shared` | `{ url }` | A sketch link was copied (URL share plugin). |
| `sketch:loaded-from-url` | `{}` | A sketch was loaded from a `#sketch=` URL. |
| `audio:suspended` / `audio:flatline` / `audio:recovered` | `{ at }` | Audio watchdog state changes. |

Emit your own namespaced events (`"my-plugin:thing-happened"`) to let other
plugins integrate with yours.

## Registering a plugin

Built-in plugins are registered in `src/client/index.js`:

```js
pluginHost.register(createMyPlugin());
```

At runtime (browser console, userscripts, external integrations) you can use
the public hook:

```js
window.hydractrl.registerPlugin({
  id: "console-experiment",
  setup(ctx) {
    ctx.events.on("sketch:shared", ({ url }) => console.log("shared:", url));
  },
});

window.hydractrl.plugins.list();   // inspect plugin status
```

Plugins registered after startup are set up immediately.

## Rules of the road

- **Fail safe.** The host isolates plugins: if your `setup` throws, your plugin
  is disabled and logged but the app keeps running. Don't rely on that —
  guard your own async callbacks and intervals.
- **Clean up.** Return a `dispose` that removes listeners and timers, so the
  plugin can be unregistered cleanly.
- **Prefer `ctx` over globals.** `window.slotsPanel` & co. still exist for
  legacy reasons, but new code should use `ctx.getPanels()` / `ctx.storage` /
  `ctx.events`.
- **Keep it low-latency.** This is a live-performance tool; avoid heavy work
  on keystroke or animation paths.
- **Test the pure parts.** Export pure helpers separately from `setup` and
  cover them with `bun test` (see `UrlSharePlugin.test.js`).
