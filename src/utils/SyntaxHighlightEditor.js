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
  pre.style.whiteSpace = 'pre';
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
  editable.style.whiteSpace = 'pre';
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
    let safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Explicitly convert newlines to <br> tags for HTML rendering
    // This ensures line breaks are displayed the same in editable and highlighted views
    let processedHtml = '';
    const lines = safeText.split('\n');

    // Process each line separately for highlighting
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Handle empty lines - always add content for proper line height
      if (line.trim() === '') {
        processedHtml += '&nbsp;<br>';
        continue;
      }

      // Tokenize the current line
      const lineTokens = tokenizeLine(line);

      // Build HTML for this line
      for (const token of lineTokens) {
        if (token.type === 'plain') {
          processedHtml += token.text;
        } else {
          processedHtml += `<span style="color: ${token.color};">${token.text}</span>`;
        }
      }

      // Add line break after each line (even the last one to ensure proper spacing)
      processedHtml += '<br>';
    }

    // Apply highlighting
    code.innerHTML = processedHtml;
  }

  // Helper function to tokenize a single line of code
  function tokenizeLine(line) {
    // Define token types and their patterns
    const tokenTypes = [
      { type: 'comment', pattern: /(\/\/.*?$|\/\*[\s\S]*?\*\/)/g, color: '#6272a4' },
      { type: 'string', pattern: /(["'`])(?:(?=(\\?))\2.)*?\1/g, color: '#f1fa8c' },
      { type: 'number', pattern: /\b(\d+(?:\.\d+)?)\b/g, color: '#bd93f9' },
      { type: 'core', pattern: new RegExp(`\\b(${KEYWORD_GROUPS.CORE.join('|')})\\b`, 'g'), color: '#ff79c6' },
      { type: 'color', pattern: new RegExp(`\\b(${KEYWORD_GROUPS.COLOR.join('|')})\\b`, 'g'), color: '#ffb86c' },
      { type: 'geometry', pattern: new RegExp(`\\b(${KEYWORD_GROUPS.GEOMETRY.join('|')})\\b`, 'g'), color: '#50fa7b' },
      { type: 'modulation', pattern: new RegExp(`\\b(${KEYWORD_GROUPS.MODULATION.join('|')})\\b`, 'g'), color: '#8be9fd' },
      { type: 'output', pattern: new RegExp(`\\b(${KEYWORD_GROUPS.OUTPUT.join('|')})\\b`, 'g'), color: '#f1fa8c' },
      { type: 'p5', pattern: new RegExp(`\\b(${KEYWORD_GROUPS.P5.join('|')})\\b`, 'g'), color: '#9fd3ff' },
      { type: 'js', pattern: new RegExp(`\\b(${KEYWORD_GROUPS.JS_KEYWORDS.join('|')})\\b`, 'g'), color: '#ff79c6' },
      { type: 'method', pattern: /\.(\w+)(?=\s*\()/g, color: '#50fa7b' },
    ];

    // Get all token positions (may overlap)
    const allTokens = [];

    for (const tokenType of tokenTypes) {
      let match;
      // Reset lastIndex to ensure we start from the beginning of the line
      tokenType.pattern.lastIndex = 0;

      while ((match = tokenType.pattern.exec(line)) !== null) {
        allTokens.push({
          type: tokenType.type,
          color: tokenType.color,
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });
      }
    }

    // Sort tokens by start position
    allTokens.sort((a, b) => a.start - b.start);

    // Priority for token types when they overlap
    const tokenTypesPriority = {
      'comment': 10,
      'string': 9,
      'method': 8,
      'number': 7,
      'core': 6,
      'color': 5,
      'geometry': 4,
      'modulation': 3,
      'output': 2,
      'p5': 1,
      'js': 0
    };

    // Non-overlapping tokens
    const finalTokens = [];
    let nextAvailablePos = 0;

    // Filter out overlapping tokens based on priority
    for (let i = 0; i < allTokens.length; i++) {
      const token = allTokens[i];

      // Skip tokens that start before the next available position
      if (token.start < nextAvailablePos) continue;

      // Look ahead for overlapping tokens with higher priority
      let bestToken = token;
      let j = i + 1;

      while (j < allTokens.length && allTokens[j].start < token.end) {
        const nextToken = allTokens[j];

        // If this token starts at the same position and has higher priority, use it instead
        if (nextToken.start === token.start &&
          tokenTypesPriority[nextToken.type] > tokenTypesPriority[bestToken.type]) {
          bestToken = nextToken;
        }
        j++;
      }

      finalTokens.push(bestToken);
      nextAvailablePos = bestToken.end;
    }

    // Add any plain text between tokens
    let currentPos = 0;
    const resultTokens = [];

    for (const token of finalTokens) {
      // Add plain text before this token
      if (token.start > currentPos) {
        resultTokens.push({
          type: 'plain',
          text: line.substring(currentPos, token.start)
        });
      }

      // Add the token
      resultTokens.push(token);
      currentPos = token.end;
    }

    // Add any remaining plain text
    if (currentPos < line.length) {
      resultTokens.push({
        type: 'plain',
        text: line.substring(currentPos)
      });
    }

    return resultTokens;
  }

  // Handle input events for real-time highlighting
  editable.addEventListener('input', () => {
    updateHighlighting();
  });

  // Handle special keys for indentation and line breaks
  editable.addEventListener('keydown', (e) => {
    // Handle Tab key
    if (e.key === 'Tab') {
      e.preventDefault();

      // Insert 2 spaces
      document.execCommand('insertText', false, '  ');
    }

    // Handle Enter key to ensure proper line breaks
    if (e.key === 'Enter') {
      e.preventDefault();

      // Insert actual newline character in the editable content
      document.execCommand('insertText', false, '\n\r');

      // Create a direct interim update - simple but effective approach
      // This will be replaced by the full highlight update but gives immediate visual feedback
      const currentText = editable.textContent;
      const lines = currentText.split('\n\r');
      let simpleHtml = '';

      for (const line of lines) {
        if (line.trim() === '') {
          simpleHtml += '&nbsp;<br>';
        } else {
          simpleHtml += `${line}<br>`;
        }
      }

      // Apply this simple rendering immediately
      code.innerHTML = simpleHtml;

      // Then schedule the full syntax highlighting update
      requestAnimationFrame(() => {
        // Full update with syntax highlighting
        updateHighlighting();

        // In the next frame, handle scrolling
        requestAnimationFrame(() => {
          // Get the current selection after everything has updated
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Check if cursor position is out of view
            const editorRect = editor.getBoundingClientRect();
            if (rect.bottom > editorRect.bottom) {
              editor.scrollTop += rect.bottom - editorRect.bottom + 20; // Add some padding
            }
          }
        });
      });
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