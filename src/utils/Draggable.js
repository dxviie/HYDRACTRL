import { loadPanelPosition, savePanelPosition } from "./PanelStorage.js";

/**
 * Follow one pointer (mouse, finger or pen) from a press on `target` until it
 * lets go. `start` gets the pointerdown event and can return false to ignore
 * it; `move` and `end` only get that pointer's events, so a second finger
 * cannot take over a drag. Sets `touch-action: none` on the target, without
 * which touch screens scroll or zoom the page instead of dragging.
 * @param {HTMLElement} target - Where the drag starts (a handle, a grip).
 * @param {object} handlers
 * @param {(e: PointerEvent) => boolean | void} [handlers.start]
 * @param {(e: PointerEvent) => void} handlers.move
 * @param {(e: PointerEvent) => void} [handlers.end]
 */
export function trackPointerDrag(target, { start, move, end }) {
  let pointerId = null;

  function onMove(e) {
    if (e.pointerId === pointerId) move(e);
  }

  function onRelease(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onRelease);
    document.removeEventListener("pointercancel", onRelease);
    end?.(e);
  }

  target.style.touchAction = "none";
  target.addEventListener("pointerdown", (e) => {
    // One pointer at a time, and a mouse only drags with its main button
    if (pointerId !== null || e.button !== 0) return;
    if (start?.(e) === false) return;
    pointerId = e.pointerId;
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onRelease);
    document.addEventListener("pointercancel", onRelease);
  });
}

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

  // Pointer down handler
  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();

    // Calculate initial pointer position
    initialX = e.clientX;
    initialY = e.clientY;

    // Get current element position from inline style
    currentX = Number.parseInt(element.style.left || "0");
    currentY = Number.parseInt(element.style.top || "0");

    // Start dragging
    isDragging = true;
    element.classList.add("dragging");
  }

  // Pointer move handler
  function onPointerMove(e) {
    if (!isDragging) return;

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

  // Pointer up handler
  function onPointerUp() {
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
  }

  trackPointerDrag(handle, { start: onPointerDown, move: onPointerMove, end: onPointerUp });
}
