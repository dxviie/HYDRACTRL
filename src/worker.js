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
        // Read file from KV or serve from public
        try {
          // Get asset from binding
          const response = await env.ASSETS.fetch(request);
          const scriptContent = await response.text();
          
          // Create a new response with correct MIME type
          return new Response(scriptContent, {
            headers: { 
              'Content-Type': path.includes('module') ? 'application/javascript; charset=utf-8' : 'application/javascript; charset=utf-8'
            }
          });
        } catch (error) {
          console.error('Error serving JS file:', error);
          
          // Fallback for index.js
          if (path === '/assets/index.js') {
            return new Response("console.log('HYDRACTRL - Basic fallback loaded');", {
              headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
            });
          }
          
          return new Response(`Failed to load JavaScript file: ${path}`, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      }

      // For all other requests, try to serve from ASSETS binding
      try {
        const response = await env.ASSETS.fetch(request);
        
        // Set appropriate content type based on file extension
        let contentType = 'application/octet-stream';
        if (path.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
        else if (path.endsWith('.css')) contentType = 'text/css';
        else if (path.endsWith('.html')) contentType = 'text/html';
        else if (path.endsWith('.json')) contentType = 'application/json';
        else if (path.endsWith('.png')) contentType = 'image/png';
        else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (path.endsWith('.svg')) contentType = 'image/svg+xml';
        
        // Get the content
        const content = await response.arrayBuffer();
        
        // Return with proper content type
        return new Response(content, {
          status: 200,
          headers: { 'Content-Type': contentType }
        });
      } catch (e) {
        console.error(`Error serving ${path}:`, e);
        return new Response(`Asset not found: ${path}`, {
          status: 404,
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