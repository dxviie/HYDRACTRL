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

// Create a custom theme that's similar to our existing editor's theme
const hydraTheme = EditorView.theme({
  "&": {
    backgroundColor: "rgba(40, 42, 54, 0.7)",
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    fontFamily: "monospace",
    lineHeight: "1.5",
  },
  ".cm-content": {
    caretColor: "#f8f8f2",
  },
  ".cm-line": {
    padding: "0 8px",
    color: "#f8f8f2",
  },
  ".cm-cursor": {
    borderLeftColor: "#f8f8f2",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  ".cm-gutters": {
    backgroundColor: "rgba(40, 42, 54, 0.7)",
    color: "#6272a4",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
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
  // Create initial editor state
  const startState = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      keymap.of([
        indentWithTab,
        ...defaultKeymap
      ]),
      languageCompartment.of(javascript()),
      hydraTheme,
      oneDark,
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
    ]
  });

  // Create the editor view
  const view = new EditorView({
    state: startState,
    parent: container,
  });

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