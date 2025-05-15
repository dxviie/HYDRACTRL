/**
 * CodeMirror editor for Hydra code
 * Uses CodeMirror 6 with JavaScript mode for syntax highlighting
 */

import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

// Language compartment for JavaScript with Hydra extensions
const languageCompartment = new Compartment();

// Create a custom theme that uses CSS variables for theming
const hydraTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent !important", // Force transparent background
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    fontFamily: "monospace",
    lineHeight: "1.5",
    backgroundColor: "transparent !important", // Force transparent background
  },
  ".cm-content": {
    caretColor: "var(--cm-cursor)",
    backgroundColor: "transparent !important", // Force transparent background
  },
  ".cm-line": {
    padding: "0 8px",
    color: "var(--cm-text)",
    backgroundColor: "transparent !important", // Force transparent background
  },
  ".cm-cursor": {
    borderLeftColor: "var(--cm-cursor)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--cm-active-line-bg)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-bg-editor)",
    color: "var(--cm-comment)",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--cm-active-line-bg)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--cm-selection-bg) !important",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--cm-selection-bg) !important",
    outline: "1px solid var(--cm-selection-bg) !important",
  },
  // Syntax highlighting
  ".cm-keyword": { color: "var(--cm-keyword)" },
  ".cm-definition": { color: "var(--cm-definition)" },
  ".cm-variable": { color: "var(--cm-variable)" },
  ".cm-function": { color: "var(--cm-function)" },
  ".cm-number": { color: "var(--cm-number)" },
  ".cm-string": { color: "var(--cm-string)" },
  ".cm-comment": { color: "var(--cm-comment)" },
  ".cm-property": { color: "var(--cm-property)" },
  ".cm-operator": { color: "var(--cm-operator)" },
  ".cm-punctuation": { color: "var(--cm-punctuation)" },
});

// Create a list of Hydra functions for syntax highlighting
const hydraKeywords = [
  // Core generator functions
  "osc", "noise", "voronoi", "shape", "gradient", "src", "solid",
  // Color operations
  "color", "colorama", "saturate", "hue", "brightness", "contrast", "invert",
  // Geometry operations
  "rotate", "repeat", "repeatX", "repeatY", "kaleid", "pixelate", "scale",
  // Modulation and blending
  "modulate", "modulatePixelate", "modulateRotate", "modulateScale", "modulateKaleid",
  "blend", "mult", "add", "diff", "mask", "thresh",
  // Output and system functions
  "out", "render", "hush", "setFunction", "setResolution",
  "setBins", "fft",
  // P5 related
  "draw", "setup", "mousePressed", "mouseReleased", "mouseMoved"
];

/**
 * Create a CodeMirror editor for Hydra code
 * @param {HTMLElement} container - Container to add the editor to
 * @param {string} initialCode - Initial code to display
 * @returns {Object} Editor object with API methods
 */
export function createCodeMirrorEditor(container, initialCode = '') {
  // Custom key handler for Ctrl+Enter
  // We need to use a combination of approaches to ensure it's captured

  // Direct DOM event handler
  const preventCtrlEnterHandler = EditorView.domEventHandlers({
    keydown: (event, view) => {
      // Check for Ctrl+Enter or Cmd+Enter (code 13 is Enter)
      if ((event.ctrlKey || event.metaKey) && (event.key === 'Enter' || event.keyCode === 13)) {
        // Prevent default behavior (adding newline)
        event.preventDefault();
        event.stopPropagation();
        // The actual run code action is handled by the global event listener in client/index.js
        return true;
      }
      return false;
    }
  });

  // Custom keymap that takes priority over the default keymap
  const ctrlEnterKeymap = keymap.of([{
    key: "Ctrl-Enter",
    mac: "Cmd-Enter",
    run: () => {
      // Returning true means the key was handled
      return true;
    },
    // High priority to override other keymaps
    preventDefault: true
  }]);

  // Create initial editor state
  const startState = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      // Our custom Ctrl+Enter keymap comes first for highest priority
      ctrlEnterKeymap,
      keymap.of([
        indentWithTab,
        ...defaultKeymap
      ]),
      languageCompartment.of(javascript()),
      hydraTheme,
      oneDark,
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      preventCtrlEnterHandler, // Add our custom handler
    ]
  });

  // Create the editor view
  const view = new EditorView({
    state: startState,
    parent: container,
  });

  // Add custom class for additional styling
  view.dom.classList.add('cm-editor');

  // Create an object to simplify the integration
  const editor = {
    getCode: () => view.state.doc.toString(),
    setCode: (code) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code }
      });
    },
    focus: () => view.focus(),
    element: view.dom
  };

  return editor;
}