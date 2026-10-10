# The code editor

HYDRACTRL's editor is CodeMirror 6, set up in one module,
`src/utils/CodeMirrorEditor.js`. `src/client/index.js` creates it once with
`createCodeMirrorEditor(container, code)` for the Sketch and Setup tabs.

## What it adds to CodeMirror

- **Hydra completions**: `hydraCompletions` suggests every hydra function with
  its parameters and description, from `src/data/hydra-functions.json` (the
  same data as the built-in docs panel), plus a few p5 names. Completions open
  as you type, or with `Ctrl/⌘ + Space`.
- **Running**: `Ctrl/⌘ + Enter` never inserts a newline in the editor. The
  global key handler in `src/client/index.js` runs the code, and
  `editor.flash()` lights it up for a moment (`src/utils/runFlash.js`).
- **Themes**: each interface theme has its own editor colours. `themeMapping`
  maps the theme class on `<body>` to a CodeMirror theme (One Dark, Solarized
  Dark, Monokai, or the Light and Pop 90s colours in
  `src/utils/editorThemes.js`), and the editor follows when the class
  changes. `hydraTheme` is the base styling they share (Fira Code, sizes).
- **File drops**: in the desktop app, images and videos dropped on the editor
  go to the media folder, and `editor.insertLines()` writes the line that
  loads them where it can't split a statement (`src/utils/editorInsert.js`).

## The editor object

| Method | Does |
| --- | --- |
| `getCode()` / `setCode(code)` | Read or replace the whole document |
| `focus()` | Focus the editor |
| `flash()` | The run flash (skipped when the system asks for reduced motion) |
| `handleFileDrops(handler)` | Take dropped files instead of pasting them; returns a function that stops it |
| `insertLines(pos, lines)` | Insert whole lines near `pos` |
| `updateTheme()` | Re-read the theme class on `<body>` |
| `element` | The editor's DOM element |

## Changing it

Add CodeMirror extensions to the `extensions` list in
`createCodeMirrorEditor`. Keep the `ctrlEnterKeymap` first, so `Ctrl/⌘ +
Enter` stays a run and never becomes a newline. See the
[CodeMirror 6 documentation](https://codemirror.net/docs/) for the API.
