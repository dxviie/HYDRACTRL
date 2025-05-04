/**
 * Monaco Editor for Hydra
 * Uses the powerful Monaco Editor to provide advanced features like syntax highlighting
 */

// Import Monaco Editor
import * as monaco from 'monaco-editor';

// Define custom Hydra language
function registerHydraLanguage() {
  // Register a new language
  monaco.languages.register({ id: 'hydra' });

  // Register a tokens provider for the language
  monaco.languages.setMonarchTokensProvider('hydra', {
    // Set defaultToken to invalid to see what you do not tokenize yet
    defaultToken: 'invalid',

    // Hydra-specific keywords
    keywords: [
      'var', 'let', 'const', 'if', 'else', 'for', 'while', 'function', 'return',
      'true', 'false', 'null', 'undefined', 'new', 'this', 'class', 'extends',
      'super', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof',
      'instanceof'
    ],

    // Hydra-specific functions
    hydraCoreFunctions: [
      'osc', 'solid', 'gradient', 'voronoi', 'noise', 'shape', 
      'src', 'render', 'update', 'setResolution', 'hush', 'out'
    ],

    hydraTransformFunctions: [
      'add', 'mult', 'blend', 'diff', 'mask', 'modulateRepeat', 
      'repeatX', 'repeatY', 'kaleid', 'scrollX', 'scrollY',
      'pixelate', 'posterize', 'shift', 'invert', 'contrast', 
      'brightness', 'luma', 'thresh', 'color', 'saturate', 
      'rotate', 'scale', 'modulate', 'modulateScale', 'modulatePixelate',
      'modulateRotate', 'modulateHue'
    ],

    // Hydra-specific math functions and values
    hydraMathFunctions: [
      'sin', 'cos', 'tan', 'abs', 'floor', 'ceil', 'fract',
      'sqrt', 'pow', 'exp', 'log', 'random', 'PI', 'time', 'mouse'
    ],

    operators: [
      '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
      '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
      '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
      '%=', '<<=', '>>=', '>>>='
    ],

    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    digits: /\d+(_+\d+)*/,
    octaldigits: /[0-7]+(_+[0-7]+)*/,
    binarydigits: /[0-1]+(_+[0-1]+)*/,
    hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,

    // The main tokenizer
    tokenizer: {
      root: [
        // Dot notation for transforms
        [/(\.)([a-zA-Z]\w*)/, ['delimiter', { 
          cases: { 
            '@hydraTransformFunctions': 'function.transform',
            '@default': 'identifier' 
          } 
        }]],

        // Core hydra functions
        [/[a-zA-Z][\w$]*/, { 
          cases: { 
            '@hydraCoreFunctions': 'function.core',
            '@hydraMathFunctions': 'function.math',
            '@keywords': 'keyword',
            '@default': 'identifier' 
          } 
        }],

        // Identifiers and keywords
        [/[a-zA-Z_$][\w$]*/, { 
          cases: { 
            '@keywords': 'keyword',
            '@default': 'identifier' 
          } 
        }],

        // Whitespace
        { include: '@whitespace' },

        // Numbers
        [/(@digits)[eE]([\-+]?(@digits))?/, 'number.float'],
        [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, 'number.float'],
        [/0[xX](@hexdigits)/, 'number.hex'],
        [/0[oO]?(@octaldigits)/, 'number.octal'],
        [/0[bB](@binarydigits)/, 'number.binary'],
        [/(@digits)/, 'number'],

        // Delimiters and operators
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, { 
          cases: { 
            '@operators': 'operator',
            '@default': '' 
          } 
        }],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
        [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\*\*(?!\/)/, 'comment.doc', '@jsdoc'],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],

      jsdoc: [
        [/[^\/*]+/, 'comment.doc'],
        [/\*\//, 'comment.doc', '@pop'],
        [/[\/*]/, 'comment.doc']
      ],

      string_double: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop']
      ],

      string_single: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, 'string', '@pop']
      ],
    }
  });

  // Define a custom theme
  monaco.editor.defineTheme('hydra-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'function.core', foreground: 'ff79c6' },        // Pink
      { token: 'function.transform', foreground: '50fa7b' },   // Green
      { token: 'function.math', foreground: '8be9fd' },        // Cyan
      { token: 'keyword', foreground: 'bd93f9', fontStyle: 'bold' }, // Purple
      { token: 'number', foreground: 'bd93f9' },               // Purple
      { token: 'string', foreground: 'f1fa8c' },               // Yellow
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' }, // Grey-blue
      { token: 'operator', foreground: 'ff79c6' },             // Pink
      { token: 'delimiter', foreground: 'f8f8f2' },            // Light grey
    ],
    colors: {
      'editor.background': '#282a3677',             // Semi-transparent background
      'editor.foreground': '#f8f8f2',               // Light foreground
      'editorCursor.foreground': '#f8f8f2',         // Light cursor
      'editor.lineHighlightBackground': '#44475a80',// Subtle line highlight
      'editorLineNumber.foreground': '#6272a4',     // Grey-blue line numbers
      'editor.selectionBackground': '#44475a',      // Selection
      'editor.inactiveSelectionBackground': '#44475a80', // Inactive selection
    }
  });
}

/**
 * Create a Monaco-based editor for Hydra code
 * @param {HTMLElement} container - The container to add the editor to
 * @param {string} initialCode - Initial code to display
 * @returns {Object} Editor object with methods to get/set code
 */
export function createMonacoEditor(container, initialCode = '') {
  // Initialize the Hydra language
  registerHydraLanguage();
  
  // Create a wrapper div to hold the Monaco editor
  const editorContainer = document.createElement('div');
  editorContainer.className = 'monaco-editor-container';
  editorContainer.style.width = '100%';
  editorContainer.style.height = '100%';
  
  // Add to container
  container.appendChild(editorContainer);
  
  // Create Monaco editor
  const editor = monaco.editor.create(editorContainer, {
    value: initialCode,
    language: 'hydra',
    theme: 'hydra-dark',
    tabSize: 2,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    contextmenu: true,
    fontSize: 14,
    lineNumbers: 'on',
    scrollbar: {
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      vertical: 'auto',
      horizontal: 'auto'
    },
    renderWhitespace: 'none',
    renderLineHighlight: 'line',
    fontFamily: 'monospace',
    fontLigatures: false,
    lineHeight: 20,
    letterSpacing: 0.5,
    cursorBlinking: 'blink',
    cursorStyle: 'line',
    cursorWidth: 2,
    // These options can help with cursor visibility
    hideCursorInOverviewRuler: false,
    overviewRulerBorder: false,
    renderValidationDecorations: 'on',
  });

  // Force an initial focus/blur to ensure cursor state is initialized properly
  setTimeout(() => {
    editor.focus();
    
    // Add a special class to help with cursor styling
    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.classList.add('hydra-monaco-editor');
    }
    
    // Force cursor to be visible initially
    editor.trigger('keyboard', 'cursorHome', null);
    editor.trigger('keyboard', 'cursorEnd', null);
  }, 100);
  
  // Create our API
  return {
    getCode: () => editor.getValue(),
    setCode: (code) => {
      editor.setValue(code);
      // Re-focus and make cursor visible when code is set
      setTimeout(() => {
        editor.focus();
        editor.setPosition({lineNumber: 1, column: 1});
      }, 10);
    },
    focus: () => {
      editor.focus();
      // Trigger cursor movement to make it visible
      const model = editor.getModel();
      if (model) {
        const lastLine = model.getLineCount();
        const lastColumn = model.getLineMaxColumn(lastLine);
        editor.setPosition({lineNumber: lastLine, column: lastColumn});
        editor.revealPosition({lineNumber: lastLine, column: lastColumn});
      }
    },
    dispose: () => editor.dispose(),
    editor: editor // expose the Monaco editor instance
  };
}