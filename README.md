# HYDRACTRL

A performant tool built around [hydra-synth](https://hydra.ojack.xyz/) designed for live visual performances.

## Features

- Scene management with 4 banks of 16 slots (64 scenes total)
- MIDI controller support with nanoPAD scene integration
- Code editor with syntax highlighting
- 5 UI themes with customizable appearance
- Breakout window for performances and recordings
- Import/export scene banks with thumbnails
- Built with Bun for maximum performance
- Easily distributable as a standalone executable

## Quick Start

```bash
# Install dependencies
bun install

# Start development server with hot reload
bun dev

# Build for production
bun run build

# Create standalone executable
bun run build:exe
```

## Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| Ctrl + Enter | Run the current code |
| Ctrl + S | Save code to the active slot |
| Ctrl + X | Export scene bank |
| Ctrl + I | Import scene bank |
| Escape | Toggle editor visibility |
| Ctrl + 1-9 | Select slots 1-9 in current bank |
| Ctrl + ←/→ | Cycle between banks |

## Distribution

The `bun run build:exe` command creates a single executable file that can be distributed and run without installing Bun or any dependencies.

## GitHub Pages

To deploy the project landing page:

1. Rename `public/index-page.html` to `public/landing.html`
2. Add a screenshot of the interface to `public/assets/hydractrl-preview.jpg`
3. Configure GitHub Pages to deploy from your repository:
   - Go to your repository's Settings > Pages
   - Select your main branch and the `/public` folder as the source
   - The main app will be accessible at `https://username.github.io/HYDRACTRL/`
   - The landing page will be at `https://username.github.io/HYDRACTRL/landing.html`

## Credits

HYDRACTRL is built on top of [Hydra-Synth](https://hydra.ojack.xyz/) by [Olivia Jack](https://ojack.xyz/). It uses CodeMirror 6 for the editor and Web MIDI API for controller support.