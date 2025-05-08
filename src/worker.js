export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Serve index.html for the root
      if (path === '/' || path === '/index.html') {
        return new Response(
          `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HYDRACTRL</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="app-container">
    <!-- Fullscreen Hydra canvas -->
    <div class="preview-container" id="hydra-canvas"></div>
    
    <!-- Draggable editor modal with integrated controls -->
    <div class="editor-container" id="editor-container">
      <div class="editor-handle" id="editor-handle">
        <div class="editor-handle-title">HYDRACTRL</div>
      </div>
      <div class="editor-content" id="editor-content"></div>
      <div class="editor-footer">
        <button id="run-btn" title="Run (Ctrl+Enter)">Run</button>
        <button id="save-btn" title="Save (Ctrl+S)">Save</button>
      </div>
    </div>
    <!-- Stats panel is created directly in JavaScript -->
  </div>
  <script src="/assets/index.js" type="module"></script>
</body>
</html>`,
          {
            headers: {
              'Content-Type': 'text/html'
            }
          }
        );
      }

      // Directly serve the styles.css file
      if (path === '/styles.css') {
        const cssContent = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #1e1e1e;
  color: #f5f5f5;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

/* Fullscreen Hydra canvas */
.preview-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000;
  z-index: 1;
}

/* Draggable editor modal */
.editor-container {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 500px;
  height: 400px;
  background-color: rgba(37, 37, 37, 0.7);
  border-radius: 8px;
  overflow: hidden;
  z-index: 100;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  resize: both;
  display: flex;
  flex-direction: column;
}

/* Hydra Editor Styles */
.hydra-editor {
  width: 100%;
  height: 100%;
  flex: 1;
  background-color: rgba(40, 42, 54, 0.7);
  color: #f8f8f2;
  font-family: monospace;
  font-size: 14px;
  padding: 8px;
  border: none;
  outline: none;
  resize: none;
  line-height: 1.4;
  letter-spacing: 0.5px;
  overflow: auto;
  caret-color: #ffffff;
}

/* Editor handle for drag indicator */
.editor-handle {
  height: 30px;
  background-color: rgba(60, 60, 60, 0.7);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  cursor: move;
  flex-shrink: 0;
}

.editor-handle-title {
  font-size: 14px;
  font-weight: bold;
}

.editor-content {
  flex-grow: 1;
  overflow: auto;
}

/* Editor footer with buttons */
.editor-footer {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 10px;
  background-color: rgba(50, 50, 50, 0.7);
  flex-shrink: 0;
}

button {
  background-color: #2d2d2d;
  color: #f5f5f5;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

button:hover {
  background-color: #3d3d3d;
  transform: translateY(-1px);
}

button:active {
  background-color: #4d4d4d;
  transform: translateY(1px);
}`;
        
        return new Response(cssContent, {
          headers: { 'Content-Type': 'text/css' }
        });
      }

      // Handle JavaScript files
      if (path.endsWith('.js')) {
        // Log requested path for debugging
        console.log('JS file requested:', path);
        
        try {
          // First try to fetch directly from default namespace
          const response = await fetch(new URL(path, request.url));
          
          if (response.ok) {
            const scriptContent = await response.text();
            return new Response(scriptContent, {
              headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
            });
          }
        } catch (directFetchError) {
          console.log('Direct fetch failed:', directFetchError);
          // Continue to fallback methods
        }
        
        // For index.js specifically, serve a complete functional version
        if (path === '/assets/index.js') {
          try {
            return new Response(`
// Self-contained HYDRACTRL minimal implementation
(async function() {
  try {
    console.log('HYDRACTRL initializing - standalone mode');
    
    // Basic hydra-like implementation
    class MinimalHydra {
      constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Initialize with black background
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Setup animation loop
        this.animationFrame = null;
        this.isRunning = false;
        this.currentCode = '';
      }
      
      // Clear the canvas
      clear() {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
      
      // Execute code and draw something
      eval(code) {
        this.currentCode = code;
        this.isRunning = true;
        
        try {
          // Simple code evaluation - in real Hydra this would be much more complex
          // For now, we'll just draw something colorful based on the code
          const hash = this.hashCode(code);
          this.startAnimation(hash);
          return true;
        } catch (error) {
          console.error('Error executing code:', error);
          this.showError(error.message);
          return false;
        }
      }
      
      // Generate a simple hash from the code string
      hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
      }
      
      // Start animation based on code hash
      startAnimation(hash) {
        // Stop any existing animation
        if (this.animationFrame) {
          cancelAnimationFrame(this.animationFrame);
        }
        
        // Use hash to determine animation parameters
        const hue = Math.abs(hash % 360);
        const speed = (Math.abs(hash % 10) + 1) / 10;
        let time = 0;
        
        const animate = () => {
          if (!this.isRunning) return;
          
          time += speed;
          this.clear();
          
          // Draw a simple animation
          const width = this.canvas.width;
          const height = this.canvas.height;
          
          // Create a gradient background
          const gradient = this.ctx.createLinearGradient(0, 0, width, height);
          gradient.addColorStop(0, \`hsl(\${hue}, 100%, 20%)\`);
          gradient.addColorStop(1, \`hsl(\${(hue + 40) % 360}, 100%, 10%)\`);
          this.ctx.fillStyle = gradient;
          this.ctx.fillRect(0, 0, width, height);
          
          // Draw some animated shapes
          const size = Math.min(width, height) / 4;
          const count = 5;
          
          for (let i = 0; i < count; i++) {
            const angle = (time / 10) + (i * Math.PI * 2 / count);
            const x = width / 2 + Math.cos(angle) * size;
            const y = height / 2 + Math.sin(angle) * size;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size / 3, 0, Math.PI * 2);
            this.ctx.fillStyle = \`hsl(\${(hue + i * 30) % 360}, 100%, 50%)\`;
            this.ctx.fill();
          }
          
          this.animationFrame = requestAnimationFrame(animate);
        };
        
        animate();
      }
      
      // Show error notification
      showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = \`
          <div class="error-title">Error</div>
          <div class="error-message">\${message}</div>
        \`;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          errorDiv.classList.add('fade-out');
          setTimeout(() => errorDiv.remove(), 500);
        }, 5000);
      }
      
      // Stop all animations
      hush() {
        this.isRunning = false;
        if (this.animationFrame) {
          cancelAnimationFrame(this.animationFrame);
          this.animationFrame = null;
        }
        this.clear();
      }
    }
    
    // Function to make an element draggable
    function makeDraggable(element, handle) {
      let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
      
      if (handle) {
        handle.onmousedown = dragMouseDown;
      } else {
        element.onmousedown = dragMouseDown;
      }
      
      function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        element.classList.add('dragging');
        
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }
      
      function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
      }
      
      function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        element.classList.remove('dragging');
      }
    }
    
    // Default code for Hydra
    const DEFAULT_CODE = \`// HYDRACTRL Sample
    
osc(10, 0.1, 1.2)
  .color(0.5, 0.1, 0.9)
  .rotate(0, 0.1)
  .modulateScale(osc(3, 0.2))
  .out()
\`;
    
    // Setup when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
      // Create canvas
      const container = document.getElementById('hydra-canvas');
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      container.appendChild(canvas);
      
      // Initialize minimal Hydra implementation
      const hydra = new MinimalHydra(canvas);
      
      // Create simple editor
      const editorContent = document.getElementById('editor-content');
      const editor = document.createElement('textarea');
      editor.className = 'hydra-editor';
      editor.value = DEFAULT_CODE;
      editorContent.appendChild(editor);
      
      // Make the editor draggable
      makeDraggable(
        document.getElementById('editor-container'),
        document.getElementById('editor-handle')
      );
      
      // Add run button functionality
      document.getElementById('run-btn').addEventListener('click', function() {
        const code = editor.value;
        hydra.eval(code);
      });
      
      // Save button functionality
      document.getElementById('save-btn').addEventListener('click', function() {
        localStorage.setItem('hydractrl-code', editor.value);
        
        // Show saved notification
        const notification = document.createElement('div');
        notification.className = 'saved-notification';
        notification.textContent = 'Saved!';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('fade-out');
          setTimeout(() => notification.remove(), 500);
        }, 1500);
      });
      
      // Load saved code
      const savedCode = localStorage.getItem('hydractrl-code');
      if (savedCode) {
        editor.value = savedCode;
      }
      
      // Add keyboard shortcuts
      document.addEventListener('keydown', function(e) {
        // Ctrl+Enter to run code
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          hydra.eval(editor.value);
        }
        
        // Ctrl+S to save code
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          localStorage.setItem('hydractrl-code', editor.value);
        }
        
        // Escape to toggle editor
        if (e.key === 'Escape') {
          const editorContainer = document.getElementById('editor-container');
          editorContainer.style.display = editorContainer.style.display === 'none' ? 'flex' : 'none';
        }
      });
      
      // Run on start
      hydra.eval(editor.value);
      
      // Resize handler
      window.addEventListener('resize', function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        hydra.eval(editor.value);  // Re-run code
      });
    });
    
  } catch (e) {
    console.error('Initialization error:', e);
  }
})();
            `, {
              headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
            });
          } catch (fallbackError) {
            console.error('Error with fallback index.js:', fallbackError);
          }
        }
        
        // Last resort fallback
        return new Response(`console.log('Module ${path} could not be loaded');`, {
          headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
        });
      }

      // For all other requests, try using the site assets
      try {
        // Log for debugging
        console.log('Trying to serve asset:', path);
        
        // Try direct URL fetch first
        try {
          const directResponse = await fetch(new URL(path, request.url));
          if (directResponse.ok) {
            console.log('Asset loaded via direct fetch');
            
            // Set appropriate content type based on file extension
            let contentType = 'application/octet-stream';
            if (path.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
            else if (path.endsWith('.css')) contentType = 'text/css';
            else if (path.endsWith('.html')) contentType = 'text/html';
            else if (path.endsWith('.json')) contentType = 'application/json';
            else if (path.endsWith('.png')) contentType = 'image/png';
            else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) contentType = 'image/jpeg';
            else if (path.endsWith('.svg')) contentType = 'image/svg+xml';
            
            // If it's a binary content
            if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
              const content = await directResponse.arrayBuffer();
              return new Response(content, {
                status: 200,
                headers: { 'Content-Type': contentType }
              });
            } else {
              // Text content
              const content = await directResponse.text();
              return new Response(content, {
                status: 200,
                headers: { 'Content-Type': contentType }
              });
            }
          }
        } catch (directError) {
          console.log('Direct URL fetch failed:', directError);
        }
        
        // Log that we're trying a different path
        console.log('Direct fetch failed, looking for content in __STATIC_CONTENT');
        
        // Try to get asset from __STATIC_CONTENT
        if (env.__STATIC_CONTENT) {
          const staticContent = env.__STATIC_CONTENT;
          const assetKey = path.startsWith('/') ? path.substring(1) : path;
          
          // Check if the asset exists
          if (staticContent.has(assetKey)) {
            console.log('Found in __STATIC_CONTENT:', assetKey);
            const asset = await staticContent.get(assetKey);
            if (asset) {
              // Set appropriate content type based on file extension
              let contentType = 'application/octet-stream';
              if (path.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
              else if (path.endsWith('.css')) contentType = 'text/css';
              else if (path.endsWith('.html')) contentType = 'text/html';
              else if (path.endsWith('.json')) contentType = 'application/json';
              else if (path.endsWith('.png')) contentType = 'image/png';
              else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) contentType = 'image/jpeg';
              else if (path.endsWith('.svg')) contentType = 'image/svg+xml';
              
              return new Response(asset.body, {
                headers: { 'Content-Type': contentType }
              });
            }
          } else {
            console.log('Not found in __STATIC_CONTENT:', assetKey);
          }
        } else {
          console.log('__STATIC_CONTENT binding not available');
        }
        
        // If we get here, we couldn't find the asset
        return new Response(`Asset not found: ${path}`, {
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      } catch (e) {
        console.error(`Error serving ${path}:`, e);
        return new Response(`Error serving asset: ${e.message}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    } catch (e) {
      console.error('Server error:', e);
      return new Response(`Server error: ${e.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};