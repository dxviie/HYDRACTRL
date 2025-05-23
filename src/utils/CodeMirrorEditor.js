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
  // Global Functions (Synth Control)
  render: {
    description: "Renders specified output buffer(s) or all if none specified.",
    params: ["outputBuffer"],
  },
  setResolution: {
    description: "Sets canvas resolution.",
    params: ["width", "height"],
  },
  hush: {
    description: "Clears all output buffers.",
    params: [],
  },
  update: {
    description: "Manually trigger an update/render cycle.",
    params: [],
  },
  initCam: {
    description: "Initializes webcam as an input source (s0, s1, etc.).",
    params: ["index = 0"],
  },
  initScreen: {
    description: "Initializes screen capture as an input source.",
    params: ["index = 0"],
  },
  initVideo: {
    description: "Initializes video from URL as an input source.",
    params: ["url"],
  },
  initImage: {
    description: "Initializes image from URL as an input source.",
    params: ["url"],
  },
  initAudio: {
    description: "Initializes audio input for the 'a' (audio analysis) object.",
    params: [],
  },

  // Source Functions
  noise: {
    description: "Generates Perlin noise.",
    params: ["scale = 10", "offset = 0.1"],
  },
  voronoi: {
    description: "Generates Voronoi diagrams.",
    params: ["scale = 5", "speed = 0.3", "blending = 0.3"],
  },
  osc: {
    description: "Generates a sine wave oscillator.",
    params: ["frequency = 60", "sync = 0.1", "offset = 0"],
  },
  shape: {
    description: "Generates geometric shapes.",
    params: ["sides = 3", "radius = 0.3", "smoothing = 0.01"],
  },
  gradient: {
    description: "Generates a color gradient.",
    params: ["speed = 0"],
  },
  solid: {
    description: "Generates a solid color.",
    params: ["r = 0", "g = 0", "b = 0", "a = 1"],
  },
  src: {
    description: "References an existing texture source (e.g., s0, o1).",
    params: ["texture"],
  },

  // Geometry Functions
  rotate: {
    description: "Rotates a texture.",
    params: ["angle = 0", "speed = 0"],
  },
  scale: {
    description: "Scales a texture.",
    params: ["amount = 1.5", "xMult = 1", "yMult = 1", "offsetX = 0.5", "offsetY = 0.5"],
  },
  pixelate: {
    description: "Pixelates a texture.",
    params: ["pixelX = 20", "pixelY = 20"],
  },
  repeat: {
    description: "Repeats a texture.",
    params: ["repeatX = 3", "repeatY = 3", "offsetX = 0", "offsetY = 0"],
  },
  repeatX: {
    description: "Repeats a texture in the X direction.",
    params: ["reps = 3", "offset = 0"],
  },
  repeatY: {
    description: "Repeats a texture in the Y direction.",
    params: ["reps = 3", "offset = 0"],
  },
  kaleid: {
    description: "Creates a kaleidoscope effect.",
    params: ["nSides = 4"],
  },
  scroll: {
    description: "Scrolls a texture.",
    params: ["scrollX = 0", "scrollY = 0", "speedX = 0", "speedY = 0"],
  },
  scrollX: {
    description: "Scrolls a texture in the X direction.",
    params: ["amount = 0", "speed = 0"],
  },
  scrollY: {
    description: "Scrolls a texture in the Y direction.",
    params: ["amount = 0", "speed = 0"],
  },

  // Color Functions
  posterize: {
    description: "Reduces the number of colors in a texture.",
    params: ["bins = 3", "gamma = 0.6"],
  },
  shift: {
    description: "Shifts RGBA color channels.",
    params: ["r = 0.5", "g = 0", "b = 0", "a = 0"],
  },
  invert: {
    description: "Inverts the colors of a texture.",
    params: ["amount = 1"],
  },
  contrast: {
    description: "Adjusts the contrast of a texture.",
    params: ["amount = 1.6"],
  },
  brightness: {
    description: "Adjusts the brightness of a texture.",
    params: ["amount = 0.4"],
  },
  luma: {
    description: "Creates a luma key (mask based on brightness).",
    params: ["threshold = 0.5", "tolerance = 0.1"],
  },
  thresh: {
    description: "Applies a threshold filter to a texture.",
    params: ["threshold = 0.5", "tolerance = 0.01"],
  },
  color: {
    description: "Sets or scales RGBA color values.",
    params: ["r = 1", "g = 1", "b = 1", "a = 1"],
  },
  saturate: {
    description: "Adjusts the saturation of a texture.",
    params: ["amount = 1"],
  },
  hue: {
    description: "Adjusts the hue of a texture.",
    params: ["shift = 0"],
  },
  colorama: {
    description: "Applies a colorama (HSV shift) effect.",
    params: ["amount = 0.005"],
  },

  // Blend Functions
  add: {
    description: "Adds the colors of two textures.",
    params: ["texture", "amount = 1"],
  },
  sub: {
    description: "Subtracts the colors of one texture from another.",
    params: ["texture", "amount = 1"],
  },
  layer: {
    description: "Layers one texture on top of another (alpha blending).",
    params: ["texture"],
  },
  blend: {
    description: "Blends two textures using a specified amount.",
    params: ["texture", "amount = 0.5"],
  },
  mult: {
    description: "Multiplies the colors of two textures.",
    params: ["texture", "amount = 1"],
  },
  diff: {
    description: "Calculates the difference between two textures.",
    params: ["texture"],
  },
  mask: {
    description: "Uses one texture to mask another.",
    params: ["texture", "reps = 3", "offset = 0.5"],
  },

  // Modulate Functions
  modulate: {
    description: "Modulates the texture coordinates of one source by another.",
    params: ["texture", "amount = 0.1"],
  },
  modulateRepeat: {
    description: "Modulates texture coordinates with a repeat effect.",
    params: ["texture", "repeatX = 3", "repeatY = 3", "offsetX = 0", "offsetY = 0", "amount = 1"],
  },
  modulateRepeatX: {
    description: "Modulates texture coordinates with a repeatX effect.",
    params: ["texture", "reps = 3", "offset = 0", "amount = 1"],
  },
  modulateRepeatY: {
    description: "Modulates texture coordinates with a repeatY effect.",
    params: ["texture", "reps = 3", "offset = 0", "amount = 1"],
  },
  modulateKaleid: {
    description: "Modulates texture coordinates with a kaleidoscope effect.",
    params: ["texture", "nSides = 4", "amount = 1"],
  },
  modulateScrollX: {
    description: "Modulates texture coordinates with a scrollX effect.",
    params: ["texture", "scroll = 0.5", "speed = 0", "amount = 1"],
  },
  modulateScrollY: {
    description: "Modulates texture coordinates with a scrollY effect.",
    params: ["texture", "scroll = 0.5", "speed = 0", "amount = 1"],
  },
  modulateScale: {
    description: "Modulates texture coordinates with a scale effect.",
    params: ["texture", "multiple = 1", "offset = 0", "amount = 1"],
  },
  modulatePixelate: {
    description: "Modulates texture coordinates with a pixelate effect.",
    params: ["texture", "pixelX = 10", "pixelY = 10", "amount = 1"],
  },
  modulateRotate: {
    description: "Modulates texture coordinates with a rotate effect.",
    params: ["texture", "angle = 0", "speed = 0", "amount = 1"],
  },
  modulateHue: {
    description: "Modulates texture hue based on another texture.",
    params: ["texture", "amount = 0.1"],
  },

  // P5 related Functions (preserved from original)
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