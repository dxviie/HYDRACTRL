/**
 * XY Pad Panel
 * A visual representation of the Korg nanoPAD's XY pad
 */
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
  panel.style.display = "none"; // Hidden by default

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

  // Create close button
  const closeButton = document.createElement("div");
  closeButton.className = "xy-pad-close";
  closeButton.style.fontSize = "16px";
  closeButton.style.color = "var(--color-text-secondary)";
  closeButton.style.cursor = "pointer";
  closeButton.style.opacity = "0.7";
  closeButton.textContent = "×";
  closeButton.style.transition = "opacity 0.2s ease";
  closeButton.addEventListener("mouseenter", () => closeButton.style.opacity = "1");
  closeButton.addEventListener("mouseleave", () => closeButton.style.opacity = "0.7");

  // Add title and close button to handle
  handle.appendChild(title);
  handle.appendChild(closeButton);

  // Create the XY pad visualization area (4:3 aspect ratio)
  const padArea = document.createElement("div");
  padArea.className = "xy-pad-area";
  padArea.style.width = "240px"; // 4:3 ratio
  padArea.style.height = "180px";
  padArea.style.margin = "8px";
  padArea.style.backgroundColor = "rgba(var(--color-bg-tertiary-rgb), 0.3)";
  padArea.style.borderRadius = "4px";
  padArea.style.position = "relative";

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

  // Add everything to the panel
  panel.appendChild(handle);
  panel.appendChild(padArea);
  document.body.appendChild(panel);

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

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target === handle) {
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  // Update indicator position based on XY values
  function updatePosition(x, y, isActive = true) {
    const left = x * padArea.offsetWidth;
    const top = (1 - y) * padArea.offsetHeight; // Invert Y axis to match MIDI orientation
    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;
    indicator.style.backgroundColor = isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)";
    indicator.style.opacity = isActive ? "1" : "0.5";
  }

  // Show/hide panel
  function togglePanel(show) {
    panel.style.display = show ? "block" : "none";
  }

  // Close button handler
  closeButton.addEventListener("click", () => togglePanel(false));

  return {
    togglePanel,
    updatePosition,
    isVisible: () => panel.style.display === "block"
  };
}
