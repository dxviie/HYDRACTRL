# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
HYDRACTRL is a tool built around hydra-synth/hydra designed for live performances. It uses Bun for optimal performance and distribution, CodeMirror for code editing, and Elysia for serving the web application.

The interface page is `public/app.html`. The server (the executable, the desktop app, `bun dev`) serves it at `/` and `/app`, plus a chrome-less render head at `/output` that mirrors the UI over a WebSocket (`/ws/output`, hub in `src/server/outputHub.ts`, client entry `src/client/output.js`). The server honours `PORT` and `HOST` environment variables.

The hosted site (hydractrl.d17e.dev, Cloudflare Pages, output dir `public/`, built with `bun run build:production`) serves `public/index.html` as the landing page at `/` and the interface at `/app`. Landing page scripts live in `src/site/` (bundled to `public/site/` by `build:site`), its media in `public/site/` (all 16:9, checked by `src/site/pages.test.js`); `scripts/copy-public.js` keeps those out of the executable and desktop bundles. The starter scenes in `src/sketches.js` play behind the landing page and are the interface's starter bank (`public/assets/banks/hydractrl-init-basic.json`); `src/sketches.test.js` keeps the two in step. `bun run media` re-shoots the landing page media from the real interface and `bun run media starter-bank` rebuilds the bank (see `scripts/media/README.md`; needs ffmpeg and Playwright's Chromium). Never add a `_redirects` rule that rewrites to an `.html` file (Pages redirects `/x.html` to `/x`, so it loops).

`desktop/` is the standalone Electron app (own `package.json` and lockfile): it spawns the bundled server binary (or attaches to a running `bun dev`), shows the interface, and renders `/output` offscreen as a Syphon/Spout source via `@napolab/texture-bridge`. Main-process modules live in `desktop/src/main` with injected dependencies so `bun test` at the root covers them; `bun run lint` includes `desktop/src` and `desktop/scripts`. Packaging is `electron-builder` with a `beforePack` hook that compiles the server with `bun build --compile` (see `desktop/README.md`).

## Versions and Releases
One semantic version for the web app and the desktop app, in `package.json` and `desktop/package.json` (kept equal by a test), with notes in `CHANGELOG.md` (Keep a Changelog). `bun run release:prepare <version>` bumps both and dates the `[Unreleased]` notes; pushing a `v<version>` tag runs `.github/workflows/release.yml`, which builds the desktop app via `desktop.yml` and publishes a GitHub release. Desktop artifact names carry no version so the landing page can link to `releases/latest/download/<file>` (`src/site/downloads.js`, checked against `desktop/electron-builder.yml`). Add user-facing changes to `[Unreleased]` in `CHANGELOG.md`. See `RELEASING.md`.

## Build Commands
- Setup: `bun install`
- Start dev: `bun dev` (watches for changes)
- Build: `bun run build` (interface bundles to public/assets, landing page bundle to public/site)
- Create executable: `bun run build:exe` (creates standalone binary)
- Lint: `bun run lint` (uses Biome; covers src, scripts and desktop)
- Format: `bun run format` (uses Biome)
- Test all: `bun test`
- Test single: `bun test src/path/to/file.test.ts` or `bun test --test-name="test description"`
- Landing page media: `bun run media [shot…]` (re-shoots `public/site`; see `scripts/media/README.md`)

## Code Style Guidelines
- **Runtime**: Use Bun-specific APIs when beneficial for performance
- **Formatting**: Follow Biome config (2-space indent, 100 char line length)
- **Imports**: Group by external, internal, types with blank lines between
- **Types**: Use TypeScript with strict mode enabled; avoid `any`
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Error Handling**: Use typed errors and provide useful error messages
- **Performance**: Prioritize low-latency operations for live performances
- **UI Components**: Organize UI code in separate files in src/client directory
- **CodeMirror**: Use the CodeMirror 6 API for editor functionality