# Landing page media

The screenshots and videos on the landing page (`public/site/*.mp4` with their
`-poster.jpg`, and `public/site/*.jpg`) are captured from the real interface by
these scripts, so they can be re-shot whenever the interface or the starter
scenes change. The same tooling rebuilds the starter bank.

```sh
bun run media                          # every screenshot and video, into public/site
bun run media code-editor setup-code   # just these
bun run media starter-bank             # rebuild public/assets/banks/hydractrl-init-basic.json
bun run media --out /tmp/media         # write elsewhere, to compare before replacing
```

`bun run media` builds the interface, starts its own server on a free port and
stops it again. A full run takes several minutes.

## Requirements

- **ffmpeg** on the `PATH`, or `FFMPEG=/path/to/ffmpeg`.
- **Chromium** for `playwright-core` (a dev dependency):
  `bunx playwright-core install chromium`, or `CHROMIUM=/path/to/chrome` for a
  browser you already have. It has to be the full browser: Playwright's
  headless shell (`chrome-headless-shell`) sets text a little narrower, so
  lines wrap differently from the media already on the site.

## How it works

- `page/clock.js` takes over the page's clock (`performance.now`, `Date.now`,
  timers, `requestAnimationFrame`). Recording steps it by exactly 1/30 s per
  frame, so hydra, the XY pad physics and the editor all move at the right speed
  however slowly the frames render. `page/still.css` turns off CSS transitions,
  which would run on real time.
- WebGL runs on SwiftShader (software), which is slow but renders the same on
  every machine.
- `page/cursor.js` draws a pointer, since headless Chromium has none.
- Each shot sets the scenes up (the starter bank in slots 1-4 and four
  variations in slots 5-8, see `scenes.js`) and places the panels explicitly.

Everything in the frames is the real interface, with two simulated inputs:

- **MIDI**: `page/midi.js` puts a fake nanoPAD2 behind the Web MIDI API, and
  `page/nanopad.js` draws the controller into the frame and sends its notes and
  touchpad moves.
- **Audio**: `page/beat.js` feeds hydra's analyser a synthetic 120 BPM beat. The
  videos are silent, so a steady pattern reads better than real audio.

Two stills are composed from real captures: `breakout-view` puts the interface
and the breakout window in drawn window frames, and `import-export` shows the
slots panel next to a rendering of the file the export writes.

## Shots

| Shot | Output | Shows |
| --- | --- | --- |
| `hydractrl-preview` | 1920×1080 JPEG | The whole interface (the hero image and README screenshot) |
| `scene-management` | 960×540 MP4 | Clicking through scenes in the slot grid |
| `midi-integration` | 960×540 MP4 | nanoPAD2 pads switching scenes, its touchpad moving the XY pad |
| `xy-pad-physics` | 960×540 MP4 | Flicking the XY pad with Pulse running, then adding friction |
| `code-editor` | 960×540 MP4 | Adding a line with completions and running it |
| `audio-reactivity` | 960×540 MP4 | A sketch flashing on the beat through `a.fft`, with `a.show()` |
| `breakout-view` | 1280×720 JPEG | The interface next to a breakout window |
| `multiple-themes` | 960×540 MP4 | The five themes, then panel opacity down and up |
| `setup-code` | 1280×720 JPEG | The Setup tab |
| `builtin-docs` | 1280×720 JPEG | The hydra docs panel |
| `import-export` | 1280×720 JPEG | The export button and the exported file |
| `starter-bank` | JSON | The starter bank, rebuilt from `src/sketches.js` |

Keep new shots 16:9 and give their `<img>` or `<video>` in `public/index.html`
the same size; `src/site/pages.test.js` checks that every file the page uses
exists and is declared 16:9.

## Starter scenes

`src/sketches.js` is the source of the starter scenes. After changing one, run
`bun run media starter-bank` (the interface imports each sketch and saves it,
which captures its thumbnail), then re-shoot the media. `src/sketches.test.js`
fails until the bank matches the sketches.
