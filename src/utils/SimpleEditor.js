/**
 * A simple, reliable editor for Hydra code
 * No complex syntax highlighting, just a clean interface
 */

/**
 * Create a simple editor for Hydra code
 * @param {HTMLElement} container - Container to add the editor to
 * @param {string} initialCode - Initial code to display
 * @returns {Object} Editor object with API methods
 */
export function createEditor(container, initialCode = '') {
  // Create a simple textarea with styling
  const textarea = document.createElement('textarea');
  textarea.className = 'hydra-editor';
  textarea.value = initialCode;
  textarea.spellcheck = false;
  textarea.autocapitalize = 'off';
  textarea.autocomplete = 'off';
  
  // Apply base styles directly
  textarea.style.width = '100%';
  textarea.style.height = '100%';
  textarea.style.backgroundColor = 'rgba(40, 42, 54, 0.7)'; // Semi-transparent background
  textarea.style.color = '#f8f8f2'; // Light text
  textarea.style.fontFamily = 'monospace';
  textarea.style.fontSize = '14px';
  textarea.style.padding = '8px';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.resize = 'none';
  textarea.style.lineHeight = '1.5';
  textarea.style.tabSize = '2';
  
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