/**
 * Slots Panel Component
 * A draggable panel with 16 slots for saving and loading Hydra programs
 */
export function createSlotsPanel(editor, hydra, runCode) {
  // Create the panel container
  const panel = document.createElement('div');
  panel.className = 'slots-panel';
  panel.style.position = 'absolute';
  panel.style.bottom = '20px';
  panel.style.right = '20px';
  panel.style.backgroundColor = 'rgba(37, 37, 37, 0.7)';
  panel.style.borderRadius = '8px';
  panel.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
  panel.style.backdropFilter = 'blur(5px)';
  panel.style.zIndex = '100';
  panel.style.overflow = 'hidden';
  panel.style.width = 'auto';
  panel.style.padding = '8px';
  
  // Create the handle
  const handle = document.createElement('div');
  handle.className = 'slots-handle';
  handle.style.height = '24px';
  handle.style.backgroundColor = 'rgba(60, 60, 60, 0.7)';
  handle.style.display = 'flex';
  handle.style.justifyContent = 'space-between';
  handle.style.alignItems = 'center';
  handle.style.padding = '0 8px';
  handle.style.cursor = 'move';
  handle.style.userSelect = 'none';
  handle.style.marginBottom = '8px';
  handle.style.borderRadius = '4px';
  
  // Create the title
  const title = document.createElement('div');
  title.className = 'slots-title';
  title.style.fontSize = '12px';
  title.style.fontWeight = 'bold';
  title.style.textTransform = 'uppercase';
  title.style.color = '#aaa';
  title.textContent = 'SLOTS';
  
  // Create the toggle button (optional for future expansion)
  const toggle = document.createElement('div');
  toggle.className = 'slots-toggle';
  toggle.style.fontSize = '10px';
  toggle.style.color = '#aaa';
  toggle.style.padding = '2px 4px';
  toggle.style.cursor = 'pointer';
  toggle.textContent = '▲';
  
  // Create the content container
  const content = document.createElement('div');
  content.className = 'slots-content';
  
  // Create slots grid - 2 rows of 8 slots
  const slotsGrid = document.createElement('div');
  slotsGrid.className = 'slots-grid';
  slotsGrid.style.display = 'grid';
  slotsGrid.style.gridTemplateColumns = 'repeat(8, 1fr)';
  slotsGrid.style.gridTemplateRows = 'repeat(2, 1fr)';
  slotsGrid.style.gap = '4px';
  slotsGrid.style.width = '100%';
  
  // Local storage key prefix
  const STORAGE_KEY_PREFIX = 'hydractrl-slot-';
  
  // Keep track of which slot is active
  let activeSlotIndex = 0; // Default to first slot
  
  // Store slot elements for easy access
  const slotElements = [];
  
  // Create 16 slots
  for (let i = 0; i < 16; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.index = i;
    slot.style.backgroundColor = 'rgba(30, 30, 30, 0.7)';
    slot.style.borderRadius = '4px';
    slot.style.cursor = 'pointer';
    slot.style.height = '40px';
    slot.style.width = '40px';
    slot.style.display = 'flex';
    slot.style.justifyContent = 'center';
    slot.style.alignItems = 'center';
    slot.style.position = 'relative';
    slot.style.overflow = 'hidden';
    slot.style.border = '1px solid rgba(80, 80, 80, 0.3)';
    
    // Add index overlay
    const index = document.createElement('div');
    index.className = 'slot-index';
    index.style.position = 'absolute';
    index.style.bottom = '2px';
    index.style.right = '2px';
    index.style.fontSize = '8px';
    index.style.fontWeight = 'bold';
    index.style.color = 'rgba(255, 255, 255, 0.7)';
    index.textContent = (i + 1).toString();
    
    // Thumbnail container for preview images
    const thumbnail = document.createElement('div');
    thumbnail.className = 'slot-thumbnail';
    thumbnail.style.width = '100%';
    thumbnail.style.height = '100%';
    thumbnail.style.backgroundSize = 'cover';
    thumbnail.style.backgroundPosition = 'center';
    
    // Add click event to select slot
    slot.addEventListener('click', () => {
      setActiveSlot(i);
    });
    
    // Assemble the slot
    slot.appendChild(thumbnail);
    slot.appendChild(index);
    slotsGrid.appendChild(slot);
    slotElements.push(slot);
  }
  
  // Function to update active slot styling
  function setActiveSlot(index) {
    // Remove active class from previous active slot
    slotElements[activeSlotIndex].style.border = '1px solid rgba(80, 80, 80, 0.3)';
    
    // Update active slot index
    activeSlotIndex = index;
    
    // Add active class to new active slot
    slotElements[activeSlotIndex].style.border = '2px solid rgba(255, 200, 0, 0.8)';
    
    // Load code from storage if available
    loadSlot(activeSlotIndex);
  }
  
  // Function to save current code to active slot
  function saveToActiveSlot() {
    // Get code from editor
    const code = editor.state.doc.toString();
    
    // Save to localStorage with slot index
    const storageKey = `${STORAGE_KEY_PREFIX}${activeSlotIndex}`;
    localStorage.setItem(storageKey, code);
    
    // Capture screenshot
    captureScreenshot(activeSlotIndex);
    
    // Show temporary "Saved to Slot!" notification
    const savedNotification = document.createElement('div');
    savedNotification.className = 'saved-notification';
    savedNotification.textContent = `Saved to Slot ${activeSlotIndex + 1}!`;
    document.body.appendChild(savedNotification);
    
    setTimeout(() => {
      savedNotification.classList.add('fade-out');
      setTimeout(() => {
        if (savedNotification.parentNode) {
          document.body.removeChild(savedNotification);
        }
      }, 500);
    }, 1500);
  }
  
  // Function to load code from slot
  function loadSlot(index) {
    const storageKey = `${STORAGE_KEY_PREFIX}${index}`;
    const savedCode = localStorage.getItem(storageKey);
    
    if (savedCode) {
      // Load code into editor
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: savedCode }
      });
      
      // Run the code
      runCode(editor, hydra);
    }
  }
  
  // Function to capture screenshot of canvas and set as slot thumbnail
  function captureScreenshot(index) {
    try {
      // Get the canvas element
      const canvas = document.querySelector('#hydra-canvas canvas');
      if (!canvas) return;
      
      // Create thumbnail image from canvas
      const thumbnail = canvas.toDataURL('image/jpeg', 0.7); // Use JPEG with 70% quality for smaller size
      
      // Save thumbnail to localStorage
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${index}-thumbnail`, thumbnail);
      
      // Update the slot thumbnail
      const thumbnailElement = slotElements[index].querySelector('.slot-thumbnail');
      thumbnailElement.style.backgroundImage = `url(${thumbnail})`;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    }
  }
  
  // Load all saved slots on startup
  function loadAllSlots() {
    for (let i = 0; i < 16; i++) {
      // Load thumbnails
      const thumbnail = localStorage.getItem(`${STORAGE_KEY_PREFIX}${i}-thumbnail`);
      if (thumbnail) {
        const thumbnailElement = slotElements[i].querySelector('.slot-thumbnail');
        thumbnailElement.style.backgroundImage = `url(${thumbnail})`;
      }
    }
    
    // Set the first slot as active by default
    setActiveSlot(0);
  }
  
  // Assemble the panel
  handle.appendChild(title);
  handle.appendChild(toggle);
  
  content.appendChild(slotsGrid);
  
  panel.appendChild(handle);
  panel.appendChild(content);
  
  // Add to document
  document.body.appendChild(panel);
  
  // Make draggable
  makeDraggable(panel, handle);
  
  // Load all saved slots
  loadAllSlots();
  
  // Return API
  return {
    panel,
    saveToActiveSlot,
    loadSlot,
    getActiveSlotIndex: () => activeSlotIndex,
    setActiveSlot
  };
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
    
    // Calculate position based on right alignment
    const rightOffset = parseInt(element.style.right || '0');
    currentX = window.innerWidth - rect.width - rightOffset;
    currentY = parseInt(element.style.bottom || '0');
    
    // Set explicit left position based on current right position
    element.style.left = currentX + 'px';
    
    console.log('Initial position set:', currentX, currentY);
  }, 100);
  
  // Mouse down handler
  function onMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Critical: Remove right positioning before starting drag
    if (element.style.right) {
      element.style.right = '';
    }
    
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