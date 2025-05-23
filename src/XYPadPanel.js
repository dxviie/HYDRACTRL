/**
 * XY Pad Panel
 * A visual representation of the Korg nanoPAD's XY pad
 */
import { setupPanelPersistence, savePanelPosition } from './utils/PanelStorage.js';
import { XYPhysics } from './physics/XYPhysics.js';

export function createXYPadPanel() {
  // Create the panel container
  const panel = document.createElement("div");
  panel.className = "xy-pad-panel";
  panel.style.position = "absolute";
  panel.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity))";
  panel.style.borderRadius = "4px";
  panel.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.3)";
  panel.style.zIndex = "9";
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
  indicator.style.width = "20px";
  indicator.style.height = "20px";
  indicator.style.cursor = "pointer";
  indicator.style.borderRadius = "50%";
  indicator.style.backgroundColor = "var(--color-text-secondary)";
  indicator.style.transform = "translate(-50%, -50%)";
  indicator.style.transition = "background-color 0.3s ease";
  padArea.appendChild(indicator);

  // Create SVG for the coil line visualization
  const coilLineSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  coilLineSVG.style.position = "absolute";
  coilLineSVG.style.top = "0";
  coilLineSVG.style.left = "0";
  coilLineSVG.style.width = "240";
  coilLineSVG.style.height = "180";
  coilLineSVG.style.pointerEvents = "none"; // Pass mouse events through
  coilLineSVG.style.display = "none"; // Initially hidden
  padArea.appendChild(coilLineSVG);

  const coilLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  coilLine.setAttribute("stroke", "var(--color-text-primary)");
  coilLine.setAttribute("stroke-width", "2");
  coilLine.setAttribute("stroke-dasharray", "4 2"); // Dashed line for coil effect
  coilLineSVG.appendChild(coilLine);

  setTimeout(() => updatePosition(0.5, 0.5, false), 100);

  // Create physics controls section
  const controlsSection = document.createElement("div");
  controlsSection.style.padding = "0 8px 8px";
  controlsSection.style.display = "flex";
  controlsSection.style.flexDirection = "column";
  controlsSection.style.gap = "8px";

  // Physics parameters section (initially hidden)
  const paramsSection = document.createElement("div");
  paramsSection.style.display = "flex";
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

  const frictionControl = createParamSlider("Friction", 0, 0, 0.15);
  const bounceControl = createParamSlider("Bounce", 1, 0.3, 1);

  paramsSection.appendChild(frictionControl.container);
  paramsSection.appendChild(bounceControl.container);

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
  const isPhysicsEnabled = true;

  // Track pad interaction state and physics values
  let isPadActive = false;
  let isCoiling = false;
  let indicatorPixelX = 0, indicatorPixelY = 0;

  // Make the panel draggable
  makeDraggable(panel, handle, 'xy-pad');

  // --- Coil Interaction Logic ---
  const handleCoilMove = (e) => {
    if (!isCoiling) return;
    e.preventDefault();

    const rect = padArea.getBoundingClientRect();
    let mouseX = e.clientX - rect.left;
    let mouseY = e.clientY - rect.top;

    // Clamp mouse position to padArea boundaries
    mouseX = Math.max(0, Math.min(mouseX, padArea.offsetWidth));
    mouseY = Math.max(0, Math.min(mouseY, padArea.offsetHeight));

    coilLine.setAttribute("x2", mouseX);
    coilLine.setAttribute("y2", mouseY);
  };

  const handleCoilRelease = (e) => {
    if (!isCoiling) return;
    e.preventDefault();
    isCoiling = false;
    coilLineSVG.style.display = "none";

    document.removeEventListener("mousemove", handleCoilMove);
    document.removeEventListener("mouseup", handleCoilRelease);

    const rect = padArea.getBoundingClientRect();
    let releaseX = e.clientX - rect.left;
    let releaseY = e.clientY - rect.top;

    // Clamp release position to padArea boundaries
    releaseX = Math.max(0, Math.min(releaseX, padArea.offsetWidth));
    releaseY = Math.max(0, Math.min(releaseY, padArea.offsetHeight));

    // Calculate displacement (from release point to indicator's fixed point during coil)
    const dxPixels = indicatorPixelX - releaseX;
    const dyPixels = indicatorPixelY - releaseY;

    const velocityScale = 3; // Adjust this to control launch speed
    physics.vx = dxPixels * velocityScale;
    physics.vy = - dyPixels * velocityScale;

    // Physics will resume in the animate loop if isPhysicsEnabled is true
    // isPadActive remains false, user needs to click pad or indicator again
    isPadActive = false;

    if (isPhysicsEnabled) {
      physics.start((px, py) => {
        updatePosition(px, py, false);
        window.nanoX = px;
        window.nanoY = py;
      });
    }
  };

  indicator.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent padArea's mousedown if any were added later

    isCoiling = true;
    isPadActive = false; // Disable normal pad dragging/interaction
    physics.stop(); // Stop current physics movement

    // Store indicator's current position in pixels as the coil's anchor
    // Ensure physics.x and physics.y are up-to-date if not actively moving
    const currentIndicatorRect = indicator.getBoundingClientRect();
    const padAreaRect = padArea.getBoundingClientRect();
    indicatorPixelX = (currentIndicatorRect.left + currentIndicatorRect.width / 2) - padAreaRect.left;
    indicatorPixelY = (currentIndicatorRect.top + currentIndicatorRect.height / 2) - padAreaRect.top;

    // Update physics object's internal position to match the visual indicator before coiling
    // This ensures the coil starts from the visually correct point if physics was idle.
    physics.setPosition(indicatorPixelX / padArea.offsetWidth, 1 - (indicatorPixelY / padArea.offsetHeight));

    coilLine.setAttribute("x1", indicatorPixelX);
    coilLine.setAttribute("y1", indicatorPixelY);
    coilLine.setAttribute("x2", indicatorPixelX); // Initially, coil end is at indicator
    coilLine.setAttribute("y2", indicatorPixelY);
    coilLineSVG.style.display = "block";

    document.addEventListener("mousemove", handleCoilMove);
    document.addEventListener("mouseup", handleCoilRelease);
  });

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

/**
 * Make an element draggable
 */
function makeDraggable(element, handle, panelId) {
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
    // Only calculate from right if we don't have a saved position and right is specified
    if (!element.style.left && element.style.right) {
      // Get and store the initial position
      const rect = element.getBoundingClientRect();

      // Calculate position based on right alignment
      const rightOffset = parseInt(element.style.right || "0");
      currentX = window.innerWidth - rect.width - rightOffset;
      currentY = parseInt(element.style.top || "0");

      // Set explicit left position based on current right position
      element.style.left = currentX + "px";

      // Remove right positioning to prevent conflicts
      element.style.right = "";
    } else {
      // Already positioned by left/top (from saved position or default)
      currentX = parseInt(element.style.left || "0");
      currentY = parseInt(element.style.top || "0");
    }

    // Save initial position if we have a panelId
    if (panelId) {
      savePanelPosition(panelId, {
        left: currentX,
        top: currentY,
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    }
  }, 100);

  // Mouse down handler
  function onMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();

    // Critical: Remove right positioning before starting drag
    if (element.style.right) {
      element.style.right = "";
    }

    // Calculate initial mouse position
    initialX = e.clientX;
    initialY = e.clientY;

    // Get current element position from inline style
    // This fixes the initial jump by using the stored position
    currentX = parseInt(element.style.left || "0");
    currentY = parseInt(element.style.top || "0");

    // Start dragging
    isDragging = true;
    element.classList.add("dragging");

    // Add listeners
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
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
    const newY = Math.max(
      0,
      Math.min(window.innerHeight - element.offsetHeight, currentY + offsetY),
    );

    // Update position
    element.style.left = newX + "px";
    element.style.top = newY + "px";
  }

  // Mouse up handler
  function onMouseUp(e) {
    if (!isDragging) return;

    // Update current position with final offsets
    currentX = parseInt(element.style.left || "0");
    currentY = parseInt(element.style.top || "0");

    // Save position to localStorage if we have a panelId
    if (panelId) {
      savePanelPosition(panelId, {
        left: currentX,
        top: currentY,
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    }

    // End dragging
    isDragging = false;
    element.classList.remove("dragging");

    // Remove listeners
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  // Add listener to handle
  handle.addEventListener("mousedown", onMouseDown);
}
