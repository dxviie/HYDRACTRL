# HYDRACTRL output app

Companion app for HYDRACTRL. Electron renders the chrome-less `/output` page
offscreen in GPU shared-texture mode, and
[texture-bridge](https://github.com/naporin0624/electron-texture-bridge)
publishes every frame as a **Syphon** server (macOS) or **Spout** sender
(Windows) with zero GPU copies. The page follows whatever you play in the
HYDRACTRL UI: every run and the XY-pad values arrive over the server's output
socket, so this app needs no input of its own.

Status: phase 0 (pipeline) and phase 1 (live sync) are done. Verified on a
Mac Studio M4 Max at 1080p and 4K, steady 60 fps into Resolume. NDI is the
next phase (it needs a CPU readback). Windows/Spout has not been tested yet.

## Requirements

- macOS 11+ (Apple Silicon or Intel) or Windows 10+ x64. The native addon
  ships prebuilt for exactly these, so no Xcode, Rust or Visual Studio needed.
- [Bun](https://bun.sh/), or Node 22+ with npm.
- HYDRACTRL running: `bun dev` from the repository root (serves
  `http://localhost:3000`).
- A receiver: Resolume, MadMapper, VDMX, TouchDesigner, OBS (Syphon Client /
  Spout source), or the Syphon Simple Client and SpoutReceiver demo apps.

## Run it

```bash
cd output-app
bun install      # or: npm install
bun run start    # or: npm start
```

`bun install` runs Electron's binary download because `electron` is listed in
`trustedDependencies`. If that download fails under Bun, use `npm install`
instead; the rest is identical.

On first launch macOS asks for microphone access for "Electron". Allow it, or
`a.fft` stays at zero. The app allows audio to start without a click, so the
offscreen page's microphone analysis runs on its own.

## What you should see

- A preview window (the bridge's own GPU-forwarded preview) showing the sketch
  currently running in the HYDRACTRL UI. The UI shows a toast "Output
  connected (1)".
- Run a different sketch, load a slot, or move the XY pad in the UI: the
  output follows.
- Console lines like `[output] fps 60.0` once a second and no `frame dropped`
  lines.
- A source called `HYDRACTRL` in your receiver, showing the same frames.

Until the UI has run a sketch, the output shows a black screen with a small
"waiting for HYDRACTRL" line; it disappears for good after the first sketch.

## Configuration

Everything is an environment variable.

| Variable | Default | Meaning |
| --- | --- | --- |
| `HYDRACTRL_URL` | `http://localhost:3000/output` | Page to render. Any hydra page works. |
| `SKETCH_FILE` | none | File whose code is encoded into `#sketch=` and run on load, before the UI takes over. |
| `OUTPUT_NAME` | `HYDRACTRL` | Syphon/Spout sender name. |
| `OUTPUT_WIDTH`, `OUTPUT_HEIGHT` | `1920`, `1080` | Texture size in pixels. |
| `OUTPUT_FPS` | `60` | Target frame rate. |
| `PREVIEW` | `1` | `0` disables the preview window. |
| `HIDE_UI` | `1` | Only matters when pointing at the main page instead of `/output`: hides the editor and panels there. |
| `INCLUDE_ALPHA` | `0` | `1` forwards per-pixel alpha. The output page has a black background, so leave this off for now. |

Example, 4K:

```bash
OUTPUT_WIDTH=3840 OUTPUT_HEIGHT=2160 bun run start
```

Windows PowerShell:

```powershell
$env:OUTPUT_WIDTH = "3840"; $env:OUTPUT_HEIGHT = "2160"; bun run start
```

## How it works

- `main.js` builds the page URL, then calls `createTextureBridge`, which creates
  the offscreen `BrowserWindow` with `offscreen: { useSharedTexture: true }`,
  listens to `paint` events, hands each frame's IOSurface (macOS) or D3D11
  handle (Windows) to the native sender and releases it.
- The `/output` page (`src/client/output.js` in the main repo) runs its own
  hydra instance and mirrors the UI over `/ws/output`; the server's hub
  (`src/server/outputHub.ts`) replays the current sketch to outputs that
  connect late.
- `preload.cjs` only matters for the main page: it sets the app's own
  `localStorage` preferences so the UI stays hidden there.

## Known caveats

- The Electron profile keeps its own `localStorage`, separate from your
  browser. Nothing from your banks lives there.
- Frames are only produced when the page repaints. hydra redraws every frame,
  so output is continuous; `backgroundThrottling` is disabled as a guard.
- On Windows the Spout receiver must run on the same GPU as this app.
- Electron's shared-texture API is still marked experimental; the Electron
  version is pinned on purpose.
- Linux is not covered by the prebuilt addon, so this app is macOS/Windows
  only.

## Next steps

- **Phase 2**: NDI through a second, bitmap-mode offscreen window feeding
  [grandi](https://github.com/tux-tn/grandi), later replaced by Electron's
  shared-texture import to avoid rendering twice.
- **Phase 3**: packaging with electron-builder (asar unpack for the native
  addon, Syphon.framework code signing) and a small settings UI.
