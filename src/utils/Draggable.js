import { loadPanelPosition, savePanelPosition } from "./PanelStorage.js";

/**
 * Make an element draggable by a handle, with optional position persistence.
 * @param {HTMLElement} element - The element to move.
 * @param {HTMLElement} handle - The drag handle (usually a header bar).
 * @param {string} [panelId] - When set, the position is saved/restored via PanelStorage.
 */
export function makeDraggable(element, handle, panelId) {
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
    // Load saved position or get current position
    const savedPosition = panelId ? loadPanelPosition(panelId) : null;

    if (savedPosition) {
      currentX = savedPosition.left;
      currentY = savedPosition.top;
      element.style.left = currentX + "px";
      element.style.top = currentY + "px";
      element.style.transform = "none"; // Remove center transform
    } else {
      // Get current position from transform if centered
      const rect = element.getBoundingClientRect();
      currentX = rect.left;
      currentY = rect.top;
      element.style.left = currentX + "px";
      element.style.top = currentY + "px";
      element.style.transform = "none"; // Remove center transform
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

    // Calculate initial mouse position
    initialX = e.clientX;
    initialY = e.clientY;

    // Get current element position from inline style
    currentX = Number.parseInt(element.style.left || "0");
    currentY = Number.parseInt(element.style.top || "0");

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
  function onMouseUp() {
    if (!isDragging) return;

    // Update current position with final offsets
    currentX = Number.parseInt(element.style.left || "0");
    currentY = Number.parseInt(element.style.top || "0");

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
