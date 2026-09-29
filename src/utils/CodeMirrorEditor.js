/**
 * CodeMirror editor for Hydra code
 * Uses CodeMirror 6 with JavaScript mode for syntax highlighting
 */

import { CompletionContext, autocompletion, startCompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { monokai } from "@uiw/codemirror-theme-monokai";
import { solarizedDark } from "@uiw/codemirror-theme-solarized";
import hydraData from "../data/hydra-functions.json" assert { type: "json" };
import { insertLines } from "./editorInsert.js";
import { lightEditorTheme, popEditorTheme } from "./editorThemes.js";

// Language compartment for JavaScript with Hydra extensions
const languageCompartment = new Compartment();

// Create a compartment for theme extensions to allow dynamic switching
const themeCompartment = new Compartment();

// Map UI themes to CodeMirror themes
const themeMapping = {
  // Default (no theme class) uses oneDark (Dracula-inspired)
  default: oneDark,

  // Light theme
  "theme-light": lightEditorTheme,

  // Dark theme (high contrast)
  "theme-dark": solarizedDark,

  // Neon Eighties theme
  "theme-neon-eighties": monokai,

  // Nineties Pop theme
  "theme-nineties-pop": popEditorTheme,
};

// Create a minimal base theme for the editor. Code is set in Fira Code
// (styles.css loads it), ligatures included.
const hydraTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-code)",
    lineHeight: "1.5",
  },
  ".cm-content": {
    padding: "2px 0",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-bg-editor)",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 2px 0 6px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--font-code)",
  },
  ".cm-tooltip": {
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
  },
});

// Generate hydraFunctions from shared JSON data, converting params array to params array of strings for backward compatibility
const hydraFunctions = Object.fromEntries(
  Object.entries(hydraData.functions).map(([name, func]) => [
    name,
    {
      description: func.description,
      params: func.params.map((param) =>
        param.default ? `${param.name} = ${param.default}` : param.name,
      ),
      example: func.example,
    },
  ]),
);

// Add some P5 related functions that aren't in the JSON data
const p5Functions = {
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
  },
};

// Merge hydra functions with P5 functions
Object.assign(hydraFunctions, p5Functions);

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
  if (functionMatch.from === functionMatch.to && !context.explicit) {
    return null;
  }

  // Generate completions for Hydra function names
  const matchText = functionMatch.text.toLowerCase();
  const completions = Object.keys(hydraFunctions)
    .filter((keyword) => keyword.toLowerCase().startsWith(matchText))
    .map((keyword) => {
      const funcData = hydraFunctions[keyword];
      const paramInfo = funcData.params.length > 0 ? `(${funcData.params.join(", ")})` : "()";

      return {
        label: keyword,
        type: "function",
        detail: paramInfo,
        info: `${funcData.description}`,
        apply: keyword + "(", // Add opening parenthesis for function call
        boost: 1,
      };
    });

  // Check for method chaining (like .color(), .rotate(), etc.)
  const methodMatch = context.matchBefore(/\.\w*$/);
  if (methodMatch && methodMatch.from !== methodMatch.to) {
    const methodText = methodMatch.text.substring(1).toLowerCase(); // Remove the dot
    const methodCompletions = Object.keys(hydraFunctions)
      .filter((keyword) => {
        // Use syntaxType from JSON data if available, otherwise use legacy exclusion list
        const funcData = hydraData.functions[keyword];
        const isMethodOrChainable = funcData
          ? funcData.syntaxType === "method" || funcData.syntaxType === "property"
          : // Legacy fallback: exclude known source functions
            !(
              keyword === "osc" ||
              keyword === "noise" ||
              keyword === "voronoi" ||
              keyword === "shape" ||
              keyword === "gradient" ||
              keyword === "src" ||
              keyword === "solid"
            );

        return isMethodOrChainable && keyword.toLowerCase().startsWith(methodText);
      })
      .map((keyword) => {
        const funcData = hydraFunctions[keyword];
        const paramInfo = funcData.params.length > 0 ? `(${funcData.params.join(", ")})` : "()";

        return {
          label: keyword,
          type: "method",
          detail: paramInfo,
          info: `${funcData.description} \n\nExample: ${funcData.example} `,
          apply: keyword + "(", // Add opening parenthesis for function call
          boost: 1,
        };
      });

    if (methodCompletions.length) {
      return {
        from: methodMatch.from + 1, // +1 to account for the dot
        options: methodCompletions,
        validFor: /^\w*$/,
      };
    }
  }

  // Return function name completions if any match
  if (completions.length) {
    return {
      from: functionMatch.from,
      options: completions,
      validFor: /^\w*$/,
    };
  }

  return null;
}

// Set on the editor while files are dragged over it (styles.css)
const FILE_DROP_CLASS = "cm-file-drop-target";

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * Hand files dropped anywhere on the editor, gutter included, to
 * `handler({ files, pos })`, with the document position under the pointer.
 * The listeners capture the events before CodeMirror sees them, and
 * CodeMirror leaves handled events alone, so it doesn't paste the files' text.
 * Returns a function that stops it.
 */
function watchFileDrops(view, handler) {
  const target = view.dom;
  let clearTimer = null;
  const unmark = () => {
    clearTimeout(clearTimer);
    target.classList.remove(FILE_DROP_CLASS);
  };
  const onDragOver = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    target.classList.add(FILE_DROP_CLASS);
    // dragleave also fires between the editor's own elements, so the mark
    // goes once the dragover events stop
    clearTimeout(clearTimer);
    clearTimer = setTimeout(unmark, 150);
  };
  const onDrop = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    unmark();
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
    handler({ files: Array.from(event.dataTransfer.files), pos });
  };
  target.addEventListener("dragover", onDragOver, true);
  target.addEventListener("drop", onDrop, true);
  return () => {
    unmark();
    target.removeEventListener("dragover", onDragOver, true);
    target.removeEventListener("drop", onDrop, true);
  };
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
      run: startCompletion,
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
    return themeMapping.default;
  }

  // Create initial editor state
  const startState = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      // Our custom Ctrl+Enter keymap comes first for highest priority
      ctrlEnterKeymap,
      history(), // Add history extension
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
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
        closeOnBlur: true,
      }),
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
    // Take files dropped on the editor instead of pasting them (the desktop
    // app's media drops). Returns a function that stops it.
    handleFileDrops: (handler) => watchFileDrops(view, handler),
    // Put lines of code near `pos`, where they don't split a statement
    insertLines: (pos, lines) => view.dispatch(insertLines(view.state, pos, lines)),
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
