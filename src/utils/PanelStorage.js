/**
 * Panel Storage Utility
 * Saves and restores panel positions and sizes in localStorage
 */

// Prefix for localStorage keys to avoid collisions
const PREFIX = 'hydractrl_panel_';

/**
 * Save panel position and size to localStorage
 * @param {string} panelId - Unique identifier for the panel
 * @param {Object} position - Position and size data to save
 */
export function savePanelPosition(panelId, position) {
  try {
    localStorage.setItem(PREFIX + panelId, JSON.stringify(position));
  } catch (error) {
    console.warn('Failed to save panel position:', error);
  }
}

/**
 * Load panel position and size from localStorage
 * @param {string} panelId - Unique identifier for the panel
 * @returns {Object|null} Position and size data or null if not found
 */
export function loadPanelPosition(panelId) {
  try {
    const stored = localStorage.getItem(PREFIX + panelId);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load panel position:', error);
    return null;
  }
}

/**
 * Makes a panel position and size persistent
 * @param {HTMLElement} element - The panel element 
 * @param {string} panelId - Unique identifier for the panel
 * @param {Object} defaultPosition - Default position to use if none is stored
 * @returns {Object} Methods to update and save positions
 */
export function setupPanelPersistence(element, panelId, defaultPosition = {}) {
  // Load saved position or use defaults
  const savedPosition = loadPanelPosition(panelId);
  const position = savedPosition || defaultPosition;
  
  // Apply initial position if available
  if (position.left !== undefined) element.style.left = position.left + 'px';
  if (position.top !== undefined) element.style.top = position.top + 'px';
  if (position.width !== undefined && position.width !== 'auto') element.style.width = position.width + 'px';
  if (position.height !== undefined && position.height !== 'auto') element.style.height = position.height + 'px';
  
  // Create an observer to monitor size changes (for resizable panels)
  const resizeObserver = new ResizeObserver(entries => {
    // Don't save while dragging to avoid excessive saves
    if (element.classList.contains('dragging')) return;
    
    for (const entry of entries) {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      
      // Get current position
      const currentPosition = {
        left: parseInt(element.style.left || '0'),
        top: parseInt(element.style.top || '0'),
        width,
        height
      };
      
      // Save to localStorage
      savePanelPosition(panelId, currentPosition);
    }
  });
  
  // Start observing
  resizeObserver.observe(element);
  
  // Function to save position (called after dragging)
  const savePosition = () => {
    const currentPosition = {
      left: parseInt(element.style.left || '0'),
      top: parseInt(element.style.top || '0'),
      width: element.offsetWidth,
      height: element.offsetHeight
    };
    
    savePanelPosition(panelId, currentPosition);
  };
  
  return {
    savePosition,
    disconnect: () => resizeObserver.disconnect()
  };
}

/**
 * Enhances a draggable element to save position when moved
 * @param {function} makeDraggable - The original makeDraggable function
 * @returns {function} An enhanced makeDraggable function
 */
export function enhanceMakeDraggable(makeDraggable) {
  return function(element, handle, panelId) {
    // Keep track of the persistence controller
    let persistence = null;
    
    if (panelId) {
      const defaultPosition = {
        left: parseInt(element.style.left || '20'),
        top: parseInt(element.style.top || '20'),
        width: element.offsetWidth || 'auto',
        height: element.offsetHeight || 'auto'
      };
      
      persistence = setupPanelPersistence(element, panelId, defaultPosition);
    }
    
    // Call the original makeDraggable function
    const originalDraggable = makeDraggable(element, handle);
    
    // If we have a handle and persistence, enhance the mouseup event
    if (handle && persistence) {
      const originalMouseUp = handle.onmouseup;
      
      // Create a new mouseup handler
      handle.addEventListener('mouseup', () => {
        // Save the new position after dragging
        persistence.savePosition();
        
        // Call the original mouseup if it exists
        if (originalMouseUp) originalMouseUp();
      });
    }
    
    return originalDraggable;
  };
}