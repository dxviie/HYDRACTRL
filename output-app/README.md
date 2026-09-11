# HYDRACTRL output spike

Phase 0 of the companion output app. Electron renders a HYDRACTRL page
offscreen in GPU shared-texture mode, and
[texture-bridge](https://github.com/naporin0624/electron-texture-bridge)
publishes every frame as a **Syphon** server (macOS) or **Spout** sender
(Windows) with zero GPU copies. Nothing in HYDRACTRL itself changes: the page
is loaded from the running Bun server and the sketch travels in the URL
fragment, exactly like an `Alt/⌥+U` share link.

The spike answers three questions on your machine:

1. Does shared-texture offscreen rendering work on your GPU at 60 fps?
2. Does hydra's WebGL render correctly offscreen, including `a.fft` audio input?
3. Does the picture arrive in your VJ software as a Syphon/Spout source?

NDI is not part of this phase (it needs a CPU readback, see "Next steps").

## Requirements

- macOS 11+ (Apple Silicon or Intel) or Windows 10+ x64. The native addon
  ships prebuilt for exactly these, so no Xcode, Rust or Visual Studio needed.
- [Bun](https://bun.sh/), or Node 22+ with npm.
- HYDRACTRL running: `bun dev` from the repository root (serves
  `http://localhost:3000`).
- A receiver to look at the output:
  - macOS: [Syphon Simple Client](https://github.com/Syphon/Simple/releases),
    OBS ("Syphon Client" source), MadMapper, Resolume, VDMX.
  - Windows: `SpoutReceiver.exe` from the
    [Spout demo programs](https://github.com/leadedge/Spout2/releases),
    Resolume, TouchDesigner (Syphon Spout In TOP), OBS with the Off World Live
    Spout plugin.

## Run it

```bash
cd output-app
bun install                                  # or: npm install
SKETCH_FILE=sketches/demo.js bun run start   # or: npm start
```

Windows PowerShell:

```powershell
$env:SKETCH_FILE = "sketches\demo.js"; bun run start
```

`bun install` runs Electron's binary download because `electron` is listed in
`trustedDependencies`. If that download fails under Bun, use `npm install`
instead; the rest is identical.

On first launch macOS asks for microphone access for "Electron". Allow it, or
`a.fft` stays at zero.

## What you should see

- A preview window showing the sketch (the bridge's own GPU-forwarded preview,
  independent of Syphon/Spout).
- Console lines like `[output] fps 60.0` once a second and no
  `frame dropped` lines.
- A source called `HYDRACTRL` in your receiver, showing the same frames.

Then push it: set `OUTPUT_WIDTH=3840 OUTPUT_HEIGHT=2160` and check the fps
line again, and make noise near the mic to confirm the audio modulation.

## Configuration

Everything is an environment variable.

| Variable | Default | Meaning |
| --- | --- | --- |
| `HYDRACTRL_URL` | `http://localhost:3000/` | Page to render. Any hydra page works. |
| `SKETCH_FILE` | none | File whose code is encoded into `#sketch=`; without it the page loads its own saved state. |
| `OUTPUT_NAME` | `HYDRACTRL` | Syphon/Spout sender name. |
| `OUTPUT_WIDTH`, `OUTPUT_HEIGHT` | `1920`, `1080` | Texture size in pixels. |
| `OUTPUT_FPS` | `60` | Target frame rate. |
| `PREVIEW` | `1` | `0` disables the preview window. |
| `HIDE_UI` | `1` | `0` keeps HYDRACTRL's editor and panels visible in the output. |
| `INCLUDE_ALPHA` | `0` | `1` forwards per-pixel alpha. HYDRACTRL's page has a black background, so leave this off for now. |

## How it works

- `main.js` builds the page URL, then calls `createTextureBridge`, which creates
  the offscreen `BrowserWindow` with `offscreen: { useSharedTexture: true }`,
  listens to `paint` events, hands each frame's IOSurface (macOS) or D3D11
  handle (Windows) to the native sender and releases it.
- `preload.cjs` runs before HYDRACTRL's scripts and sets the app's own
  `localStorage` preferences so the UI and the startup info panel stay hidden.
  The chrome-less `/output` route planned for phase 1 replaces this.

## Known caveats

- The Electron profile keeps its own `localStorage`, separate from your
  browser. Banks saved there are not your browser's banks.
- Frames are only produced when the page repaints. hydra redraws every frame,
  so output is continuous; `backgroundThrottling` is disabled as a guard.
- On Windows the Spout receiver must run on the same GPU as this app.
- Electron's shared-texture API is still marked experimental; the Electron
  version is pinned on purpose.
- Linux is not covered by the prebuilt addon, so this spike is macOS/Windows
  only.

## Next steps

- **Phase 1**: a chrome-less `/output` route in HYDRACTRL plus a WebSocket
  that pushes the current sketch and XY-pad values from the main UI, so this
  app follows what you play live instead of a fixed sketch.
- **Phase 2**: NDI through a second, bitmap-mode offscreen window feeding
  [grandi](https://github.com/tux-tn/grandi), later replaced by Electron's
  shared-texture import to avoid rendering twice.
- **Phase 3**: packaging with electron-builder (asar unpack for the native
  addon, Syphon.framework code signing) and a small settings UI.
