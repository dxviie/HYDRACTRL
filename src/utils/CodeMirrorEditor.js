/**
 * CodeMirror editor for Hydra code
 * Uses CodeMirror 6 with JavaScript mode for syntax highlighting
 */

import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { monokai } from "@uiw/codemirror-theme-monokai";
import { eclipse } from "@uiw/codemirror-theme-eclipse";
import { solarizedDark } from "@uiw/codemirror-theme-solarized";
import { autocompletion, CompletionContext, startCompletion } from "@codemirror/autocomplete";

// Language compartment for JavaScript with Hydra extensions
const languageCompartment = new Compartment();

// Create a compartment for theme extensions to allow dynamic switching
const themeCompartment = new Compartment();

// Map UI themes to CodeMirror themes
const themeMapping = {
  // Default (no theme class) uses oneDark (Dracula-inspired)
  default: oneDark,

  // Light theme
  "theme-light": eclipse,

  // Dark theme (high contrast)
  "theme-dark": solarizedDark,

  // Neon Eighties theme
  "theme-neon-eighties": monokai,

  // Nineties Pop theme
  "theme-nineties-pop": dracula,
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

// Hydra API Function Definitions with parameters
const hydraFunctions = {
  // Source Functions
  osc: {
    description: "Sine wave oscillator",
    params: ["frequency = 60", "sync = 0.1", "offset = 0"],

  },
  noise: {
    description: "Noise generator",
    params: ["scale = 10", "offset = 0.1"],

  },
  voronoi: {
    description: "Voronoi diagram",
    params: ["scale = 5", "speed = 0.3", "blending = 0.3"],

  },
  shape: {
    description: "Generate a shape",
    params: ["sides = 3", "radius = 0.3", "smoothing = 0.01"],

  },
  gradient: {
    description: "Generate a gradient",
    params: ["speed = 0"],

  },
  src: {
    description: "Use a source buffer",
    params: ["source"],

  },
  solid: {
    description: "Solid color",
    params: ["r = 0", "g = 0", "b = 0", "a = 1"],

  },

  // Color Operations
  color: {
    description: "Shift RGB color values",
    params: ["r = 1", "g = 1", "b = 1"],

  },
  colorama: {
    description: "Shift HSV values",
    params: ["amount = 0.005"],

  },
  saturate: {
    description: "Saturate colors",
    params: ["amount = 2"],

  },
  hue: {
    description: "Hue rotation",
    params: ["hue = 0.4"],

  },
  brightness: {
    description: "Adjust brightness",
    params: ["brightness = 0.4"],

  },
  contrast: {
    description: "Adjust contrast",
    params: ["contrast = 1.6"],

  },
  invert: {
    description: "Invert colors",
    params: ["amount = 1"],

  },

  // Geometry Operations
  rotate: {
    description: "Rotate texture",
    params: ["angle = 10", "speed = 0"],

  },
  repeat: {
    description: "Repeat texture in x and y",
    params: ["repeatX = 3", "repeatY = 3", "offsetX = 0", "offsetY = 0"],

  },
  repeatX: {
    description: "Repeat texture in x direction",
    params: ["reps = 3", "offset = 0"],

  },
  repeatY: {
    description: "Repeat texture in y direction",
    params: ["reps = 3", "offset = 0"],

  },
  kaleid: {
    description: "Kaleidoscope effect",
    params: ["numSides = 4"],

  },
  pixelate: {
    description: "Pixelate texture",
    params: ["pixelX = 20", "pixelY = 20"],

  },
  scale: {
    description: "Scale texture",
    params: ["amount = 1.5", "xMult = 1", "yMult = 1", "offsetX = 0.5", "offsetY = 0.5"],

  },

  // Modulation and Blending
  modulate: {
    description: "Modulate texture with another source",
    params: ["texture", "amount = 0.1"],

  },
  modulatePixelate: {
    description: "Modulated pixelate",
    params: ["texture", "multiple = 10", "offset = 3"],

  },
  modulateRotate: {
    description: "Modulated rotation",
    params: ["texture", "multiple = 1", "offset = 0"],

  },
  modulateScale: {
    description: "Modulated scaling",
    params: ["texture", "multiple = 1", "offset = 1"],

  },
  modulateKaleid: {
    description: "Modulated kaleidoscope",
    params: ["texture", "nSides = 4"],

  },
  blend: {
    description: "Blend with another source",
    params: ["texture", "amount = 0.5"],

  },
  mult: {
    description: "Multiply with another source",
    params: ["texture", "amount = 1"],

  },
  add: {
    description: "Add with another source",
    params: ["texture", "amount = 1"],

  },
  diff: {
    description: "Difference with another source",
    params: ["texture"],

  },
  mask: {
    description: "Apply mask",
    params: ["texture"],

  },
  thresh: {
    description: "Threshold filter",
    params: ["threshold = 0.5", "tolerance = 0.04"],

  },

  // Output and System Functions
  out: {
    description: "Output to a specific buffer",
    params: ["buffer = o0"],

  },
  render: {
    description: "Render all output buffers",
    params: ["output = o0"],

  },
  hush: {
    description: "Clear all output buffers",
    params: [],

  },
  setResolution: {
    description: "Set resolution of output",
    params: ["width", "height"],

  },
  setBins: {
    description: "Set number of FFT bins",
    params: ["bins = 4"],

  },

  // P5 related Functions
  draw: {
    description: "P5 draw function",
    params: [],

  },
  setup: {
    description: "P5 setup function",
    params: [],

  },
  mousePressed: {
    description: "P5 mousePressed event function",
    params: [],

  },
  mouseReleased: {
    description: "P5 mouseReleased event function",
    params: [],

  },
  mouseMoved: {
    description: "P5 mouseMoved event function",
    params: [],

  }
};

// Create a list of Hydra functions for syntax highlighting
const hydraKeywords = Object.keys(hydraFunctions);

/**
 * Provide Hydra-specific autocompletions
 * @param {CompletionContext} context - The CodeMirror completion context
 * @returns {Array} Completion options
 */
function hydraCompletions(context) {
  // Check for function names
  const functionMatch = context.matchBefore(/\w*$/);
  if (functionMatch.from == functionMatch.to && !context.explicit) {
    return null;
  }

  // Generate completions for Hydra function names
  const matchText = functionMatch.text.toLowerCase();
  const completions = Object.keys(hydraFunctions)
    .filter(keyword => keyword.toLowerCase().startsWith(matchText))
    .map(keyword => {
      const funcData = hydraFunctions[keyword];
      const paramInfo = funcData.params.length > 0
        ? `(${funcData.params.join(", ")})`
        : "()";

      return {
        label: keyword,
        type: "function",
        detail: paramInfo,
        info: `${funcData.description}`,
        apply: keyword + "(", // Add opening parenthesis for function call
        boost: 1
      };
    });

  // Check for method chaining (like .color(), .rotate(), etc.)
  const methodMatch = context.matchBefore(/\.\w*$/);
  if (methodMatch && methodMatch.from != methodMatch.to) {
    const methodText = methodMatch.text.substring(1).toLowerCase(); // Remove the dot
    const methodCompletions = Object.keys(hydraFunctions)
      .filter(keyword =>
        // Only include methods, not source functions (assumes source functions don't chain)
        keyword !== "osc" &&
        keyword !== "noise" &&
        keyword !== "voronoi" &&
        keyword !== "shape" &&
        keyword !== "gradient" &&
        keyword !== "src" &&
        keyword !== "solid" &&
        keyword.toLowerCase().startsWith(methodText)
      )
      .map(keyword => {
        const funcData = hydraFunctions[keyword];
        const paramInfo = funcData.params.length > 0
          ? `(${funcData.params.join(", ")})`
          : "()";

        return {
          label: keyword,
          type: "method",
          detail: paramInfo,
          info: `${funcData.description} \n\nExample: ${funcData.example} `,
          apply: keyword + "(", // Add opening parenthesis for function call
          boost: 1
        };
      });

    if (methodCompletions.length) {
      return {
        from: methodMatch.from + 1, // +1 to account for the dot
        options: methodCompletions,
        validFor: /^\w*$/
      };
    }
  }

  // Return function name completions if any match
  if (completions.length) {
    return {
      from: functionMatch.from,
      options: completions,
      validFor: /^\w*$/
    };
  }

  return null;
}

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
    {
      // Add Ctrl+Space for manual trigger of completion
      key: "Ctrl-Space",
      mac: "Cmd-Space",
      run: startCompletion
    }
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
      // Add autocompletion with custom Hydra completions
      autocompletion({
        override: [hydraCompletions],
        activateOnTyping: true,
        defaultKeymap: true,
        icons: true,
        closeOnBlur: true
      })
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