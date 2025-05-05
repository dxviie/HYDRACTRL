/**
 * Syntax Highlighting Editor for Hydra code
 * Uses the contenteditable approach with real-time syntax highlighting
 */

/**
 * Create a syntax highlighted editor for Hydra code
 * @param {HTMLElement} container - Container to add the editor to
 * @param {string} initialCode - Initial code to display
 * @returns {Object} Editor object with API methods
 */
export function createSyntaxEditor(container, initialCode = '') {
  // Hydra keywords and functions to highlight
  const KEYWORDS = [
    // Core functions
    'osc', 'noise', 'voronoi', 'shape', 'gradient', 'src', 'solid',
    // Color operations
    'color', 'colorama', 'saturate', 'hue', 'brightness', 'contrast', 'invert',
    // Geometry operations
    'rotate', 'repeat', 'repeatX', 'repeatY', 'kaleid', 'pixelate', 'scale',
    // Modulation and blending
    'modulate', 'modulatePixelate', 'modulateRotate', 'modulateScale', 'modulateKaleid',
    'blend', 'mult', 'add', 'diff', 'mask', 'thresh',
    // Output
    'out', 'render', 'hush', 'setFunction', 'setResolution',
    // Audio
    'setBins', 'fft',
    // P5 related
    'draw', 'setup', 'mousePressed', 'mouseReleased', 'mouseMoved',
    // JavaScript constructs
    'function', 'return', 'if', 'else', 'for', 'while', 'let', 'const', 'var',
    'true', 'false', 'null', 'undefined', 'new', 'this', 'class', 'extends',
    'import', 'export', 'from', 'await', 'async'
  ];
  
  // Create editor container
  const editor = document.createElement('div');
  editor.className = 'hydra-editor-container';
  editor.style.width = '100%';
  editor.style.height = '100%';
  editor.style.position = 'relative';
  editor.style.overflow = 'auto';
  
  // Create pre and code elements for highlighting
  const pre = document.createElement('pre');
  pre.className = 'hydra-editor-pre';
  pre.style.margin = '0';
  pre.style.width = '100%';
  pre.style.height = '100%';
  pre.style.backgroundColor = 'rgba(40, 42, 54, 0.7)';
  pre.style.color = '#f8f8f2';
  pre.style.fontFamily = 'monospace';
  pre.style.fontSize = '14px';
  pre.style.padding = '8px';
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.wordWrap = 'break-word';
  pre.style.overflow = 'visible';
  pre.style.outline = 'none';
  pre.style.boxSizing = 'border-box';
  pre.style.tabSize = '2';
  pre.style.lineHeight = '1.5';
  
  const code = document.createElement('code');
  code.className = 'hydra-editor-code';
  code.style.position = 'relative';
  code.style.display = 'block';
  
  // Create editable content div on top
  const editable = document.createElement('div');
  editable.className = 'hydra-editor-editable';
  editable.contentEditable = 'true';
  editable.spellcheck = false;
  editable.autocapitalize = 'off';
  editable.autocomplete = 'off';
  editable.style.position = 'absolute';
  editable.style.top = '0';
  editable.style.left = '0';
  editable.style.width = '100%';
  editable.style.height = '100%';
  editable.style.backgroundColor = 'transparent';
  editable.style.color = 'transparent';
  editable.style.fontFamily = 'monospace';
  editable.style.fontSize = '14px';
  editable.style.padding = '8px';
  editable.style.margin = '0';
  editable.style.caretColor = '#f8f8f2'; // Show caret in text color
  editable.style.outline = 'none';
  editable.style.whiteSpace = 'pre-wrap';
  editable.style.wordWrap = 'break-word';
  editable.style.boxSizing = 'border-box';
  editable.style.tabSize = '2';
  editable.style.lineHeight = '1.5';
  editable.style.zIndex = '1';
  
  // Assemble the editor
  pre.appendChild(code);
  editor.appendChild(pre);
  editor.appendChild(editable);
  container.appendChild(editor);
  
  // Set initial content
  editable.textContent = initialCode;
  updateHighlighting();
  
  // Function to update syntax highlighting
  function updateHighlighting() {
    const text = editable.textContent || '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Highlight strings
    html = html.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, 
      match => `<span style="color: #f1fa8c;">${match}</span>`);
    
    // Highlight numbers
    html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, 
      match => `<span style="color: #bd93f9;">${match}</span>`);
    
    // Highlight comments (both // and /* */)
    html = html.replace(/(\/\/.*?$|\/\*[\s\S]*?\*\/)/gm, 
      match => `<span style="color: #6272a4;">${match}</span>`);
    
    // Highlight keywords
    const keywordPattern = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'g');
    html = html.replace(keywordPattern, 
      match => `<span style="color: #ff79c6;">${match}</span>`);
    
    // Highlight methods (functions called with dot notation)
    html = html.replace(/\.(\w+)(?=\s*\()/g, 
      match => `<span style="color: #50fa7b;">${match}</span>`);
    
    // Highlight variable declarations
    html = html.replace(/\b(const|let|var)\s+(\w+)\b/g, 
      (match, keyword, variable) => 
        `<span style="color: #ff79c6;">${keyword}</span> <span style="color: #f8f8f2;">${variable}</span>`);
    
    // Apply highlighting
    code.innerHTML = html;
  }
  
  // Handle input events for real-time highlighting
  editable.addEventListener('input', () => {
    updateHighlighting();
  });
  
  // Handle tab key for indentation
  editable.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      // Insert 2 spaces
      document.execCommand('insertText', false, '  ');
    }
  });
  
  // Ensure consistent pasting (as plain text)
  editable.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  
  // Return API
  return {
    getCode: () => editable.textContent,
    setCode: (code) => {
      editable.textContent = code;
      updateHighlighting();
    },
    focus: () => editable.focus(),
    element: editor
  };
}