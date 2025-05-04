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
  const editorContainer = document.getElementById('editor-container');
  
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
  textarea.style.backgroundColor = '#282a36';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.resize = 'none';
  
  editorContainer.appendChild(textarea);
  
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

// Toggle fullscreen for the preview
function toggleFullscreen() {
  const previewContainer = document.getElementById('hydra-canvas');
  previewContainer.classList.toggle('fullscreen');
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
    document.getElementById('save-btn').addEventListener('click', () => saveCode(editor));
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
    
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
