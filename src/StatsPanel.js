/**
 * Simple Stats Panel
 * A minimal, draggable FPS counter that doesn't rely on complex component architecture
 */
export function createStatsPanel() {
  // Create the panel container
  const panel = document.createElement('div');
  panel.className = 'stats-panel';
  panel.style.position = 'absolute';
  panel.style.top = '20px';
  panel.style.right = '20px';
  panel.style.backgroundColor = 'rgba(37, 37, 37, 0.7)';
  panel.style.borderRadius = '8px';
  panel.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
  panel.style.backdropFilter = 'blur(5px)';
  panel.style.zIndex = '100';
  panel.style.overflow = 'hidden';
  panel.style.width = 'auto';
  panel.style.minWidth = '120px';
  
  // Create the handle
  const handle = document.createElement('div');
  handle.className = 'stats-handle';
  handle.style.height = '24px';
  handle.style.backgroundColor = 'rgba(60, 60, 60, 0.7)';
  handle.style.display = 'flex';
  handle.style.justifyContent = 'space-between';
  handle.style.alignItems = 'center';
  handle.style.padding = '0 8px';
  handle.style.cursor = 'move';
  handle.style.userSelect = 'none';
  
  // Create the title
  const title = document.createElement('div');
  title.className = 'stats-title';
  title.style.fontSize = '12px';
  title.style.fontWeight = 'bold';
  title.style.textTransform = 'uppercase';
  title.style.color = '#aaa';
  title.textContent = 'STATS';
  
  // Create the toggle button
  const toggle = document.createElement('div');
  toggle.className = 'stats-toggle';
  toggle.style.fontSize = '10px';
  toggle.style.color = '#aaa';
  toggle.style.padding = '2px 4px';
  toggle.style.borderRadius = '2px';
  toggle.style.cursor = 'pointer';
  toggle.textContent = '▲';
  
  // Create the content container
  const content = document.createElement('div');
  content.className = 'stats-content';
  content.style.padding = '8px';
  
  // Create the metrics container
  const metrics = document.createElement('div');
  metrics.className = 'stats-metrics';
  metrics.style.display = 'flex';
  metrics.style.gap = '12px';
  
  // Create the FPS metric
  const fpsMetric = document.createElement('div');
  fpsMetric.className = 'stats-metric';
  fpsMetric.style.display = 'flex';
  fpsMetric.style.justifyContent = 'space-between';
  fpsMetric.style.gap = '12px';
  fpsMetric.style.alignItems = 'center';
  
  // FPS Label
  const fpsLabel = document.createElement('span');
  fpsLabel.className = 'stats-label';
  fpsLabel.style.fontSize = '12px';
  fpsLabel.style.fontWeight = 'bold';
  fpsLabel.style.color = '#aaa';
  fpsLabel.style.whiteSpace = 'nowrap';
  fpsLabel.textContent = 'FPS:';
  
  // FPS Value
  const fpsValue = document.createElement('span');
  fpsValue.className = 'stats-value';
  fpsValue.style.fontFamily = 'monospace';
  fpsValue.style.fontSize = '12px';
  fpsValue.style.fontWeight = 'bold';
  fpsValue.style.color = 'white';
  fpsValue.textContent = '0';
  
  // Detailed metrics
  const details = document.createElement('div');
  details.className = 'stats-details';
  details.style.marginTop = '8px';
  details.style.paddingTop = '8px';
  details.style.borderTop = '1px solid rgba(100, 100, 100, 0.3)';
  details.style.display = 'none';
  details.style.flexDirection = 'column';
  details.style.gap = '6px';
  
  // Add metrics for avg FPS
  const avgFpsMetric = document.createElement('div');
  avgFpsMetric.className = 'stats-metric';
  avgFpsMetric.style.display = 'flex';
  avgFpsMetric.style.justifyContent = 'space-between';
  avgFpsMetric.style.gap = '12px';
  avgFpsMetric.style.alignItems = 'center';
  
  const avgFpsLabel = document.createElement('span');
  avgFpsLabel.className = 'stats-label';
  avgFpsLabel.style.fontSize = '12px';
  avgFpsLabel.style.fontWeight = 'bold';
  avgFpsLabel.style.color = '#aaa';
  avgFpsLabel.textContent = 'AVG FPS:';
  
  const avgFpsValue = document.createElement('span');
  avgFpsValue.className = 'stats-value';
  avgFpsValue.style.fontFamily = 'monospace';
  avgFpsValue.style.fontSize = '12px';
  avgFpsValue.style.fontWeight = 'bold';
  avgFpsValue.style.color = 'white';
  avgFpsValue.textContent = '0';
  
  // Add metrics for frame count
  const frameCountMetric = document.createElement('div');
  frameCountMetric.className = 'stats-metric';
  frameCountMetric.style.display = 'flex';
  frameCountMetric.style.justifyContent = 'space-between';
  frameCountMetric.style.gap = '12px';
  frameCountMetric.style.alignItems = 'center';
  
  const frameCountLabel = document.createElement('span');
  frameCountLabel.className = 'stats-label';
  frameCountLabel.style.fontSize = '12px';
  frameCountLabel.style.fontWeight = 'bold';
  frameCountLabel.style.color = '#aaa';
  frameCountLabel.textContent = 'FRAMES:';
  
  const frameCountValue = document.createElement('span');
  frameCountValue.className = 'stats-value';
  frameCountValue.style.fontFamily = 'monospace';
  frameCountValue.style.fontSize = '12px';
  frameCountValue.style.fontWeight = 'bold';
  frameCountValue.style.color = 'white';
  frameCountValue.textContent = '0';
  
  // Assemble the panel
  fpsMetric.appendChild(fpsLabel);
  fpsMetric.appendChild(fpsValue);
  
  avgFpsMetric.appendChild(avgFpsLabel);
  avgFpsMetric.appendChild(avgFpsValue);
  
  frameCountMetric.appendChild(frameCountLabel);
  frameCountMetric.appendChild(frameCountValue);
  
  metrics.appendChild(fpsMetric);
  
  details.appendChild(avgFpsMetric);
  details.appendChild(frameCountMetric);
  
  content.appendChild(metrics);
  content.appendChild(details);
  
  handle.appendChild(title);
  handle.appendChild(toggle);
  
  panel.appendChild(handle);
  panel.appendChild(content);
  
  // Add to document
  document.body.appendChild(panel);
  
  // Set up toggle
  let isExpanded = false;
  toggle.addEventListener('click', () => {
    isExpanded = !isExpanded;
    details.style.display = isExpanded ? 'flex' : 'none';
    toggle.textContent = isExpanded ? '▼' : '▲';
  });
  
  // Make draggable
  makeDraggable(panel, handle);
  
  // Set up performance monitoring
  let frameCount = 0;
  let fps = 0;
  let avgFps = 0;
  let totalFrameTime = 0;
  let lastTime = performance.now();
  
  function updateStats() {
    const now = performance.now();
    const frameTime = now - lastTime;
    const currentFps = frameTime > 0 ? 1000 / frameTime : 0;
    
    // Update running average
    frameCount++;
    totalFrameTime += frameTime;
    avgFps = totalFrameTime > 0 ? 1000 / (totalFrameTime / frameCount) : 0;
    
    // Update display
    fps = Math.round(currentFps);
    lastTime = now;
    
    // Update UI
    fpsValue.textContent = fps.toString();
    avgFpsValue.textContent = Math.round(avgFps * 10) / 10;
    frameCountValue.textContent = frameCount.toString();
    
    // Update color based on FPS
    if (fps > 50) {
      fpsValue.style.color = 'rgb(100, 255, 100)';
    } else if (fps > 30) {
      fpsValue.style.color = 'rgb(255, 200, 0)';
    } else {
      fpsValue.style.color = 'rgb(255, 100, 100)';
    }
    
    // Request next frame
    requestAnimationFrame(updateStats);
  }
  
  // Start update loop
  requestAnimationFrame(updateStats);
  
  // Return the panel for any additional manipulation
  return panel;
}

/**
 * Make an element draggable
 */
function makeDraggable(element, handle) {
  // Variables for tracking position
  let initialX = 0;
  let initialY = 0;
  let currentX = 0;
  let currentY = 0;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  
  // Mouse down handler
  function onMouseDown(e) {
    console.log('Mouse down on handle!');
    e.preventDefault();
    e.stopPropagation();
    
    // Remove right positioning
    element.style.right = '';
    
    // Calculate initial position
    initialX = e.clientX;
    initialY = e.clientY;
    
    // Get current position
    const rect = element.getBoundingClientRect();
    currentX = rect.left;
    currentY = rect.top;
    
    // Start dragging
    isDragging = true;
    element.classList.add('dragging');
    
    // Add listeners
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  
  // Mouse move handler
  function onMouseMove(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate offset
    offsetX = e.clientX - initialX;
    offsetY = e.clientY - initialY;
    
    // Update position
    element.style.left = (currentX + offsetX) + 'px';
    element.style.top = (currentY + offsetY) + 'px';
    
    // Log position
    console.log('Moving to:', currentX + offsetX, currentY + offsetY);
  }
  
  // Mouse up handler
  function onMouseUp(e) {
    console.log('Mouse up, drag complete');
    
    // Update current position
    currentX += offsetX;
    currentY += offsetY;
    
    // End dragging
    isDragging = false;
    element.classList.remove('dragging');
    
    // Remove listeners
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
  
  // Add listener to handle
  handle.addEventListener('mousedown', onMouseDown);
}