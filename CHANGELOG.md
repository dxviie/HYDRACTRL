# Changelog

All notable changes to HYDRACTRL are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The browser
version and the desktop app share one version number; see
[RELEASING.md](./RELEASING.md) for how a release is cut.

## [Unreleased]

### Added

- When you run a sketch with Ctrl/⌘ + Enter or the Run button, its code
  flashes for a moment in the interface theme's own colour, the way hydra's
  editor does. Auto-run leaves it alone, and so does a system set to reduce
  motion.

### Changed

- **The desktop app renders each sketch once.** While the Syphon or Spout
  output runs, the interface shows the output's own frames instead of
  rendering the sketch a second time, so what you see is exactly what
  Resolume, MadMapper or OBS receive, letterboxed to the output's shape,
  and the GPU renders every frame once instead of twice. The interface
  draws on its own again whenever the output is stopped or restarting.
  - Sketches run on the output itself, and their errors still show in the
    editor. A sketch with an error never reaches the output: it keeps
    playing the last sketch that worked.
  - XY pad moves reach the output every frame instead of every other one.
  - Slot thumbnails are taken from the output's frames.
- The macOS builds are a DMG alone. A ZIP of the same app was built next to
  each one, which nothing offered or used, and doubled the size of every
  macOS build.
- The landing page is set like a hydra session now, with the sketch playing
  behind it shown as code you can edit and run, and each section below as an
  editor tab.
- The icons are a white hydra on black now, like the one in the landing
  page's top bar: the browser tab, the installed web app, the home screen
  and the desktop app.

## [1.2.0] - 2026-09-27

HYDRACTRL Desktop, the standalone app with Syphon and Spout output, and a new
home for the project at [hydractrl.d17e.dev](https://hydractrl.d17e.dev/).

### Added

- **HYDRACTRL Desktop**: a standalone app for macOS (Apple Silicon and Intel)
  and Windows that runs the full interface and shares your visuals as a Syphon
  (macOS) or Spout (Windows) source for Resolume, MadMapper, VDMX,
  TouchDesigner, OBS and anything else that speaks either
  ([#6](https://github.com/dxviie/HYDRACTRL/issues/6)).
  - An Output menu and settings window: resolution presets up to 4K or a
    custom size, 24 to 120 fps, sender name, preview window, alpha channel,
    start at launch and optional network access.
  - Output status, frame rate and a start/stop button in the interface's
    system panel.
  - Drop images and videos on the editor to use them in a sketch. The app
    copies them into its media folder and adds the line that loads each
    one, such as `s1.initVideo("/media/clip.mp4")`. Choose the folder in
    the settings window; files already in it stay where they are.
- A chrome-less `/output` page that mirrors the interface live over a
  WebSocket, for OBS browser sources, TouchDesigner's Web Render TOP or a
  second browser window.
- Desktop builds for every release, attached to the GitHub release and
  linked from the landing page.
- A landing page at hydractrl.d17e.dev: the browser version, the desktop
  downloads and a hydra sketch playing in the background that you can open
  in the app.
- The version number in the About panel, the server's startup banner and
  `/api/capabilities`.
- The server honours the `PORT` and `HOST` environment variables.
- The browser version works on iPads and other tablets. They get the full
  interface instead of the phone view, without MIDI and the breakout window,
  which don't work there, and it all works by touch: drag panels by their
  title bars, resize the editor, the docs and the slots by the grip in their
  corner, fling the XY pad, and tap anywhere to bring back a hidden
  interface.
- The browser version installs as an app: Chrome and Edge offer to install
  it, and phones and tablets can add it to the home screen. It then opens
  without the browser's toolbars.
- Send feedback from inside the interface: the About panel's Send feedback
  button, or the speech bubble in the system panel, opens the contact form in
  a panel. Your HYDRACTRL version, browser or desktop app, OS and browser go
  along with the message.

### Changed

- The browser version moved from the site root to
  [hydractrl.d17e.dev/app](https://hydractrl.d17e.dev/app). Links shared
  with the old address still open their sketch.
- Sketch links copied in the desktop app or on a local server point at the
  browser version, so anyone can open them.
- The GitHub Page (dxviie.github.io/HYDRACTRL) redirects to
  hydractrl.d17e.dev.
- New starter scenes: Tide, Chained, Pulse and Mint, the sketches behind the
  landing page, replace the two old ones when you start with no saved scenes.
  Pulse follows the XY pad. Scenes you already have are left alone.
- A new logo: the hydra's heads each have a character of their own. One
  keeps its jaws shut and stays in control, one howls with its eyes closed
  and one rages. The chains wrap round the body and bite into it. The
  starter scenes that load the logo show the new one.
- New icons, a deep violet hydra on near-black: the favicon, the home screen
  icons, the logo in the landing page header and the desktop app, whose icon
  now has rounded corners like the other apps in the Dock.
- The code editor uses [Fira Code](https://github.com/tonsky/FiraCode), with
  its ligatures, and the rest of the interface IBM Plex Mono. Both are
  bundled, so they work offline and in the desktop app.
- Tighter panels: the editor's Sketch and Setup tabs sit in its title bar,
  and every panel has less padding around its contents.
- Frame rates show as whole numbers, so the system panel keeps its width
  when the rate wobbles around 60.
- The Light and Pop 90s themes are redesigned, each with its own editor
  colors: Light is ink on white with a violet accent, Pop 90s has cream
  panels with black outlines, sunny title bars, hot pink and teal.
- The breakout window's size is a dropdown next to its Open button. It
  remembers the size you picked, and picking another resizes an open
  breakout window.
- The slots panel resizes by the grip in its corner, like the editor: the
  slots stay square and grow with the panel, from 40 to 100 pixels. This
  replaces the Slot Size slider in the system panel; the size you set there
  carries over.

### Fixed

- Running a sketch that plays a video again no longer leaves the previous
  run's video playing in the background, one more on every run.
- Sketches that use `nanoX` and `nanoY` also render on phones, where there
  is no XY pad: both start at the centre (0.5).
- On touch screens, the first tap resumes suspended audio for `a.fft`.
- The docs panel fits the window, so its last functions and its resize
  corner stay within reach on shorter screens.

## [1.1.0] - 2026-07-06

### Added

- Share sketches as URLs: `Alt/⌥ + U` copies a link with the sketch in it,
  and opening the link runs the sketch without touching your saved banks
  ([#5](https://github.com/dxviie/HYDRACTRL/issues/5)).
- A plugin system with an event bus, quota-safe storage, notifications and
  error isolation. Plugins can also be registered at runtime from the
  browser console; see [docs/PLUGINS.md](./docs/PLUGINS.md).
- An audio watchdog that logs `a.fft` dropouts and resumes suspended audio
  ([#1](https://github.com/dxviie/HYDRACTRL/issues/1)).
- `Esc` brings back a hidden interface.
- Unit tests, and a CI workflow that runs the linter, the tests and the build.

### Changed

- The info panel, breakout view, mobile UI, MIDI controls, auto-run and slot
  advance became built-in plugins.

### Fixed

- The UI toggle (`Ctrl/⌘ + backtick`) works on every keyboard layout
  ([#7](https://github.com/dxviie/HYDRACTRL/issues/7)).
- Hiding the interface hides the slots panel too.
- Running out of browser storage no longer throws in the middle of a save,
  and a failed start shows an error instead of a black screen.

## [1.0.0] - 2025-06-12

The first public version.

### Added

- A live-coding editor built on CodeMirror 6, with hydra syntax
  highlighting, completions, error messages, five themes and auto-run.
- Scene management: 64 scenes in 4 banks of 16 slots with thumbnails,
  keyboard shortcuts and "move to next slot on save".
- MIDI control for the Korg nanoPAD2, including its XY pad (`nanoX` and
  `nanoY`) with a small physics engine. The XY pad works with a mouse too.
- A setup code tab that runs before every sketch.
- Audio reactivity with hydra's `a.fft`.
- The hydra documentation, built in.
- A breakout window at a chosen resolution.
- Import and export of scene banks as JSON, thumbnails included.
- p5.js inside sketches.
- A mobile mode that loads random scene banks, built from community sketches
  collected by Jamie Faye Fenton.
- A standalone executable (`bun run build:exe:full`) that also serves local
  images and videos to sketches.

[Unreleased]: https://github.com/dxviie/HYDRACTRL/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/dxviie/HYDRACTRL/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/dxviie/HYDRACTRL/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dxviie/HYDRACTRL/releases/tag/v1.0.0
