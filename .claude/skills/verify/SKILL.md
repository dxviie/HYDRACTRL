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
bun run build          # bundles src/client -> public/assets/, src/site -> public/site/
bun src/index.ts &     # serves on http://localhost:3000
```

The interface is at `/` (and `/app`); the hosted site's landing page is at
`/index.html` locally. On the landing page, `#backdrop` gets the class
`is-ready` once the hydra background renders, and `#now-playing` shows the
current background sketch with a link that opens it in the app. The GitHub
API call for the latest release fails in the sandbox unless the browser
context ignores HTTPS errors (the egress proxy re-signs TLS); the download
links keep their static `releases/latest/download/...` targets either way.
Headless Chromium here has no H.264, so the feature videos stay blank.

## Drive it (headless Chromium + playwright-core)

Install `playwright-core` in a scratch dir and launch the pre-installed
browser with software WebGL (hydra needs WebGL):

```js
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
```

- **Desktop session:** viewport ≥ 1280×800, no touch. **Phone session:** a
  Playwright phone profile (`devices["iPhone 13"]`): the app branches hard on
  `isPhone()`, a coarse pointer with a screen under 600px on its short side.
  **Tablet session:** `devices["iPad (gen 7)"]`, or `hasTouch` + `isMobile`
  with a Mac UA as iPadOS sends: the full interface, driven by touch, minus
  the system panel's MIDI controls and breakout window (`isTablet()`).
- Drive touch drags with CDP `Input.dispatchTouchEvent` (touchStart,
  touchMove…, touchEnd) through `context.newCDPSession(page)`; Playwright
  itself only taps. `page.evaluate` counts as a user gesture, so set up
  anything that must happen without one in `page.addInitScript`.
- Wait ~2.5s after `goto` — init is async (hydra, panels, plugins).

## Flows worth driving

- `window.hydractrl.plugins.list()` — every built-in plugin should be
  `status: "active"` (a plugin that threw during setup shows `"error"`).
- Info panel appears on startup; close via its `×` button.
- Auto-run: `Ctrl+Y` toggles `#auto-run-checkbox` and persists
  `hydractrl-auto-run`; typing in `.cm-content` triggers a run ~250ms later.
- URL share: `Alt+U` puts a `#sketch=` URL on the clipboard (grant
  `clipboard-read`/`clipboard-write` on the context).
- Breakout: pick a size in `window.statsPanel.display.sizeSelect` (a
  `<select>`, HD 1280×720 unless `hydractrl-breakout-size` says otherwise),
  click `breakoutButton` (Open/Close), expect a popup +
  `window.breakoutHydra`. Changing the size while it's open resizes it.
- Slots panel: dragging `.slots-resize-grip` sets the panel's width; the
  slots stay square, 40 to 100px (349 to 829px wide), and the width persists.
- Feedback: the About panel's `.info-feedback-button` (or
  `window.showFeedbackPanel()`) opens `#feedback-panel` with a sandboxed
  tally.so frame. The sandbox can't reach tally.so, so route
  `https://tally.so/**` to a stand-in page that posts
  `parent.postMessage(JSON.stringify({ event: "Tally.FormLoaded" }), "*")`
  (and `Tally.FormSubmitted` to test the thank-you toast and auto-close).
- Slot advance: enable `moveToNextSlotCheckbox`, call
  `slotsPanel.saveToActiveSlot()` + `window.moveToNextSlot(info)`, active
  slot moves after ~500ms.
- Code overlay: `Control+Backquote` hides the UI, a second press shows
  `#hydra-canvas .hydractrl-code-overlay` (and on any open `/output` page:
  `window.hydractrlOutput.codeOverlay()`), a third brings the UI back. The
  system panel's CODE OVERLAY section (expand with `.stats-toggle`) has
  `#code-overlay-visible`, `#code-overlay-slots`, `.code-overlay-blend` and
  `.code-overlay-opacity`, kept in `hydractrl-code-overlay`. With it on, an
  `/output` page follows typing: `.hco-tag` has `hco-running` or `hco-edited`, edited
  lines get `.hco-changed`, `.hco-caret` is the cursor, Ctrl+Enter adds
  `.hco-flash` for 160ms, and `.hco-slots` shows the scenes and slots. Keep
  the interface page in front while typing (`page.bringToFront()`): Chromium
  runs a background tab's timers once a second, which slows the updates.
- MIDI without a device: in `addInitScript`, replace
  `navigator.requestMIDIAccess` with one resolving to
  `{ inputs: new Map([[id, input]]), outputs: new Map() }`, where `input` is
  `{ id, name: "nanoPAD2 PAD", type: "input", state: "connected", onmidimessage: null }`,
  then call `input.onmidimessage({ data: new Uint8Array(bytes) })`. Pads are
  note-ons, notes 36 to 51 on scene 1, 52 to 67 on scene 2 and so on; the
  scene button is the SysEx `[240, 66, 64, 0, 1, 18, 0, 95, 79, scene, 247]`
  (scene 0 to 3). Check `slotsPanel.getBank()` and `getActiveSlotIndex()`.
- Touch: panels drag by their title bars, the editor, doc and slots panels
  resize by the grip in their corner, and with the UI hidden (`body.ui-hidden`) a tap
  anywhere brings it back without clicking what reappears under the finger.

## Gotchas

- The info panel is `position: fixed` — `offsetParent` is always `null`;
  check `style.display` / screenshots instead of `offsetParent`.
- FPS is single digits under swiftshader; that's the environment, not a bug.
- Breaking the editor code (even with a stray comment mid-expression) makes
  every later run/save/breakout log "Error running Hydra code" — that's the
  app's own error notification path, not a crash.
- Console shows "Hydra code executed successfully" after each good run —
  handy signal for auto-run checks.
