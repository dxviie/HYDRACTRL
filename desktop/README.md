# HYDRACTRL Desktop

The standalone HYDRACTRL app: the full live-coding interface plus a
**Syphon** (macOS) or **Spout** (Windows) output of your visuals, in one
package. Open it, and your set shows up as a video source in Resolume,
MadMapper, VDMX, TouchDesigner, OBS and anything else that speaks Syphon or
Spout, with zero GPU copies and no latency worth mentioning.

Verified on a Mac Studio M4 Max at 1080p and 4K, steady 60 fps into Resolume.

## How it works

The app is an Electron shell around the regular HYDRACTRL server:

- It starts the bundled HYDRACTRL server (the same single-file Bun binary
  `bun run build:exe` produces) and shows the interface in its window.
- It renders the chrome-less `/output` page in a second, offscreen window
  using Electron's GPU shared-texture mode, and
  [texture-bridge](https://github.com/naporin0624/electron-texture-bridge)
  publishes every frame as a Syphon server or Spout sender.
- The output page follows the interface live over the server's WebSocket:
  every run, slot change and XY-pad move is mirrored, and audio reactivity
  (`a.fft`) uses the app's own microphone input.

Everything the web version does still works: MIDI, the breakout window,
`s0.initCam()`, `s0.initScreen()`, local assets served from the same server.

## Install and run

Download the build for your machine from the project's releases, or build it
yourself (below). Unsigned builds show a security prompt the first time: on
macOS right-click the app and choose Open, on Windows choose "More info" and
"Run anyway".

On first launch macOS asks for microphone access. Allow it, or audio-reactive
sketches stay silent. The output starts automatically and a source called
`HYDRACTRL` appears in your VJ software. The stats panel in the interface
shows the output state and live frame rate, with a Start/Stop button and a
shortcut to the settings.

### Output menu and settings

The **Output** menu (and the settings window, `Cmd/Ctrl+,`) controls:

| Setting | Notes |
| --- | --- |
| Start / Stop Output | `Cmd/Ctrl+Shift+O`. Also restarts on demand. |
| Resolution | 720p, 1080p, 1440p, 4K or a custom size. Applied live. |
| Frame rate | 24 to 120 fps. Changing it restarts the output. |
| Sender name | The name other apps see. Changing it restarts the output. |
| Preview window | A window with the exact frames being shared. Off by default. |
| Include alpha | Per-pixel alpha for overlay compositing. Off by default. |
| Start output at launch | On by default. |
| Allow network access | Lets OBS or TouchDesigner on another computer reach the server and its `/output` page. Off by default; applies on the next launch. |

Settings live in the app's data folder (`Application Support/HYDRACTRL` on
macOS, `%APPDATA%\HYDRACTRL` on Windows) next to the log file, which the
settings window and the Help menu can open for you.

### Things to know

- **Your banks live in the app.** The desktop app has its own browser storage,
  separate from Chrome or Safari. Move scenes over with the bank export and
  import (`Alt/⌥+X` and `Alt/⌥+I`).
- **The server is local by default.** It listens on `127.0.0.1` on port 3000,
  or the next free port if 3000 is taken by something else; the settings
  window shows the address. Sketches can still load local assets from
  `http://localhost:3000/...` as documented in the main README.
- **A running `bun dev` is reused.** In a repository checkout the app attaches
  to a server that is already running on port 3000 instead of starting its
  own, which is handy while developing.
- **Display sleep is blocked** while the output runs.
- **Linux** runs the interface but has no shared output: neither Syphon nor
  Spout exist there.

## Develop

Requirements: [Bun](https://bun.sh/) and, on macOS or Windows, nothing else.
The native texture-sharing module ships prebuilt for macOS (Apple Silicon and
Intel) and Windows x64.

```bash
# from the repository root
bun install
cd desktop
bun install          # downloads Electron; if the binary is missing afterwards, run: node node_modules/electron/install.js
bun run start        # builds the client, starts the server with Bun's watcher, opens the app
```

`bun test` at the repository root runs the desktop unit tests too; `bun run
lint` covers `desktop/src` and `desktop/scripts`.

`bun run smoke` launches a directory build (`bun run pack` first, or
`--dev` for the checkout), drives it through the main process's inspector
and checks startup, the server, the interface plugins, the output controls,
the settings window, persistence, menu sync and a clean shutdown. On macOS
and Windows it also starts and stops the real Syphon/Spout output. On a
headless Linux machine run it as `xvfb-run -a node scripts/smoke.mjs --software-gl`.

### Layout

```
desktop/
  src/main/        Electron main process
    index.js         wiring: single instance, lifecycle, IPC, menu, broadcast
    server.js        find or spawn the HYDRACTRL server, restart with backoff
    output.js        Syphon/Spout bridge lifecycle and status
    settings.js      defaults, validation, atomic JSON store
    security.js      permissions, navigation and popup policy
    windows.js       main + settings windows, bounds persistence, crash recovery
    menu.js          application menu template
    config.js        dev vs packaged paths and server command
    log.js           rotating file logger
  src/preload/     the window.hydractrlDesktop bridge (sandboxed)
  src/renderer/    loading screen and settings window
  scripts/         server compile + electron-builder hook
  resources/       icon and macOS entitlements
```

## Package

```bash
cd desktop
bun run dist:mac     # on macOS: DMG + ZIP for the current architecture
bun run dist:win     # on Windows: NSIS installer
bun run pack         # unpacked directory build for a quick check
```

Packaging compiles the server for the target platform with
`bun build --compile` (see `scripts/build-server.mjs`), stages it with the web
assets under `resources/server` inside the app, and keeps the native
texture-sharing module outside the asar. Intel and Apple Silicon are separate
builds (`--x64` / `--arm64`); universal binaries are not supported.

Builds are unsigned by default. To sign and notarize on macOS, provide a
Developer ID certificate through `CSC_LINK` / `CSC_KEY_PASSWORD` and Apple
credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`), then
run `bunx electron-builder --mac -c.mac.notarize=true`. The entitlements in
`resources/` already allow JIT for Electron and the Bun server, and
microphone and camera access.

The `Desktop app` GitHub Actions workflow builds all three targets on demand
and for `desktop-v*` tags, and uploads the DMG, ZIP and installer as artifacts.

## Roadmap

- **NDI output**, next to Syphon and Spout, through a CPU readback of the same
  frames.
- **Windows verification**: the Spout path uses the same code as Syphon but
  has not been exercised on real hardware yet.
