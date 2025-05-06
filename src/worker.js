// Investigate the environment to find the correct binding
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // Debug the available bindings
      const availableBindings = Object.keys(env).join(', ');
      
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
            headers: { 'Content-Type': 'text/html' } 
          }
        );
      }
      
      // Return the full env object for debugging
      return new Response(`Available environment bindings: ${availableBindings}`, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } catch (e) {
      // If there's an error, return a simple error page
      return new Response(`Error: ${e.message}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};