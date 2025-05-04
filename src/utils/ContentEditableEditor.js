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
 * Create a super simple editor without complex highlighting
 * Just using CSS custom styling for a basic appearance
 * @param {HTMLElement} container - The container to add the editor to
 * @param {string} initialCode - Initial code to display
 * @returns {Object} Editor API
 */
export function createEditor(container, initialCode = '') {
  const textarea = document.createElement('textarea');
  textarea.className = 'hydra-editor';
  textarea.value = initialCode;
  textarea.spellcheck = false;
  textarea.autocapitalize = 'off';
  textarea.autocomplete = 'off';
  
  // Apply base styles
  textarea.style.width = '100%';
  textarea.style.height = '100%';
  textarea.style.backgroundColor = 'rgba(40, 42, 54, 0.7)';
  textarea.style.color = '#f8f8f2';
  textarea.style.fontFamily = 'monospace';
  textarea.style.fontSize = '14px';
  textarea.style.padding = '8px';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.resize = 'none';
  textarea.style.lineHeight = '1.4';
  textarea.style.overflow = 'auto';
  
  // Add to container
  container.appendChild(textarea);
  
  // Handle tab key for indentation
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      // Insert 2 spaces instead of tab
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      textarea.value = 
        textarea.value.substring(0, start) + 
        '  ' + 
        textarea.value.substring(end);
      
      // Move cursor after inserted spaces
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    }
  });
  
  // Return simple editor API
  return {
    getCode: () => textarea.value,
    setCode: (code) => {
      textarea.value = code;
    },
    focus: () => textarea.focus(),
    element: textarea
  };
}