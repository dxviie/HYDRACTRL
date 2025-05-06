/**
 * Basic CodeMirror editor for Hydra code
 * Uses CodeMirror 6 with minimal configuration
 */

import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";

/**
 * Create a basic CodeMirror editor for Hydra code
 * @param {HTMLElement} container - Container to add the editor to
 * @param {string} initialCode - Initial code to display
 * @returns {Object} Editor object with API methods
 */
export function createBasicCodeMirrorEditor(container, initialCode = '') {
  // Create the editor theme with similar styling to our existing editors
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
      caretColor: "#f8f8f2",
      color: "#f8f8f2",
      backgroundColor: "transparent !important", // Force transparent background
    },
    ".cm-line": {
      padding: "0 8px",
      backgroundColor: "transparent !important", // Force transparent background
    }
  });

  // Create initial editor state
  const startState = EditorState.create({
    doc: initialCode,
    extensions: [
      keymap.of([
        indentWithTab,
        ...defaultKeymap
      ]),
      hydraTheme,
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
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