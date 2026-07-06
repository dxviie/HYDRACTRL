---
name: verify
description: Build, launch and drive HYDRACTRL in headless Chromium to verify changes end-to-end.
---

# Verifying HYDRACTRL changes

HYDRACTRL is a browser GUI (hydra-synth live-coding tool) served by an
Elysia server. Verification means loading it in a real browser and driving
the UI — not running `bun test`.

## Build & launch

```bash
bun install
bun run build          # bundles src/client/index.js -> public/assets/
bun src/index.ts &     # serves on http://localhost:3000
```

## Drive it (headless Chromium + playwright-core)

Install `playwright-core` in a scratch dir and launch the pre-installed
browser with software WebGL (hydra needs WebGL):

```js
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
```

- **Desktop session:** viewport ≥ 1280×800, no touch. **Mobile session:**
  small viewport + `hasTouch: true` + mobile UA (the app branches hard on
  `isMobileOrTablet()`).
- Wait ~2.5s after `goto` — init is async (hydra, panels, plugins).

## Flows worth driving

- `window.hydractrl.plugins.list()` — every built-in plugin should be
  `status: "active"` (a plugin that threw during setup shows `"error"`).
- Info panel appears on startup; close via its `×` button.
- Auto-run: `Ctrl+Y` toggles `#auto-run-checkbox` and persists
  `hydractrl-auto-run`; typing in `.cm-content` triggers a run ~250ms later.
- URL share: `Alt+U` puts a `#sketch=` URL on the clipboard (grant
  `clipboard-read`/`clipboard-write` on the context).
- Breakout: pick a size via `window.statsPanel.display.sizeButtons`, click
  `breakoutButton`, expect a popup + `window.breakoutHydra`.
- Slot advance: enable `moveToNextSlotCheckbox`, call
  `slotsPanel.saveToActiveSlot()` + `window.moveToNextSlot(info)`, active
  slot moves after ~500ms.

## Gotchas

- The info panel is `position: fixed` — `offsetParent` is always `null`;
  check `style.display` / screenshots instead of `offsetParent`.
- FPS is single digits under swiftshader; that's the environment, not a bug.
- Breaking the editor code (even with a stray comment mid-expression) makes
  every later run/save/breakout log "Error running Hydra code" — that's the
  app's own error notification path, not a crash.
- Console shows "Hydra code executed successfully" after each good run —
  handy signal for auto-run checks.
