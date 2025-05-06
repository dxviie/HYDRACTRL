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
  // Keyword groups with different colors
  const KEYWORD_GROUPS = {
    // Core generator functions - magenta
    CORE: [
      'osc', 'noise', 'voronoi', 'shape', 'gradient', 'src', 'solid'
    ],
    
    // Color operations - orange
    COLOR: [
      'color', 'colorama', 'saturate', 'hue', 'brightness', 'contrast', 'invert'
    ],
    
    // Geometry operations - green
    GEOMETRY: [
      'rotate', 'repeat', 'repeatX', 'repeatY', 'kaleid', 'pixelate', 'scale'
    ],
    
    // Modulation and blending - cyan
    MODULATION: [
      'modulate', 'modulatePixelate', 'modulateRotate', 'modulateScale', 'modulateKaleid',
      'blend', 'mult', 'add', 'diff', 'mask', 'thresh'
    ],
    
    // Output and system functions - yellow
    OUTPUT: [
      'out', 'render', 'hush', 'setFunction', 'setResolution',
      'setBins', 'fft'
    ],
    
    // P5 related - light blue
    P5: [
      'draw', 'setup', 'mousePressed', 'mouseReleased', 'mouseMoved'
    ],
    
    // JavaScript keywords - pink
    JS_KEYWORDS: [
      'function', 'return', 'if', 'else', 'for', 'while', 'let', 'const', 'var',
      'true', 'false', 'null', 'undefined', 'new', 'this', 'class', 'extends',
      'import', 'export', 'from', 'await', 'async'
    ]
  };
  
  // Create flat keywords array for pattern matching
  const KEYWORDS = Object.values(KEYWORD_GROUPS).flat();
  
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
    
    // First, escape HTML special characters
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Tokenize the code for proper highlighting without overlap
    // This safer approach prevents nested span issues
    const tokens = [];
    
    // Add comment tokens
    const commentRegex = /(\/\/.*?$|\/\*[\s\S]*?\*\/)/gm;
    let lastIndex = 0;
    let match;
    
    while ((match = commentRegex.exec(html)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({
          type: 'text',
          content: html.substring(lastIndex, match.index)
        });
      }
      
      tokens.push({
        type: 'comment',
        content: match[0]
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < html.length) {
      tokens.push({
        type: 'text',
        content: html.substring(lastIndex)
      });
    }
    
    // Process each token
    let processedHtml = '';
    for (const token of tokens) {
      if (token.type === 'comment') {
        processedHtml += `<span style="color: #6272a4;">${token.content}</span>`;
      } else {
        // Process non-comment text
        let content = token.content;
        
        // Highlight strings
        content = content.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, 
          match => `<span style="color: #f1fa8c;">${match}</span>`);
        
        // Highlight numbers
        content = content.replace(/\b(\d+(?:\.\d+)?)\b/g, 
          match => `<span style="color: #bd93f9;">${match}</span>`);
        
        // Core generator functions - magenta
        content = content.replace(
          new RegExp(`\\b(${KEYWORD_GROUPS.CORE.join('|')})\\b`, 'g'), 
          match => `<span style="color: #ff79c6;">${match}</span>`
        );
        
        // Color operations - orange
        content = content.replace(
          new RegExp(`\\b(${KEYWORD_GROUPS.COLOR.join('|')})\\b`, 'g'), 
          match => `<span style="color: #ffb86c;">${match}</span>`
        );
        
        // Geometry operations - green
        content = content.replace(
          new RegExp(`\\b(${KEYWORD_GROUPS.GEOMETRY.join('|')})\\b`, 'g'), 
          match => `<span style="color: #50fa7b;">${match}</span>`
        );
        
        // Modulation and blending - cyan
        content = content.replace(
          new RegExp(`\\b(${KEYWORD_GROUPS.MODULATION.join('|')})\\b`, 'g'), 
          match => `<span style="color: #8be9fd;">${match}</span>`
        );
        
        // Output and system functions - yellow
        content = content.replace(
          new RegExp(`\\b(${KEYWORD_GROUPS.OUTPUT.join('|')})\\b`, 'g'), 
          match => `<span style="color: #f1fa8c;">${match}</span>`
        );
        
        // P5 related - light blue
        content = content.replace(
          new RegExp(`\\b(${KEYWORD_GROUPS.P5.join('|')})\\b`, 'g'), 
          match => `<span style="color: #9fd3ff;">${match}</span>`
        );
        
        // JavaScript keywords - pink
        content = content.replace(
          new RegExp(`\\b(${KEYWORD_GROUPS.JS_KEYWORDS.join('|')})\\b`, 'g'), 
          match => `<span style="color: #ff79c6;">${match}</span>`
        );
        
        // Highlight methods (functions called with dot notation)
        content = content.replace(/\.(\w+)(?=\s*\()/g, 
          match => `<span style="color: #50fa7b;">${match}</span>`);
        
        // Highlight variable declarations
        content = content.replace(/\b(const|let|var)\s+(\w+)\b/g, 
          (match, keyword, variable) => 
            `<span style="color: #ff79c6;">${keyword}</span> <span style="color: #f8f8f2;">${variable}</span>`);
        
        processedHtml += content;
      }
    }
    
    // Apply highlighting
    code.innerHTML = processedHtml;
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