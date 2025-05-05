/**
 * Canvas Sharing Utility
 * 
 * Provides functionality to share canvas content with external applications like Resolume
 * through various methods including frame exports and streaming.
 */

// Configuration for canvas sharing
const defaultConfig = {
  frameRate: 30,
  quality: 0.85,
  format: 'image/jpeg', // Alternative: 'image/png' for lossless but larger size
  maxWidth: null, // Set to a number to limit resolution
  maxHeight: null, // Set to a number to limit resolution
  autoStart: false
};

/**
 * Creates a canvas sharing manager that can capture and distribute canvas frames
 * @param {HTMLCanvasElement} sourceCanvas - The source canvas to capture frames from
 * @param {Object} options - Configuration options
 */
export function createCanvasSharing(sourceCanvas, options = {}) {
  const config = { ...defaultConfig, ...options };
  let isStreaming = false;
  let streamInterval = null;
  let frameCount = 0;
  let lastFrameTime = 0;
  let actualFps = 0;
  
  // Frame buffer for throttling
  const frameBuffer = [];
  
  // Potential WebSocket connection
  let wsConnection = null;
  
  // Event listeners
  const eventListeners = {
    'frame': [],
    'start': [],
    'stop': [],
    'error': []
  };
  
  /**
   * Emits an event to all registered listeners
   */
  function emit(eventName, data) {
    if (eventListeners[eventName]) {
      eventListeners[eventName].forEach(listener => listener(data));
    }
  }
  
  /**
   * Captures a single frame from the canvas
   */
  function captureFrame() {
    if (!sourceCanvas) {
      emit('error', new Error('Source canvas not found'));
      return null;
    }
    
    try {
      // Resize if needed
      let outputCanvas = sourceCanvas;
      let outputCtx = null;
      
      if (config.maxWidth || config.maxHeight) {
        const width = config.maxWidth || sourceCanvas.width;
        const height = config.maxHeight || sourceCanvas.height;
        
        // Create a scaling canvas if dimensions differ
        if (width !== sourceCanvas.width || height !== sourceCanvas.height) {
          outputCanvas = document.createElement('canvas');
          outputCanvas.width = width;
          outputCanvas.height = height;
          outputCtx = outputCanvas.getContext('2d');
          
          // Draw with smoothing
          outputCtx.drawImage(sourceCanvas, 0, 0, width, height);
        }
      }
      
      // Capture as data URL
      const dataUrl = outputCanvas.toDataURL(config.format, config.quality);
      
      // Frame metadata
      const timestamp = Date.now();
      const frame = {
        data: dataUrl,
        width: outputCanvas.width,
        height: outputCanvas.height,
        format: config.format,
        timestamp,
        frameNumber: frameCount++
      };
      
      // Update FPS calculation
      if (lastFrameTime) {
        const timeDiff = timestamp - lastFrameTime;
        if (timeDiff > 0) {
          actualFps = 1000 / timeDiff;
        }
      }
      lastFrameTime = timestamp;
      
      // Store in frame buffer (limit size)
      frameBuffer.push(frame);
      if (frameBuffer.length > 10) {
        frameBuffer.shift();
      }
      
      // Emit the frame event
      emit('frame', frame);
      
      return frame;
    } catch (error) {
      emit('error', error);
      console.error('Error capturing frame:', error);
      return null;
    }
  }
  
  /**
   * Starts the streaming process
   */
  function startStreaming() {
    if (isStreaming) return;
    
    isStreaming = true;
    frameCount = 0;
    lastFrameTime = 0;
    
    // Calculate the capture interval based on frame rate
    const interval = 1000 / config.frameRate;
    
    // Start the capture loop
    streamInterval = setInterval(() => {
      captureFrame();
    }, interval);
    
    emit('start', { frameRate: config.frameRate });
    
    return true;
  }
  
  /**
   * Stops the streaming process
   */
  function stopStreaming() {
    if (!isStreaming) return;
    
    isStreaming = false;
    
    // Clear the capture interval
    if (streamInterval) {
      clearInterval(streamInterval);
      streamInterval = null;
    }
    
    emit('stop', { frameCount });
    
    return true;
  }
  
  /**
   * Returns the latest captured frame
   */
  function getLatestFrame() {
    if (frameBuffer.length === 0) {
      return captureFrame();
    }
    return frameBuffer[frameBuffer.length - 1];
  }
  
  /**
   * Downloads the current frame as an image
   */
  function downloadCurrentFrame(filename = null) {
    const frame = captureFrame();
    if (!frame) return false;
    
    const a = document.createElement('a');
    a.href = frame.data;
    a.download = filename || `hydra-frame-${frame.frameNumber}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    return true;
  }
  
  /**
   * Creates a simple local HTTP server for the canvas frames
   * Note: This requires a localhost server to be running and handling the POST request
   */
  function setupLocalHttpStreaming(endpoint = 'http://localhost:8000/hydra-stream') {
    if (!window.fetch) {
      emit('error', new Error('Fetch API not supported in this browser'));
      return false;
    }
    
    // Register a frame listener to send frames to the server
    addEventListener('frame', (frame) => {
      // Only send every other frame to reduce network traffic
      if (frame.frameNumber % 2 !== 0) return;
      
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: frame.data,
          timestamp: frame.timestamp,
          frameNumber: frame.frameNumber
        })
      }).catch(error => {
        console.warn('Error sending frame to local server:', error);
      });
    });
    
    return true;
  }
  
  /**
   * Registers an event listener
   */
  function addEventListener(event, callback) {
    if (eventListeners[event]) {
      eventListeners[event].push(callback);
      return true;
    }
    return false;
  }
  
  /**
   * Removes an event listener
   */
  function removeEventListener(event, callback) {
    if (eventListeners[event]) {
      const index = eventListeners[event].indexOf(callback);
      if (index !== -1) {
        eventListeners[event].splice(index, 1);
        return true;
      }
    }
    return false;
  }
  
  /**
   * Opens a preview window showing the stream
   */
  function openPreviewWindow() {
    // Create a new window
    const previewWindow = window.open('', 'hydraPreview', 'width=800,height=600');
    if (!previewWindow) {
      emit('error', new Error('Could not open preview window. Check popup blocker settings.'));
      return false;
    }
    
    // Write preview HTML
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>HYDRACTRL Canvas Preview</title>
        <style>
          body { margin: 0; padding: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
          img { max-width: 100%; max-height: 100%; object-fit: contain; }
          .info { position: absolute; bottom: 10px; left: 10px; color: #fff; font-family: monospace; background: rgba(0,0,0,0.5); padding: 5px; }
        </style>
      </head>
      <body>
        <img id="previewImage" src="" alt="Canvas Preview">
        <div class="info" id="infoPanel">Waiting for frames...</div>
        <script>
          // Setup connection to parent window
          window.addEventListener('message', function(event) {
            if (event.data && event.data.frameData) {
              document.getElementById('previewImage').src = event.data.frameData;
              document.getElementById('infoPanel').textContent = 
                'Frame: ' + event.data.frameNumber + 
                ' | FPS: ' + event.data.fps.toFixed(1) + 
                ' | ' + event.data.width + 'x' + event.data.height;
            }
          });
        </script>
      </body>
      </html>
    `);
    
    // Register to send frames to the preview window
    const frameCallback = (frame) => {
      if (previewWindow.closed) {
        removeEventListener('frame', frameCallback);
        return;
      }
      
      // Send frame data to the preview window
      previewWindow.postMessage({
        frameData: frame.data,
        frameNumber: frame.frameNumber,
        fps: actualFps,
        width: frame.width,
        height: frame.height
      }, '*');
    };
    
    addEventListener('frame', frameCallback);
    
    // Start streaming if not already
    if (!isStreaming) {
      startStreaming();
    }
    
    return previewWindow;
  }
  
  // Auto-start if configured
  if (config.autoStart) {
    startStreaming();
  }
  
  // Public API
  return {
    captureFrame,
    startStreaming,
    stopStreaming,
    getLatestFrame,
    downloadCurrentFrame,
    openPreviewWindow,
    setupLocalHttpStreaming,
    addEventListener,
    removeEventListener,
    getStatus: () => ({
      isStreaming,
      frameCount,
      fps: actualFps,
      config
    }),
    getConfig: () => ({ ...config }),
    updateConfig: (newConfig) => {
      // Update config
      Object.assign(config, newConfig);
      
      // If streaming, restart to apply new settings
      if (isStreaming) {
        stopStreaming();
        startStreaming();
      }
      
      return { ...config };
    }
  };
}