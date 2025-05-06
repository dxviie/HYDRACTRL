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
      // Our custom Ctrl+Enter keymap comes first for highest priority
      ctrlEnterKeymap,
      keymap.of([
        indentWithTab,
        ...defaultKeymap
      ]),
      hydraTheme,
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