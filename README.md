![HYDRACTRL screenshot](./docs/assets/hydractrl-preview.jpg)

# HYDRACTRL

A performance wrapper around [hydra](https://hydra.ojack.xyz/) designed for live visual performances — for the moments where you don't necessarily want to be coding.

**[Project page](https://dxviie.github.io/HYDRACTRL/)** · **[Play around](https://hydractrl.d17e.dev)** · **[Plugin docs](./docs/PLUGINS.md)**

## Features

- **Scene management** — store and recall up to 64 scenes (4 banks × 16 slots) with thumbnail previews
- **MIDI integration** — built for the Korg nanoPAD2, including its XY pad with a small physics engine for expressive control (mouse works too)
- **Advanced code editor** — CodeMirror 6 with Hydra syntax highlighting, code completion, multiple themes and error reporting
- **Setup code tab** — code that runs before each sketch, for audio settings and globals
- **Audio reactivity** — Hydra's `a.fft` data out of the box, guarded by an audio watchdog that logs dropouts and auto-resumes suspended audio
- **Built-in Hydra documentation** — always at hand while coding
- **Breakout view** — send visuals to a second window at a precise size for projections or recordings ([OBS](https://obsproject.com/) and [NDI](https://ndi.video/) work great)
- **Import/export banks** — save and share entire scene banks as JSON
- **Share sketches as URLs** — `Alt/⌥ + U` copies a link with your sketch encoded in it
- **Plugin system** — new features are isolated plugins; write your own (see below)

## Keyboard Shortcuts

| Shortcut | Function |
| --- | --- |
| `Ctrl/⌘ + `` ` `` | Toggle UI visibility (works on any keyboard layout) |
| `Esc` | Bring back the hidden UI |
| `Ctrl/⌘ + Enter` | Run the current code |
| `Ctrl/⌘ + S` | Save code to the active slot |
| `Ctrl/⌘ + Y` | Toggle auto-run |
| `Alt/⌥ + U` | Copy the current sketch as a shareable URL |
| `Alt/⌥ + 0-9 / A-F` | Select slot 1-16 (HEX) in the current bank |
| `Alt/⌥ + ←/→` | Cycle between banks (when no MIDI device is connected) |
| `Alt/⌥ + X` | Export scene bank |
| `Alt/⌥ + I` | Import scene bank |

## Quick Start

### Requirements:

- [bun](https://bun.sh/)

```bash
# Install dependencies
bun install

# Start development server with hot reload
bun dev
```

Then open http://localhost:3000 in your browser.

## Building a Standalone Executable

Create a portable executable that includes all dependencies:

```bash
# Build executable with assets
bun run build:exe:full
```

This creates:
- `hydractrl.XXX` - The standalone executable. XXX depends on the OS you're building on, e.g. will produce an exe file on Windows.
- `hydractrl-public/` - Directory containing web assets

### Local File Support

When using the executable, you can serve local images and videos by placing them in a `local-assets/` directory before building. These files will be available at `http://localhost:3000/filename.ext` in your hydra sketches:

```javascript
// Example usage in hydra
await s0.initImage("http://localhost:3000/my-image.jpg");
await s0.initImage("http://localhost:3000/subfolder/nested-image.png");
await s0.initVideo("http://localhost:3000/my-video.mp4");
```

Supported formats:
- **Images**: `.jpg`, `.jpeg`, `.png`, `.svg`, `.ico`
- **Videos**: `.mp4`, `.webm`, `.ogg`, `.avi`, `.mov`

## Sharing Sketches as URLs

Press `Alt/⌥ + U` to copy a link with your current sketch encoded in the URL.
Opening such a link loads and runs the sketch without touching the recipient's
saved banks — nothing is persisted unless they explicitly save it.

## Plugins

New features are built as plugins on a small plugin system with an event bus,
quota-safe storage and error isolation — a broken plugin can't take down a live
set. The built-in URL sketch sharing and audio watchdog are the first two
plugins (see `src/client/plugins/`).

Want to implement your own? **[Read the plugin documentation](./docs/PLUGINS.md)** —
it covers the plugin shape, the context object you get, and the events you can
listen to. Plugins can even be registered at runtime from the browser console
via `window.hydractrl.registerPlugin(...)`.

## Development

```bash
bun run lint   # Biome checks (enforced in CI)
bun test       # unit tests (enforced in CI)
bun run build  # build the client bundle
```

Contributions are welcome — bug reports and ideas live in
[GitHub issues](https://github.com/dxviie/HYDRACTRL/issues).

## Credits & License

Built on top of [Hydra](https://hydra.ojack.xyz/) by [Olivia Jack](https://ojack.xyz/),
with [Bun](https://bun.sh/), [CodeMirror 6](https://codemirror.net/) and the Web MIDI API.
Made with ❤️ by [D17E](https://www.d17e.dev).

Licensed under the [GNU AGPL v3](./LICENSE).
