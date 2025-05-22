/**
 * XY Pad Panel
 * A visual representation of the Korg nanoPAD's XY pad
 */
import { setupPanelPersistence } from './utils/PanelStorage.js';
import { XYPhysics } from './physics/XYPhysics.js';

export function createXYPadPanel() {
  // Create the panel container
  const panel = document.createElement("div");
  panel.className = "xy-pad-panel";
  panel.style.position = "absolute";
  panel.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity))";
  panel.style.borderRadius = "4px";
  panel.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.3)";
  panel.style.zIndex = "100";
  panel.style.visibility = 'hidden';
  panel.style.transition = 'opacity 0.3s ease, visibility 0.3s ease';

  // Only show the panel if MIDI is available
  if (window.midiManager && window.midiManager.isConnected() && window.midiManager.getActiveDevice()?.name.toLowerCase().includes('nanopad')) {
    if (localStorage.getItem('hydractrl-xy-pad-visible') !== 'false') {
      panel.style.visibility = 'visible';
      panel.style.opacity = '1';
    }
  }

  // Create the handle/title bar
  const handle = document.createElement("div");
  handle.className = "xy-pad-handle";
  handle.style.height = "24px";
  handle.style.backgroundColor = "rgba(var(--color-bg-tertiary-rgb), var(--panel-opacity))";
  handle.style.display = "flex";
  handle.style.justifyContent = "space-between";
  handle.style.alignItems = "center";
  handle.style.padding = "0 8px";
  handle.style.cursor = "move";
  handle.style.userSelect = "none";
  handle.style.borderRadius = "4px 4px 0 0";

  // Create the title
  const title = document.createElement("div");
  title.className = "xy-pad-title";
  title.style.fontSize = "12px";
  title.style.fontWeight = "bold";
  title.style.textTransform = "uppercase";
  title.style.color = "var(--color-text-secondary)";
  title.textContent = "XY PAD";

  // Add title and close button to handle
  handle.appendChild(title);

  // Create the XY pad visualization area (4:3 aspect ratio)
  const padArea = document.createElement("div");
  padArea.className = "xy-pad-area";
  padArea.style.width = "240px"; // 4:3 ratio
  padArea.style.height = "180px";
  padArea.style.margin = "8px";
  padArea.style.backgroundColor = "rgba(255, 255, 255, .1)";
  padArea.style.position = "relative";
  padArea.style.borderRadius = "0 0 4px 4px";
  padArea.style.overflow = "hidden";
  padArea.style.cursor = "crosshair";

  // Create the position indicator
  const indicator = document.createElement("div");
  indicator.className = "xy-pad-indicator";
  indicator.style.position = "absolute";
  indicator.style.width = "10px";
  indicator.style.height = "10px";
  indicator.style.borderRadius = "50%";
  indicator.style.backgroundColor = "var(--color-text-secondary)";
  indicator.style.transform = "translate(-50%, -50%)";
  indicator.style.transition = "background-color 0.3s ease";
  padArea.appendChild(indicator);

  // Create physics controls section
  const controlsSection = document.createElement("div");
  controlsSection.style.padding = "0 8px 8px";
  controlsSection.style.display = "flex";
  controlsSection.style.flexDirection = "column";
  controlsSection.style.gap = "8px";

  // Physics toggle
  const physicsToggle = document.createElement("div");
  physicsToggle.style.display = "flex";
  physicsToggle.style.alignItems = "center";
  physicsToggle.style.gap = "8px";

  const physicsCheckbox = document.createElement("input");
  physicsCheckbox.type = "checkbox";
  physicsCheckbox.id = "xy-physics";
  physicsCheckbox.checked = localStorage.getItem('hydractrl-xy-physics') === 'true';

  const physicsLabel = document.createElement("label");
  physicsLabel.htmlFor = "xy-physics";
  physicsLabel.textContent = "Physics";
  physicsLabel.style.fontSize = "12px";
  physicsLabel.style.color = "var(--color-text-secondary)";
  physicsLabel.style.userSelect = "none";
  physicsLabel.style.cursor = "pointer";

  physicsToggle.appendChild(physicsCheckbox);
  physicsToggle.appendChild(physicsLabel);

  // Physics parameters section (initially hidden)
  const paramsSection = document.createElement("div");
  paramsSection.style.display = physicsCheckbox.checked ? "flex" : "none";
  paramsSection.style.flexDirection = "column";
  paramsSection.style.gap = "4px";

  // Create parameter sliders
  const createParamSlider = (label_text, initial, min, max, step = 0.01) => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "4px";

    const label = document.createElement("div");
    label.style.fontSize = "12px";
    label.style.color = "var(--color-text-secondary)";
    label.style.display = "flex";
    label.style.justifyContent = "space-between";
    label.style.alignItems = "center";

    const label_span = document.createElement("span");
    label_span.textContent = label_text;
    label.appendChild(label_span);

    const value_display = document.createElement("span");
    value_display.textContent = initial;
    value_display.style.fontFamily = "monospace";
    value_display.style.color = "transparent";
    label.appendChild(value_display);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = initial;

    slider.addEventListener("input", () => {
      value_display.textContent = slider.value;
      updatePhysicsParams();
    });

    container.appendChild(label);
    container.appendChild(slider);
    return { container, slider };
  };

  const frictionControl = createParamSlider("Friction", 0.1, 0, 0.2);
  const bounceControl = createParamSlider("Bounce", 0.7, 0.3, 1);

  paramsSection.appendChild(frictionControl.container);
  paramsSection.appendChild(bounceControl.container);

  controlsSection.appendChild(physicsToggle);
  controlsSection.appendChild(paramsSection);

  // Add everything to the panel
  panel.appendChild(handle);
  panel.appendChild(padArea);
  panel.appendChild(controlsSection);
  document.body.appendChild(panel);

  // Set up panel position persistence (only for position, not size)
  const { savePosition } = setupPanelPersistence(panel, 'xy-pad', {
    left: 20,
    top: 20,
  }, {
    width: 256, // 240px pad + 16px margins
    height: 'fit-content',
    skipSizeRestore: true // Don't restore size from localStorage
  });

  // Initialize physics system
  const physics = new XYPhysics(padArea.offsetWidth, padArea.offsetHeight, { historySize: 3 });
  let isPhysicsEnabled = physicsCheckbox.checked;

  // Track pad interaction state and physics values
  let isPadActive = false;
  let lastPadX = 0;
  let lastPadY = 0;
  let lastPadTime = 0;

  // Make the panel draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  handle.addEventListener("mousedown", dragStart);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", dragEnd);

  // Handle panel dragging
  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target === handle) {
      isDragging = true;
      panel.classList.add('dragging');
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      panel.style.left = `${currentX}px`;
      panel.style.top = `${currentY}px`;
    }
  }

  function dragEnd(e) {
    if (isDragging) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      panel.classList.remove('dragging');
      savePosition();
    }
  }

  // Function to update X coordinate from MIDI
  function updateFromMIDIX(x) {
    // Stop any running physics simulation when pad is touched
    physics.stop();
    isPadActive = true;

    // Update physics X position (which records history)
    physics.setPositionX(x);
    updatePosition(x, physics.y / physics.height, true);
  }

  // Function to update Y coordinate from MIDI
  function updateFromMIDIY(y) {
    // Stop any running physics simulation when pad is touched
    physics.stop();
    isPadActive = true;

    // Update physics Y position (which records history)
    physics.setPositionY(y);
    updatePosition(physics.x / physics.width, y, true);
  }

  // Function to handle pad release
  function handlePadRelease() {
    isPadActive = false;

    // Start physics simulation if enabled
    if (isPhysicsEnabled) {
      physics.start((px, py) => {
        updatePosition(px, py, false);
        window.nanoX = px;
        window.nanoY = py;
      });
    } else {
      physics.stop();
    }
  }

  // Handle physics controls
  physicsCheckbox.addEventListener("change", () => {
    isPhysicsEnabled = physicsCheckbox.checked;
    paramsSection.style.display = isPhysicsEnabled ? "flex" : "none";
    localStorage.setItem('hydractrl-xy-physics', isPhysicsEnabled);
    if (!isPhysicsEnabled) {
      physics.stop();
    }
    // setTimeout(() => savePosition(), 100);
  });

  function updatePhysicsParams() {
    physics.updateParams({
      friction: parseFloat(frictionControl.slider.value),
      bounce: parseFloat(bounceControl.slider.value)
    });
  }

  // Update indicator position based on XY values
  function updatePosition(x, y, isActive = true) {
    // Clamp values between 0 and 1
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    const left = x * padArea.offsetWidth;
    const top = (1 - y) * padArea.offsetHeight; // Invert Y axis to match MIDI orientation
    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;
    indicator.style.backgroundColor = isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)";
    indicator.style.opacity = isActive ? "1" : "0.5";

    // Return normalized values for MIDI output
    return { x, y };
  }

  // Show/hide panel
  function togglePanel(show) {
    panel.style.visibility = show ? "visible" : "hidden";
    localStorage.setItem('hydractrl-xy-pad-visible', show);
  }

  // Create panel interface
  const panelInterface = {
    panel,
    updatePosition,
    updateFromMIDIX,
    updateFromMIDIY,
    handlePadRelease,
    togglePanel,
    isVisible: () => panel.style.visibility === "visible"
  };

  // Register with MIDI manager if available
  if (window.midiManager) {
    window.midiManager.setXYPadPanel(panelInterface);
  }

  return panelInterface;
}
