/**
 * Share Panel Component
 * A draggable panel for controlling stream sharing settings
 */
export function createSharePanel(canvasSharing) {
  // Create the panel container
  const panel = document.createElement('div');
  panel.className = 'share-panel';
  panel.style.position = 'absolute';
  panel.style.top = '440px';
  panel.style.left = '20px';
  panel.style.backgroundColor = 'rgba(37, 37, 37, 0.7)';
  panel.style.borderRadius = '8px';
  panel.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
  panel.style.backdropFilter = 'blur(5px)';
  panel.style.zIndex = '100';
  panel.style.overflow = 'hidden';
  panel.style.width = 'auto';
  panel.style.minWidth = '220px';

  // Create the handle
  const handle = document.createElement('div');
  handle.className = 'share-handle';
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
  title.className = 'share-title';
  title.style.fontSize = '12px';
  title.style.fontWeight = 'bold';
  title.style.textTransform = 'uppercase';
  title.style.color = '#aaa';
  title.textContent = 'STREAM';

  // Create the toggle button
  const toggle = document.createElement('div');
  toggle.className = 'share-toggle';
  toggle.style.fontSize = '10px';
  toggle.style.color = '#aaa';
  toggle.style.padding = '2px 4px';
  toggle.style.borderRadius = '2px';
  toggle.style.cursor = 'pointer';
  toggle.textContent = '▲';

  // Create the content container
  const content = document.createElement('div');
  content.className = 'share-content';
  content.style.padding = '8px';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.gap = '8px';

  // Create the status indicator
  const status = document.createElement('div');
  status.className = 'share-status';
  status.style.display = 'flex';
  status.style.justifyContent = 'space-between';
  status.style.alignItems = 'center';

  const statusLabel = document.createElement('span');
  statusLabel.textContent = 'Status:';
  statusLabel.style.fontSize = '12px';
  statusLabel.style.color = '#aaa';

  const statusValue = document.createElement('span');
  statusValue.textContent = 'Inactive';
  statusValue.style.fontSize = '12px';
  statusValue.style.color = '#ff5555';
  statusValue.style.fontWeight = 'bold';

  status.appendChild(statusLabel);
  status.appendChild(statusValue);

  // Create stream controls
  const streamControls = document.createElement('div');
  streamControls.className = 'stream-controls';
  streamControls.style.display = 'flex';
  streamControls.style.justifyContent = 'space-between';
  streamControls.style.gap = '4px';

  // Start/Stop button
  const startStopButton = document.createElement('button');
  startStopButton.textContent = 'Start Stream';
  startStopButton.style.flex = '1';
  startStopButton.style.padding = '4px 8px';
  startStopButton.style.fontSize = '12px';
  startStopButton.style.backgroundColor = 'rgba(80, 250, 123, 0.2)';
  startStopButton.style.border = 'none';
  startStopButton.style.borderRadius = '4px';
  startStopButton.style.color = '#f5f5f5';
  startStopButton.style.cursor = 'pointer';

  // Capture Frame button
  const captureFrameButton = document.createElement('button');
  captureFrameButton.textContent = 'Save Frame';
  captureFrameButton.style.flex = '1';
  captureFrameButton.style.padding = '4px 8px';
  captureFrameButton.style.fontSize = '12px';
  captureFrameButton.style.backgroundColor = 'rgba(139, 233, 253, 0.2)';
  captureFrameButton.style.border = 'none';
  captureFrameButton.style.borderRadius = '4px';
  captureFrameButton.style.color = '#f5f5f5';
  captureFrameButton.style.cursor = 'pointer';

  streamControls.appendChild(startStopButton);
  streamControls.appendChild(captureFrameButton);

  // Stream statistics
  const statistics = document.createElement('div');
  statistics.className = 'stream-stats';
  statistics.style.display = 'flex';
  statistics.style.flexDirection = 'column';
  statistics.style.gap = '4px';
  statistics.style.fontSize = '12px';
  statistics.style.color = '#aaa';

  const fpsLabel = document.createElement('div');
  fpsLabel.style.display = 'flex';
  fpsLabel.style.justifyContent = 'space-between';

  const fpsText = document.createElement('span');
  fpsText.textContent = 'FPS:';

  const fpsValue = document.createElement('span');
  fpsValue.textContent = '0';
  fpsValue.style.fontFamily = 'monospace';

  fpsLabel.appendChild(fpsText);
  fpsLabel.appendChild(fpsValue);

  const framesLabel = document.createElement('div');
  framesLabel.style.display = 'flex';
  framesLabel.style.justifyContent = 'space-between';

  const framesText = document.createElement('span');
  framesText.textContent = 'Frames Sent:';

  const framesValue = document.createElement('span');
  framesValue.textContent = '0';
  framesValue.style.fontFamily = 'monospace';

  framesLabel.appendChild(framesText);
  framesLabel.appendChild(framesValue);

  statistics.appendChild(fpsLabel);
  statistics.appendChild(framesLabel);

  // Stream settings
  const settingsSection = document.createElement('div');
  settingsSection.className = 'stream-settings';
  settingsSection.style.display = 'none'; // Initially hidden
  settingsSection.style.flexDirection = 'column';
  settingsSection.style.gap = '6px';
  settingsSection.style.marginTop = '8px';
  settingsSection.style.paddingTop = '8px';
  settingsSection.style.borderTop = '1px solid rgba(100, 100, 100, 0.3)';

  // Frame rate setting
  const framerateInput = createSetting(
    'Frame Rate',
    'range',
    canvasSharing.getConfig().frameRate,
    e => {
      const value = parseInt(e.target.value);
      framerateValue.textContent = value;
      canvasSharing.updateConfig({ frameRate: value });
    },
    { min: 1, max: 60, step: 1 }
  );

  const framerateValue = document.createElement('span');
  framerateValue.textContent = canvasSharing.getConfig().frameRate;
  framerateValue.style.fontFamily = 'monospace';
  framerateInput.querySelector('div').appendChild(framerateValue);

  // Quality setting
  const qualityInput = createSetting(
    'Quality',
    'range',
    canvasSharing.getConfig().quality * 100,
    e => {
      const value = parseInt(e.target.value) / 100;
      qualityValue.textContent = e.target.value + '%';
      canvasSharing.updateConfig({ quality: value });
    },
    { min: 10, max: 100, step: 5 }
  );

  const qualityValue = document.createElement('span');
  qualityValue.textContent = Math.round(canvasSharing.getConfig().quality * 100) + '%';
  qualityValue.style.fontFamily = 'monospace';
  qualityInput.querySelector('div').appendChild(qualityValue);

  // Format setting
  const formatInput = createSetting(
    'Format',
    'select',
    canvasSharing.getConfig().format,
    e => {
      canvasSharing.updateConfig({ format: e.target.value });
    },
    { options: ['image/jpeg', 'image/png'] }
  );

  // Preview button
  const previewButton = document.createElement('button');
  previewButton.textContent = 'Open Preview Window';
  previewButton.style.width = '100%';
  previewButton.style.marginTop = '6px';
  previewButton.style.padding = '4px 8px';
  previewButton.style.fontSize = '12px';
  previewButton.style.backgroundColor = 'rgba(80, 250, 123, 0.2)';
  previewButton.style.border = 'none';
  previewButton.style.borderRadius = '4px';
  previewButton.style.color = '#f5f5f5';
  previewButton.style.cursor = 'pointer';

  // Add settings to settings section
  settingsSection.appendChild(framerateInput);
  settingsSection.appendChild(qualityInput);
  settingsSection.appendChild(formatInput);
  settingsSection.appendChild(previewButton);

  // Stream status notification
  const notification = document.createElement('div');
  notification.className = 'stream-notification';
  notification.style.display = 'none';
  notification.style.position = 'absolute';
  notification.style.bottom = '10px';
  notification.style.right = '10px';
  notification.style.backgroundColor = 'rgba(80, 250, 123, 0.3)';
  notification.style.color = '#f5f5f5';
  notification.style.padding = '6px 12px';
  notification.style.borderRadius = '4px';
  notification.style.fontSize = '12px';
  notification.style.fontWeight = 'bold';
  notification.style.transition = 'opacity 0.3s';
  notification.style.opacity = '0';
  notification.style.pointerEvents = 'none';
  document.body.appendChild(notification);

  // Show notification
  function showNotification(message, isError = false) {
    notification.textContent = message;
    notification.style.backgroundColor = isError
      ? 'rgba(255, 85, 85, 0.3)'
      : 'rgba(80, 250, 123, 0.3)';
    notification.style.display = 'block';
    notification.style.opacity = '1';

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.style.display = 'none';
      }, 300);
    }, 2000);
  }

  // Update UI with stream status
  function updateUI() {
    const status = canvasSharing.getStatus();

    // Update status indicator
    statusValue.textContent = status.isStreaming ? 'Active' : 'Inactive';
    statusValue.style.color = status.isStreaming ? '#50fa7b' : '#ff5555';

    // Update button
    startStopButton.textContent = status.isStreaming ? 'Stop Stream' : 'Start Stream';
    startStopButton.style.backgroundColor = status.isStreaming
      ? 'rgba(255, 85, 85, 0.2)'
      : 'rgba(80, 250, 123, 0.2)';

    // Update statistics
    fpsValue.textContent = status.fps.toFixed(1);
    framesValue.textContent = status.frameCount;
  }

  // Set up event handlers
  startStopButton.addEventListener('click', () => {
    const status = canvasSharing.getStatus();

    if (status.isStreaming) {
      canvasSharing.stopStreaming();
      showNotification('Stream stopped');
    } else {
      canvasSharing.startStreaming();
      showNotification('Stream started');
    }

    updateUI();
  });

  captureFrameButton.addEventListener('click', () => {
    canvasSharing.downloadCurrentFrame();
    showNotification('Frame saved');
  });

  previewButton.addEventListener('click', () => {
    canvasSharing.openPreviewWindow();
    showNotification('Preview window opened');
  });

  // Set up CanvasSharing event listeners
  canvasSharing.addEventListener('start', () => {
    updateUI();
  });

  canvasSharing.addEventListener('stop', () => {
    updateUI();
  });

  canvasSharing.addEventListener('error', (error) => {
    showNotification(`Error: ${error.message}`, true);
    console.error('Canvas sharing error:', error);
  });

  // Update UI periodically if streaming
  setInterval(() => {
    if (canvasSharing.getStatus().isStreaming) {
      updateUI();
    }
  }, 1000);

  // Set up toggle
  let isExpanded = false;
  toggle.addEventListener('click', () => {
    isExpanded = !isExpanded;
    settingsSection.style.display = isExpanded ? 'flex' : 'none';
    toggle.textContent = isExpanded ? '▼' : '▲';
  });

  // Assemble the panel
  handle.appendChild(title);
  handle.appendChild(toggle);

  content.appendChild(status);
  content.appendChild(streamControls);
  content.appendChild(statistics);
  content.appendChild(settingsSection);

  panel.appendChild(handle);
  panel.appendChild(content);

  // Add to document
  document.body.appendChild(panel);

  // Make draggable
  makeDraggable(panel, handle);

  // Initial UI update
  updateUI();

  // Return the panel for any additional manipulation
  return panel;
}

/**
 * Creates a setting input element with label
 */
function createSetting(label, type, value, onChange, options = {}) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.justifyContent = 'space-between';
  container.style.alignItems = 'center';
  container.style.gap = '8px';

  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  labelElement.style.fontSize = '12px';
  labelElement.style.color = '#aaa';

  const inputContainer = document.createElement('div');
  inputContainer.style.display = 'flex';
  inputContainer.style.alignItems = 'center';
  inputContainer.style.gap = '8px';

  let inputElement;

  switch (type) {
    case 'range':
      inputElement = document.createElement('input');
      inputElement.type = 'range';
      inputElement.min = options.min || 0;
      inputElement.max = options.max || 100;
      inputElement.step = options.step || 1;
      inputElement.value = value;
      inputElement.style.width = '80px';
      break;

    case 'select':
      inputElement = document.createElement('select');
      inputElement.style.padding = '2px 4px';
      inputElement.style.backgroundColor = 'rgba(30, 30, 30, 0.7)';
      inputElement.style.border = '1px solid rgba(100, 100, 100, 0.3)';
      inputElement.style.borderRadius = '2px';
      inputElement.style.color = '#f5f5f5';
      inputElement.style.fontSize = '12px';

      if (options.options) {
        options.options.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option;
          optionElement.textContent = option.replace('image/', '');
          optionElement.selected = option === value;
          inputElement.appendChild(optionElement);
        });
      }
      break;

    case 'checkbox':
      inputElement = document.createElement('input');
      inputElement.type = 'checkbox';
      inputElement.checked = value;
      break;

    default:
      inputElement = document.createElement('input');
      inputElement.type = 'text';
      inputElement.value = value;
      inputElement.style.width = '80px';
      inputElement.style.padding = '2px 4px';
      inputElement.style.backgroundColor = 'rgba(30, 30, 30, 0.7)';
      inputElement.style.border = '1px solid rgba(100, 100, 100, 0.3)';
      inputElement.style.borderRadius = '2px';
      inputElement.style.color = '#f5f5f5';
      inputElement.style.fontSize = '12px';
  }

  inputElement.addEventListener('change', onChange);

  inputContainer.appendChild(inputElement);

  container.appendChild(labelElement);
  container.appendChild(inputContainer);

  return container;
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

  // Initialize position once the element has rendered
  setTimeout(() => {
    // Get and store the initial position
    const rect = element.getBoundingClientRect();

    // Calculate position based on left alignment
    currentX = parseInt(element.style.left || '20px');
    currentY = parseInt(element.style.top || '20px');

    console.log('Initial position set:', currentX, currentY);
  }, 100);

  // Mouse down handler
  function onMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();

    // Calculate initial mouse position
    initialX = e.clientX;
    initialY = e.clientY;

    // Get current element position from inline style
    currentX = parseInt(element.style.left || '0');
    currentY = parseInt(element.style.top || '0');

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

    // Calculate new position with bounds checking
    const newX = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, currentX + offsetX));
    const newY = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, currentY + offsetY));

    // Update position
    element.style.left = newX + 'px';
    element.style.top = newY + 'px';
  }

  // Mouse up handler
  function onMouseUp(e) {
    if (!isDragging) return;

    // Update current position with final offsets
    currentX = parseInt(element.style.left || '0');
    currentY = parseInt(element.style.top || '0');

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