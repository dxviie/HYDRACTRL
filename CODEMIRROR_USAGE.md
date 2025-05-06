# CodeMirror Editor for HYDRACTRL

This document explains how to use the new CodeMirror editor implementation.

## Installation

1. Install the required dependencies:

```bash
bun install
```

## Configuration

Three editor implementations are available:

1. **Original Syntax Editor** - The original custom implementation
2. **Full CodeMirror Editor** - A feature-rich CodeMirror 6 implementation with syntax highlighting
3. **Basic CodeMirror Editor** - A minimal CodeMirror 6 implementation without syntax highlighting

To select which editor to use, open `src/client/index.js` and uncomment the desired import:

```javascript
// Import editor implementations - uncomment one to use it
// import { createSyntaxEditor } from '../utils/SyntaxHighlightEditor.js'; // Original editor
import { createCodeMirrorEditor } from '../utils/CodeMirrorEditor.js'; // Full CodeMirror editor
// import { createBasicCodeMirrorEditor } from '../utils/BasicCodeMirrorEditor.js'; // Basic CodeMirror editor
```

Also, update the `initEditor` function to use the appropriate editor creation function:

```javascript
// Create the hydra editor
const editor = createCodeMirrorEditor(editorContent, DEFAULT_CODE);
// Alternative options:
// const editor = createSyntaxEditor(editorContent, DEFAULT_CODE); // Original syntax editor
// const editor = createBasicCodeMirrorEditor(editorContent, DEFAULT_CODE); // Basic CM editor
```

## Customization

Both CodeMirror implementations can be customized by editing their respective files:

- Full version: `src/utils/CodeMirrorEditor.js`
- Basic version: `src/utils/BasicCodeMirrorEditor.js`

### Theme

You can customize the editor theme by modifying the `hydraTheme` variable in each file. For example:

```javascript
const hydraTheme = EditorView.theme({
  "&": {
    backgroundColor: "rgba(40, 42, 54, 0.7)",
    height: "100%",
    fontSize: "14px",
  },
  // Add more styling here
});
```

### Extensions

In the full version, you can add more CodeMirror extensions to enhance functionality. For example:

```javascript
extensions: [
  lineNumbers(),
  highlightActiveLineGutter(),
  keymap.of([
    indentWithTab,
    ...defaultKeymap
  ]),
  // Add more extensions here
]
```

## Troubleshooting

If you encounter issues:

1. Make sure all dependencies are installed: `bun install`
2. Check browser console for errors
3. Try the basic implementation if the full one has issues
4. Revert to the original editor if needed

## Additional Resources

- [CodeMirror 6 Documentation](https://codemirror.net/docs/)
- [CodeMirror 6 Examples](https://codemirror.net/examples/)