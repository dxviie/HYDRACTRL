# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
HYDRACTRL is a tool built around hydra-synth/hydra designed for live performances. It uses Bun for optimal performance and distribution, CodeMirror for code editing, and Elysia for serving the web application.

## Build Commands
- Setup: `bun install`
- Start dev: `bun dev` (watches for changes)
- Build: `bun run build` (outputs to dist/)
- Create executable: `bun run build:exe` (creates standalone binary)
- Lint: `bun run lint` (uses Biome)
- Format: `bun run format` (uses Biome)
- Test all: `bun test`
- Test single: `bun test src/path/to/file.test.ts` or `bun test --test-name="test description"`

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