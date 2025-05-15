/**
 * CodeMirror editor for Hydra code
 * Uses CodeMirror 6 with JavaScript mode for syntax highlighting
 */

import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

// Import themes from @uiw packages - Note: first run bun install to install these
import { dracula } from "@uiw/codemirror-theme-dracula";
import { materialLight } from "@uiw/codemirror-theme-material";
import { nord } from "@uiw/codemirror-theme-nord";
import { githubLight } from "@uiw/codemirror-theme-github";

// Language compartment for JavaScript with Hydra extensions
const languageCompartment = new Compartment();

// Create a compartment for theme extensions to allow dynamic switching
const themeCompartment = new Compartment();

// Map UI themes to CodeMirror themes
const themeMapping = {
  // Default (no theme class) uses oneDark (Dracula-inspired)
  default: oneDark,

  // Light theme
  "theme-light": githubLight,

  // Dark theme (high contrast)
  "theme-dark": dracula,

  // Neon Eighties theme
  "theme-neon-eighties": nord,

  // Nineties Pop theme
  "theme-nineties-pop": materialLight,
};

// Create a minimal base theme for the editor
const hydraTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    fontFamily: "monospace",
    lineHeight: "1.5",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-bg-editor)",
    border: "none",
  },
});

// Create a list of Hydra functions for syntax highlighting
const hydraKeywords = [
  // Core generator functions
  "osc",
  "noise",
  "voronoi",
  "shape",
  "gradient",
  "src",
  "solid",
  // Color operations
  "color",
  "colorama",
  "saturate",
  "hue",
  "brightness",
  "contrast",
  "invert",
  // Geometry operations
  "rotate",
  "repeat",
  "repeatX",
  "repeatY",
  "kaleid",
  "pixelate",
  "scale",
  // Modulation and blending
  "modulate",
  "modulatePixelate",
  "modulateRotate",
  "modulateScale",
  "modulateKaleid",
  "blend",
  "mult",
  "add",
  "diff",
  "mask",
  "thresh",
  // Output and system functions
  "out",
  "render",
  "hush",
  "setFunction",
  "setResolution",
  "setBins",
  "fft",
  // P5 related
  "draw",
  "setup",
  "mousePressed",
  "mouseReleased",
  "mouseMoved",
];

/**
 * Create a CodeMirror editor for Hydra code
 * @param {HTMLElement} container - Container to add the editor to
 * @param {string} initialCode - Initial code to display
 * @returns {Object} Editor object with API methods
 */
export function createCodeMirrorEditor(container, initialCode = "") {
  // Custom key handler for Ctrl+Enter
  // We need to use a combination of approaches to ensure it's captured

  // Direct DOM event handler
  const preventCtrlEnterHandler = EditorView.domEventHandlers({
    keydown: (event, view) => {
      // Check for Ctrl+Enter or Cmd+Enter (code 13 is Enter)
      if ((event.ctrlKey || event.metaKey) && (event.key === "Enter" || event.keyCode === 13)) {
        // Prevent default behavior (adding newline)
        event.preventDefault();
        event.stopPropagation();
        // The actual run code action is handled by the global event listener in client/index.js
        return true;
      }
      return false;
    },
  });

  // Custom keymap that takes priority over the default keymap
  const ctrlEnterKeymap = keymap.of([
    {
      key: "Ctrl-Enter",
      mac: "Cmd-Enter",
      run: () => {
        // Returning true means the key was handled
        return true;
      },
      // High priority to override other keymaps
      preventDefault: true,
    },
  ]);

  // Function to get the appropriate theme based on body class
  function getCurrentTheme() {
    // Check if any theme classes are present on the body
    const bodyClasses = document.body.className.split(" ");
    for (const className of bodyClasses) {
      if (themeMapping[className]) {
        return themeMapping[className];
      }
    }
    // Default to the default theme if no matching class is found
    return themeMapping["default"];
  }

  // Create initial editor state
  const startState = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      // Our custom Ctrl+Enter keymap comes first for highest priority
      ctrlEnterKeymap,
      keymap.of([indentWithTab, ...defaultKeymap]),
      languageCompartment.of(javascript()),
      hydraTheme, // Base editor styling
      themeCompartment.of(getCurrentTheme()), // Theme-specific syntax coloring
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      preventCtrlEnterHandler, // Add our custom handler
    ],
  });

  // Create the editor view
  const view = new EditorView({
    state: startState,
    parent: container,
  });

  // Add custom class for additional styling
  view.dom.classList.add("cm-editor");

  // Set up theme change observer
  const themeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === "class") {
        // Body class has changed, check if we need to update the theme
        const newTheme = getCurrentTheme();
        view.dispatch({
          effects: themeCompartment.reconfigure(newTheme),
        });
      }
    }
  });

  // Start observing the body element for class changes
  themeObserver.observe(document.body, { attributes: true });

  // Create an object to simplify the integration
  const editor = {
    getCode: () => view.state.doc.toString(),
    setCode: (code) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      });
    },
    focus: () => view.focus(),
    element: view.dom,
    // Add method to manually update theme
    updateTheme: () => {
      const newTheme = getCurrentTheme();
      view.dispatch({
        effects: themeCompartment.reconfigure(newTheme),
      });
    },
  };

  return editor;
}
