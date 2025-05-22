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
  panel.style.top = "20px";
  panel.style.left = "20px";
  panel.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity))";
  panel.style.borderRadius = "8px";
  panel.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
  panel.style.backdropFilter = "blur(var(--color-panel-blur))";
  panel.style.zIndex = "100";

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
  handle.style.borderRadius = "8px 8px 0 0";

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
  padArea.style.backgroundColor = "rgba(var(--color-bg-tertiary-rgb), 0.3)";
  padArea.style.borderRadius = "4px";
  padArea.style.position = "relative";
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
  const createParamSlider = (name, min, max, value, step = 0.01) => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "8px";

    const label = document.createElement("label");
    label.textContent = name;
    label.style.fontSize = "11px";
    label.style.color = "var(--color-text-secondary)";
    label.style.width = "60px";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.value = value;
    slider.step = step;
    slider.style.flex = "1";

    const value_display = document.createElement("span");
    value_display.textContent = value;
    value_display.style.fontSize = "11px";
    value_display.style.color = "var(--color-text-secondary)";
    value_display.style.width = "40px";
    value_display.style.textAlign = "right";

    slider.addEventListener("input", () => {
      value_display.textContent = slider.value;
      updatePhysicsParams();
    });

    container.appendChild(label);
    container.appendChild(slider);
    container.appendChild(value_display);
    return { container, slider };
  };

  const frictionControl = createParamSlider("Friction", 0.5, 0.999, 0.97);
  const bounceControl = createParamSlider("Bounce", 0, 1, 0.7);
  const gravityControl = createParamSlider("Gravity", -1000, 1000, 0, 1);

  paramsSection.appendChild(frictionControl.container);
  paramsSection.appendChild(bounceControl.container);
  paramsSection.appendChild(gravityControl.container);

  controlsSection.appendChild(physicsToggle);
  controlsSection.appendChild(paramsSection);

  // Add everything to the panel
  panel.appendChild(handle);
  panel.appendChild(padArea);
  panel.appendChild(controlsSection);
  document.body.appendChild(panel);

  // Set up panel position persistence
  const { savePosition } = setupPanelPersistence(panel, 'xy-pad', {
    left: 20,
    top: 20,
    width: 256, // 240px pad + 16px margins
    height: 'fit-content'
  });

  // Initialize physics system
  const physics = new XYPhysics(padArea.offsetWidth, padArea.offsetHeight);
  let isPhysicsEnabled = physicsCheckbox.checked;

  // Track pad interaction state
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

  // Handle XY pad interaction
  padArea.addEventListener("mousedown", (e) => {
    isPadActive = true;
    physics.stop();
    updatePadPosition(e);
  });

  padArea.addEventListener("mousemove", (e) => {
    if (!isPadActive) return;
    updatePadPosition(e);
  });

  document.addEventListener("mouseup", () => {
    if (!isPadActive) return;
    isPadActive = false;

    if (isPhysicsEnabled) {
      const now = performance.now();
      const dt = (now - lastPadTime) / 1000;
      if (dt > 0 && dt < 0.1) { // Only apply velocity if the time delta is reasonable
        const vx = (physics.x - lastPadX) / dt;
        const vy = (physics.y - lastPadY) / dt;
        physics.setVelocity(vx, vy);
        physics.start((x, y) => updatePosition(x, y, true));
      }
    }
  });

  // Update pad position from mouse event
  function updatePadPosition(e) {
    const rect = padArea.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height; // Invert Y axis

    // Store last position and time for velocity calculation
    lastPadX = physics.x;
    lastPadY = physics.y;
    lastPadTime = performance.now();

    // Update physics position
    physics.setPosition(x, y);
    updatePosition(x, y, true);
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
      bounce: parseFloat(bounceControl.slider.value),
      gravity: parseFloat(gravityControl.slider.value)
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

  return {
    togglePanel,
    updatePosition,
    isVisible: () => panel.style.visibility === "visible"
  };
}
