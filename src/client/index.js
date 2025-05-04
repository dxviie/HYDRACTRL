// Default starter code for Hydra
const DEFAULT_CODE = `// HYDRACTRL Sample

osc(10, 0.1, 1.2)
  .color(0.5, 0.1, 0.9)
  .rotate(0, 0.1)
  .modulateScale(osc(3, 0.2))
  .out()
`;

// Initialize a basic textarea editor instead of CodeMirror
function initEditor() {
  const editorContent = document.getElementById('editor-content');
  
  // Create a simple textarea with styles that mimic CodeMirror
  const textarea = document.createElement('textarea');
  textarea.value = DEFAULT_CODE;
  textarea.style.width = '100%';
  textarea.style.height = '100%';
  textarea.style.boxSizing = 'border-box';
  textarea.style.padding = '8px';
  textarea.style.fontFamily = 'monospace';
  textarea.style.fontSize = '14px';
  textarea.style.color = '#f8f8f2';
  textarea.style.backgroundColor = 'transparent';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.resize = 'none';
  
  editorContent.appendChild(textarea);
  
  // Make the editor draggable
  makeDraggable(document.getElementById('editor-container'), document.getElementById('editor-handle'));
  
  // Create a simple editor object that mimics the CodeMirror API
  return {
    state: {
      doc: {
        toString: () => textarea.value
      }
    },
    dispatch: ({ changes }) => {
      if (changes && changes.insert) {
        // For loadCode functionality
        textarea.value = changes.insert;
      }
    }
  };
}

// Function to make an element draggable
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  if (handle) {
    // If handle is specified, use it for dragging
    handle.onmousedown = dragMouseDown;
  } else {
    // Otherwise, use the entire element
    element.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call function whenever the cursor moves
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // Calculate new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Polyfill for Node.js 'global' that hydra-synth expects in the browser environment
if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  window.global = window;
}

// Check for WebGL support
function isWebGLSupported() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && 
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch(e) {
    return false;
  }
}

// Initialize Hydra with proper canvas setup
async function initHydra() {
  try {
    // Check WebGL support first
    if (!isWebGLSupported()) {
      throw new Error("WebGL is not supported in your browser");
    }
    
    // Get or create the canvas element
    let canvasContainer = document.getElementById('hydra-canvas');
    let canvas = document.createElement('canvas');
    canvas.width = canvasContainer.clientWidth || 500;
    canvas.height = canvasContainer.clientHeight || 400;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);
    
    // Ensure we have the buffer ready for WebGL to use
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Dynamically import hydra-synth
    const hydraModule = await import('hydra-synth');
    const HydraSynth = hydraModule.default || hydraModule;
    
    // Create a new hydra instance with explicit canvas reference
    const hydra = new HydraSynth({
      canvas: canvas,
      detectAudio: false,
      enableStreamCapture: false
    });
    
    return hydra;
  } catch (error) {
    console.error("Error initializing Hydra:", error);
    throw error; // Re-throw to handle in the calling function
  }
}

// Run hydra code
function runCode(editor, hydra) {
  try {
    // Get code from editor
    const code = editor.state.doc.toString();
    
    // Clear any previous errors
    console.clear();
    
    // Clear canvas by resetting default outputs
    hydra.hush();
    
    // Create a function to execute the code with hydra in scope
    const fn = new Function('hydra', `
      // Set global h variable to hydra for convenience
      window.h = hydra;
      // Make hydra functions available in global scope
      Object.keys(hydra).forEach(key => {
        if (typeof hydra[key] === 'function' && key !== 'eval') {
          window[key] = hydra[key].bind(hydra);
        }
      });
      
      // Execute the user's code
      try {
        ${code}
      } catch(e) {
        console.error('Error in Hydra code:', e);
      }
    `);
    
    // Execute the function with hydra as parameter
    fn(hydra);
    
    console.log("Hydra code executed successfully");
  } catch (error) {
    console.error('Error running Hydra code:', error);
  }
}

// Toggle editor visibility
function toggleEditor() {
  const editorContainer = document.getElementById('editor-container');
  const isVisible = editorContainer.style.display !== 'none';
  editorContainer.style.display = isVisible ? 'none' : 'block';
}

// Save code to local storage
function saveCode(editor) {
  const code = editor.state.doc.toString();
  localStorage.setItem('hydractrl-code', code);
  alert('Code saved!');
}

// Load code from local storage
function loadCode(editor) {
  const savedCode = localStorage.getItem('hydractrl-code');
  if (savedCode) {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: savedCode }
    });
  }
}

// Initialize the application
async function init() {
  try {
    const editor = initEditor(); // No longer async
    const hydra = await initHydra();
    
    // Set up event listeners
    document.getElementById('run-btn').addEventListener('click', () => runCode(editor, hydra));
    document.getElementById('save-btn').addEventListener('click', () => {
      saveCode(editor);
      alert('Code saved!');
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter or Cmd+Enter to run code
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode(editor, hydra);
      }
      
      // Ctrl+S or Cmd+S to save code
      if ((e.ctrlKey || e.metaKey) && e.key === 'S') {
        e.preventDefault();
        saveCode(editor);
        alert('Code saved!');
      }
      
      // ESC to toggle editor visibility
      if (e.key === 'Escape') {
        toggleEditor();
      }
    });
    
    // Load saved code if available
    loadCode(editor);
    
    // Run initial code
    runCode(editor, hydra);
  } catch (error) {
    console.error("Error initializing application:", error);
  }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
