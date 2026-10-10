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
- Every sketch renders once, on that output, and the interface shows the
  output's own frames: the app forwards each frame it shares to the
  interface window, zero-copy, where it is drawn in place of the interface's
  own hydra canvas, letterboxed to the output's shape. What you see is what
  your VJ software gets. The interface's hydra instance rests meanwhile.
- Sketches run on the output itself (`/output?primary`), which answers with
  the result over the server's WebSocket, so errors still show in the
  editor. A sketch with an error never reaches the output: it keeps playing
  the last sketch that worked. Slot changes and XY-pad moves follow the same
  way, and audio reactivity (`a.fft`) uses the app's own microphone input.
- When the output is stopped or restarting, or its frames stop coming, the
  interface renders on its own again with the last sketch that worked, and
  switches back once the output runs.

Everything the web version does still works: MIDI, the breakout window,
`s0.initCam()`, `s0.initScreen()`, local assets served from the same server.

## Install and run

Download the build for your machine from
[hydractrl.d17e.dev](https://hydractrl.d17e.dev/#download) or the
[releases page](https://github.com/dxviie/HYDRACTRL/releases/latest), or build
it yourself (below):

| Computer | File |
| --- | --- |
| Mac with Apple Silicon (M1 and later) | `HYDRACTRL-mac-arm64.dmg` |
| Mac with an Intel processor | `HYDRACTRL-mac-x64.dmg` |
| Windows 10 or 11, 64-bit | `HYDRACTRL-win-x64-setup.exe` |

The builds aren't signed with an Apple or Windows certificate yet, so the
first launch needs one confirmation:

- **macOS**: drag HYDRACTRL into Applications and open it. When macOS says it
  can't verify the app, open System Settings → Privacy & Security, scroll down
  and click *Open Anyway*.
- **Windows**: when SmartScreen warns about an unrecognized app, click
  *More info*, then *Run anyway*.

To update, install the new version over the old one; settings and scenes
stay. The app's version is in its About box and in the interface's About
panel, and it matches the browser version's: see the
[changelog](../CHANGELOG.md).

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

### Images and videos

Drop an image or a video on the editor to use it in a sketch. HYDRACTRL
copies the file into its media folder and adds a line that loads it into the
first free source:

```js
s1.initVideo("/media/clip.mp4");
```

The line goes where you drop the file, or above the chain you drop it on.
An empty sketch also gets `src(s0).out()`, so `Ctrl/⌘+Enter` shows the file
right away. Drop several files and each gets its own line and source.

Images can be PNG, JPG, GIF, WebP, AVIF, BMP or SVG, and videos MP4, MOV,
M4V, WebM or OGV. A video also needs a codec Chrome plays, such as H.264 or
VP9. ProRes doesn't play.

The media folder is `media` in the app's data folder until you choose
another one in the settings window, and **File → Show Media Folder** opens
it. A file you drop from inside the folder stays where it is, so a folder of
clips you already keep can be the media folder. Dropping the same file twice
reuses the first copy.

The app's server serves the folder at `/media/` to the interface, the
Syphon or Spout output and any `/output` page. When you choose another
folder, the server switches to it straight away, so move over the files your
sketches still use. A sketch holds only the file's address. A shared link or
an exported bank shows the image or video only on a computer with the same
file in its media folder.

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
  own, which is handy while developing. That server has no media folder, so
  the app turns down dropped files until you stop it.
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
a file dropped on the editor, the media folder, the settings window,
persistence, menu sync and a clean shutdown. On macOS
and Windows it also starts and stops the real Syphon/Spout output. On a
headless Linux machine run it as `xvfb-run -a node scripts/smoke.mjs --software-gl`.

### Layout

```
desktop/
  src/main/        Electron main process
    index.js         wiring: single instance, lifecycle, IPC, menu, broadcast
    server.js        find or spawn the HYDRACTRL server, restart with backoff
    output.js        Syphon/Spout bridge lifecycle and status
    media.js         copy dropped images and videos into the media folder
    settings.js      defaults, validation, atomic JSON store
    security.js      permissions, navigation and popup policy
    windows.js       main + settings windows, bounds persistence, crash recovery
    menu.js          application menu template
    config.js        dev vs packaged paths and server command
    log.js           rotating file logger
  src/preload/     the window.hydractrlDesktop bridge (sandboxed)
  src/renderer/    loading screen and settings window
  scripts/         server compile + electron-builder hooks
  resources/       icon and macOS entitlements
```

## Package

```bash
cd desktop
bun run dist:mac     # on macOS: a DMG for the current architecture
bun run dist:win     # on Windows: NSIS installer
bun run pack         # unpacked directory build for a quick check
```

Packaging compiles the server for the target platform with
`bun build --compile` (see `scripts/build-server.mjs`), stages it with the web
assets under `resources/server` inside the app, and keeps the native
texture-sharing module outside the asar. Intel and Apple Silicon are separate
builds (`--x64` / `--arm64`); universal binaries are not supported.

The output files carry no version (`HYDRACTRL-mac-arm64.dmg`,
`HYDRACTRL-win-x64-setup.exe`, ...) so the website can link to
`releases/latest/download/<file>`; keep `src/site/downloads.js` in step if you
change `artifactName` (a test checks it).

Builds are unsigned by default. To sign on macOS, provide a Developer ID
certificate through `CSC_LINK` / `CSC_KEY_PASSWORD`; the build is notarized
when Apple credentials are in the environment too: an App Store Connect API
key (`APPLE_API_KEY`, the path to the `.p8` file, with `APPLE_API_KEY_ID` and
`APPLE_API_ISSUER`) or an Apple ID (`APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Without a certificate, sign ad
hoc with `bunx electron-builder --mac -c.mac.identity=- -c.mac.timestamp=none`:
a build with no signature at all won't open on Apple Silicon once it has been
downloaded. An `afterPack` hook (`scripts/after-pack.cjs`) restores the
symlinks of the Syphon framework that npm flattens, which codesign insists
on. The `afterSign` hook (`scripts/notarize.cjs`) does the notarizing in
place of electron-builder's own: it uploads the signed app, checks on it every
30 seconds, retrying when the network drops, and staples Apple's ticket to the
app before the DMG is built. The
entitlements in `resources/` already allow JIT for Electron and the Bun
server, library validation for the ad-hoc case, and microphone and camera
access.

The `Desktop app` GitHub Actions workflow builds all three targets for pull
requests that touch the app and on demand, and uploads the DMGs and the
installer as artifacts. The `Release` workflow runs it for version tags and
publishes the result as a GitHub release; see [RELEASING.md](../RELEASING.md).

## Roadmap

- **NDI output**, next to Syphon and Spout, through a CPU readback of the same
  frames.
- **Windows verification**: the Spout path uses the same code as Syphon but
  has not been exercised on real hardware yet.
