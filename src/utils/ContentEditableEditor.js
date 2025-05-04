/**
 * ContentEditable Editor with Syntax Highlighting for Hydra
 * A lightweight approach using a textarea and a pre element
 */

// Define Hydra syntax keywords by category
const KEYWORDS = {
  // Core functions (pink)
  CORE: [
    'osc', 'solid', 'gradient', 'voronoi', 'noise', 'shape', 
    'src', 'render', 'update', 'setResolution', 'hush', 'out'
  ],
  
  // Transformation/effect functions (green)
  TRANSFORM: [
    'add', 'mult', 'blend', 'diff', 'mask', 'modulateRepeat', 
    'repeatX', 'repeatY', 'kaleid', 'scrollX', 'scrollY',
    'pixelate', 'posterize', 'shift', 'invert', 'contrast', 
    'brightness', 'luma', 'thresh', 'color', 'saturate', 
    'rotate', 'scale', 'modulate', 'modulateScale', 'modulatePixelate',
    'modulateRotate', 'modulateHue'
  ],
  
  // Math functions and operators (cyan)
  MATH: [
    'sin', 'cos', 'tan', 'abs', 'floor', 'ceil', 'fract',
    'sqrt', 'pow', 'exp', 'log', 'random', 'PI', 'time', 'mouse'
  ],
  
  // Control flow (red)
  CONTROL: [
    'if', 'else', 'for', 'while', 'function', 'return'
  ],
  
  // JavaScript keywords (purple)
  JS: [
    'var', 'let', 'const', 'true', 'false', 'null', 
    'undefined', 'new', 'this', 'class', 'extends', 'super', 
    'async', 'await', 'try', 'catch', 'finally', 'throw',
    'typeof', 'instanceof'
  ]
};

/**
 * Create a basic syntax highlighted editor using the textarea + pre approach
 * @param {HTMLElement} container - Container to add the editor to
 * @param {string} initialCode - Initial code to display
 * @returns {Object} Editor object with API methods
 */
export function createEditor(container, initialCode = '') {
  // Create wrapper for relative positioning
  const editorWrapper = document.createElement('div');
  editorWrapper.className = 'hydra-editor-wrapper';
  editorWrapper.style.width = '100%';
  editorWrapper.style.height = '100%';
  editorWrapper.style.position = 'relative';
  
  // Create the pre element for highlighting
  const preElement = document.createElement('pre');
  preElement.className = 'hydra-editor-highlighting';
  preElement.style.position = 'absolute';
  preElement.style.top = '0';
  preElement.style.left = '0';
  preElement.style.width = '100%';
  preElement.style.height = '100%';
  preElement.style.overflow = 'auto';
  preElement.style.margin = '0';
  preElement.style.padding = '8px';
  preElement.style.fontFamily = 'monospace';
  preElement.style.fontSize = '14px';
  preElement.style.backgroundColor = 'transparent';
  preElement.style.pointerEvents = 'none';
  preElement.style.zIndex = '0';
  preElement.style.whiteSpace = 'pre-wrap';
  preElement.style.wordWrap = 'break-word';
  preElement.style.color = '#f8f8f2';
  
  // Create textarea for input
  const textarea = document.createElement('textarea');
  textarea.className = 'hydra-editor-textarea';
  textarea.value = initialCode;
  textarea.spellcheck = false;
  textarea.autocapitalize = 'off';
  textarea.autocomplete = 'off';
  textarea.style.position = 'absolute';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '100%';
  textarea.style.height = '100%';
  textarea.style.padding = '8px';
  textarea.style.fontFamily = 'monospace';
  textarea.style.fontSize = '14px';
  textarea.style.backgroundColor = 'transparent';
  textarea.style.color = 'transparent';
  textarea.style.caretColor = '#fff';
  textarea.style.resize = 'none';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.zIndex = '1';
  textarea.style.overflow = 'auto';
  
  // Add the elements to the wrapper and container
  editorWrapper.appendChild(preElement);
  editorWrapper.appendChild(textarea);
  container.appendChild(editorWrapper);
  
  // Function to update the highlighting
  function updateHighlighting() {
    const code = textarea.value;
    const html = highlightSyntax(code);
    preElement.innerHTML = html;
    
    // Sync scroll positions
    preElement.scrollTop = textarea.scrollTop;
    preElement.scrollLeft = textarea.scrollLeft;
  }
  
  // Apply initial highlighting
  updateHighlighting();
  
  // Setup event listeners
  textarea.addEventListener('input', updateHighlighting);
  textarea.addEventListener('scroll', () => {
    preElement.scrollTop = textarea.scrollTop;
    preElement.scrollLeft = textarea.scrollLeft;
  });
  
  // Handle tab key for indentation
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      // Insert spaces instead of tab
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      textarea.value = 
        textarea.value.substring(0, start) + 
        '  ' + 
        textarea.value.substring(end);
      
      // Move cursor after inserted spaces
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      
      // Update highlighting
      updateHighlighting();
    }
  });
  
  // Return editor API
  return {
    getCode: () => textarea.value,
    setCode: (code) => {
      textarea.value = code;
      updateHighlighting();
    },
    focus: () => textarea.focus(),
    element: textarea
  };
}

/**
 * Very simple syntax highlighter for Hydra code
 * @param {string} code - Code to highlight
 * @returns {string} HTML with syntax highlighting
 */
function highlightSyntax(code) {
  // If no code, return empty string
  if (!code) return '';
  
  // Escape HTML
  let htmlEscaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Process strings and comments first
  htmlEscaped = htmlEscaped
    // Single line comments
    .replace(/(\/\/[^\n]*)/g, '<span class="hydra-comment">$1</span>')
    // Strings
    .replace(/(["'])((?:\\.|[^\\])*?)(\1)/g, '<span class="hydra-string">$1$2$3</span>')
    // Numbers
    .replace(/\b(\d+(\.\d+)?)\b/g, '<span class="hydra-number">$1</span>');
  
  // Process dots followed by transform functions
  KEYWORDS.TRANSFORM.forEach(word => {
    const regex = new RegExp('\\.' + word + '\\b', 'g');
    htmlEscaped = htmlEscaped.replace(regex, '.<span class="hydra-transform">' + word + '</span>');
  });
  
  // Process core functions
  KEYWORDS.CORE.forEach(word => {
    const regex = new RegExp('\\b' + word + '\\b', 'g');
    htmlEscaped = htmlEscaped.replace(regex, '<span class="hydra-core">' + word + '</span>');
  });
  
  // Process math functions
  KEYWORDS.MATH.forEach(word => {
    const regex = new RegExp('\\b' + word + '\\b', 'g');
    htmlEscaped = htmlEscaped.replace(regex, '<span class="hydra-math">' + word + '</span>');
  });
  
  // Process control flow
  KEYWORDS.CONTROL.forEach(word => {
    const regex = new RegExp('\\b' + word + '\\b', 'g');
    htmlEscaped = htmlEscaped.replace(regex, '<span class="hydra-control">' + word + '</span>');
  });
  
  // Process JavaScript keywords
  KEYWORDS.JS.forEach(word => {
    const regex = new RegExp('\\b' + word + '\\b', 'g');
    htmlEscaped = htmlEscaped.replace(regex, '<span class="hydra-keyword">' + word + '</span>');
  });
  
  // Process brackets and semicolons
  htmlEscaped = htmlEscaped
    .replace(/([(){}[\]])/g, '<span class="hydra-bracket">$1</span>')
    .replace(/;/g, '<span class="hydra-semicolon">;</span>');
  
  return htmlEscaped;
}