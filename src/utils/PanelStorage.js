/**
 * Panel Storage Utility
 * Saves and restores panel positions and sizes in localStorage
 */

// Prefix for localStorage keys to avoid collisions
const PREFIX = "hydractrl_panel_";

/**
 * Save panel position and size to localStorage
 * @param {string} panelId - Unique identifier for the panel
 * @param {Object} position - Position and size data to save
 */
export function savePanelPosition(panelId, position) {
  if (!panelId || !position) return;
  if (position.width === 0 || position.height === 0) return; // Avoid saving zero size
  try {
    localStorage.setItem(PREFIX + panelId, JSON.stringify(position));
  } catch (error) {
    console.warn("Failed to save panel position:", error);
  }
}

/**
 * Load panel position and size from localStorage with bounds checking
 * @param {string} panelId - Unique identifier for the panel
 * @returns {Object|null} Position and size data or null if not found
 */
export function loadPanelPosition(panelId) {
  try {
    const stored = localStorage.getItem(PREFIX + panelId);
    if (!stored) return null;

    const position = JSON.parse(stored);

    // Ensure position is within the viewport bounds
    const minPanelSize = 100; // Minimum visible panel size
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Adjust left position if it would place the panel too far off-screen
    if (position.left !== undefined) {
      // Keep at least minPanelSize pixels visible
      if (position.left > windowWidth - minPanelSize) {
        position.left = windowWidth - minPanelSize;
      }
      // Don't allow panels to be positioned too far left
      if (position.left < -position.width + minPanelSize) {
        position.left = 0;
      }
    }

    // Adjust top position if it would place the panel too far off-screen
    if (position.top !== undefined) {
      // Keep at least minPanelSize pixels visible
      if (position.top > windowHeight - minPanelSize) {
        position.top = windowHeight - minPanelSize;
      }
      // Don't allow panels to be positioned too far up
      if (position.top < 0) {
        position.top = 0;
      }
    }

    return position;
  } catch (error) {
    console.warn("Failed to load panel position:", error);
    return null;
  }
}

/**
 * Set up panel position persistence
 * @param {HTMLElement} element - The panel element
 * @param {string} panelId - Unique identifier for the panel
 * @param {Object} defaultPosition - Default position (left, top)
 * @param {Object} [options] - Additional options including size and behavior
 * @returns {Object} Methods to update and save positions
 */
export function setupPanelPersistence(element, panelId, defaultPosition = {}, options = {}) {
  // Load saved position or use defaults
  const savedPosition = loadPanelPosition(panelId);
  const position = savedPosition || defaultPosition;

  // Apply initial position
  if (position.left !== undefined) element.style.left = position.left + "px";
  if (position.top !== undefined) element.style.top = position.top + "px";

  // Apply size based on options
  if (options.skipSizeRestore) {
    // Use size from options, not from saved position
    if (options.width !== undefined) {
      element.style.width = typeof options.width === 'number' ? 
        options.width + "px" : options.width;
    }
    if (options.height !== undefined) {
      element.style.height = typeof options.height === 'number' ? 
        options.height + "px" : options.height;
    }
  } else {
    // Use saved size if available
    if (position.width !== undefined && position.width !== "auto") {
      element.style.width = position.width + "px";
    }
    if (position.height !== undefined && position.height !== "auto") {
      element.style.height = position.height + "px";
    }
  }

  // Create an observer to monitor size changes
  const resizeObserver = new ResizeObserver(() => {
    // Don't save while dragging to avoid excessive saves
    if (element.classList.contains("dragging")) return;
    savePosition();
  });

  // Start observing size changes
  resizeObserver.observe(element);

  // Function to save current position and optionally size
  function savePosition() {
    const currentPosition = {
      left: parseInt(element.style.left || "0"),
      top: parseInt(element.style.top || "0")
    };

    // Only save size if not using skipSizeRestore
    if (!options.skipSizeRestore) {
      currentPosition.width = element.offsetWidth;
      currentPosition.height = element.offsetHeight;
    }

    savePanelPosition(panelId, currentPosition);
  }

  // Return methods for external use
  return { savePosition, disconnect: () => resizeObserver.disconnect() };
}

/**
 * Enhances a draggable element to save position when moved
 * @param {function} makeDraggable - The original makeDraggable function
 * @returns {function} An enhanced makeDraggable function
 */
export function enhanceMakeDraggable(makeDraggable) {
  return function (element, handle, panelId) {
    // Keep track of the persistence controller
    let persistence = null;

    if (panelId) {
      const defaultPosition = {
        left: parseInt(element.style.left || "20"),
        top: parseInt(element.style.top || "20"),
        width: element.offsetWidth || "auto",
        height: element.offsetHeight || "auto",
      };

      persistence = setupPanelPersistence(element, panelId, defaultPosition);
    }

    // Call the original makeDraggable function
    const originalDraggable = makeDraggable(element, handle);

    // If we have a handle and persistence, enhance the mouseup event
    if (handle && persistence) {
      const originalMouseUp = handle.onmouseup;

      // Create a new mouseup handler
      handle.addEventListener("mouseup", () => {
        // Save the new position after dragging
        persistence.savePosition();

        // Call the original mouseup if it exists
        if (originalMouseUp) originalMouseUp();
      });
    }

    return originalDraggable;
  };
}
