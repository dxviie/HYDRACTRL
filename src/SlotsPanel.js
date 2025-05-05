/**
 * Slots Panel Component
 * A draggable panel with 16 slots for saving and loading Hydra programs
 */
export function createSlotsPanel(editor, hydra, runCode) {
  // Create the panel container
  const panel = document.createElement('div');
  panel.className = 'slots-panel';
  panel.style.position = 'absolute';
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

  // Create the title container
  const titleContainer = document.createElement('div');
  titleContainer.className = 'slots-title-container';
  titleContainer.style.display = 'flex';
  titleContainer.style.alignItems = 'center';
  titleContainer.style.gap = '8px';

  // Create the title
  const title = document.createElement('div');
  title.className = 'slots-title';
  title.style.fontSize = '12px';
  title.style.fontWeight = 'bold';
  title.style.textTransform = 'uppercase';
  title.style.color = '#aaa';
  title.textContent = 'SLOTS';

  // Create bank selector dots container
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'bank-selector';
  dotsContainer.style.display = 'flex';
  dotsContainer.style.gap = '5px';
  dotsContainer.style.alignItems = 'center';

  // Bank dot elements array
  const bankDots = [];

  // Create 4 bank selector dots
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement('div');
    dot.className = 'bank-dot';
    dot.dataset.bank = i;
    dot.style.width = '8px';
    dot.style.height = '8px';
    dot.style.borderRadius = '50%';
    dot.style.backgroundColor = i === 0 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
    dot.style.cursor = 'pointer';
    dot.style.transition = 'all 0.2s ease';

    // Add hover effect
    dot.addEventListener('mouseover', () => {
      const bank = parseInt(dot.dataset.bank);
      if (bank !== currentBank) {
        // Highlight with a brighter version of its current color
        if (bankHasContent(bank)) {
          dot.style.backgroundColor = 'rgba(255, 0, 234, 0.8)';
        } else {
          dot.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        }
        dot.style.transform = 'scale(1.1)';
      }
    });

    dot.addEventListener('mouseout', () => {
      // On mouseout, restore proper color based on content state
      updateBankDots();
    });

    // Add click handler to switch banks
    dot.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent drag from activating
      switchBank(i);
      
      // Only sync MIDI scene if no device is connected
      // This prevents conflicts when using a hardware controller
      if (window.midiManager && window.midiManager.setScene) {
        const midiConnected = window.midiManager.isConnected && window.midiManager.isConnected();
        if (!midiConnected) {
          window.midiManager.setScene(i);
        }
      }
    });

    dotsContainer.appendChild(dot);
    bankDots.push(dot);
  }

  // Add the title and dots to the title container
  titleContainer.appendChild(title);
  titleContainer.appendChild(dotsContainer);

  // Create the clear button
  const clearBtn = document.createElement('div');
  clearBtn.className = 'slots-clear';
  clearBtn.style.fontSize = '14px';
  clearBtn.style.color = '#ff4444';
  clearBtn.style.padding = '0px 6px';
  clearBtn.style.cursor = 'pointer';
  clearBtn.style.fontWeight = 'bold';
  clearBtn.style.borderRadius = '3px';
  clearBtn.style.lineHeight = '1';
  clearBtn.style.display = 'flex';
  clearBtn.style.alignItems = 'center';
  clearBtn.style.justifyContent = 'center';
  clearBtn.textContent = '×'; // Using × (multiplication sign) as it looks better than X

  // Add hover effect
  clearBtn.addEventListener('mouseover', () => {
    clearBtn.style.backgroundColor = 'rgba(255, 68, 68, 0.2)';
    clearBtn.style.transform = 'scale(1.1)';
  });

  clearBtn.addEventListener('mouseout', () => {
    clearBtn.style.backgroundColor = 'transparent';
    clearBtn.style.transform = 'scale(1)';
  });

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

  // Track current bank (0-3) and active slot
  let currentBank = 0; // Default to first bank
  let activeSlotIndex = 0; // Default to first slot

  // Storage key includes bank
  const getStorageKey = (bank, index) => `${STORAGE_KEY_PREFIX}bank-${bank}-slot-${index}`;

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

  // Function to cycle to next/previous bank
  function cycleBank(direction) {
    // Calculate new bank index with wrapping (0-3)
    const newBank = (currentBank + direction + 4) % 4;

    // Switch to the new bank
    switchBank(newBank);
  }

  // Function to check if a bank has any content
  function bankHasContent(bankIndex) {
    for (let i = 0; i < 16; i++) {
      if (localStorage.getItem(getStorageKey(bankIndex, i))) {
        return true;
      }
    }
    return false;
  }

  // Function to update the dots to reflect which banks have content
  function updateBankDots() {
    for (let i = 0; i < 4; i++) {
      if (i === currentBank) {
        // Active bank is white
        bankDots[i].style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        bankDots[i].style.transform = 'scale(1.1)';
      } else if (bankHasContent(i)) {
        // Bank with content is colored fuchsia
        bankDots[i].style.backgroundColor = 'rgba(255, 0, 234, 0.8)';
        bankDots[i].style.transform = 'scale(1)';
      } else {
        // Empty bank is dim
        bankDots[i].style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        bankDots[i].style.transform = 'scale(1)';
      }
    }
  }

  // Function to switch bank
  function switchBank(bankIndex) {
    if (bankIndex === currentBank) return;

    // Save current bank index
    currentBank = bankIndex;

    // Update bank indicator in title
    title.textContent = `SLOTS ${bankIndex + 1}`;

    // Update bank dots styling
    updateBankDots();

    // Load all thumbnails for the new bank
    loadAllSlotsForCurrentBank();

    // Set the first slot as active
    setActiveSlot(0);
  }

  // Function to update active slot styling
  function setActiveSlot(index, loadContent = true) {
    // Remove active class from previous active slot
    slotElements[activeSlotIndex].style.border = '1px solid rgba(80, 80, 80, 0.3)';

    // Update active slot index
    activeSlotIndex = index;

    // Add active class to new active slot
    slotElements[activeSlotIndex].style.border = '2px solid rgba(255, 200, 0, 0.8)';

    // Load code from storage if requested
    if (loadContent) {
      loadSlot(activeSlotIndex);
    }
  }

  // Function to save current code to active slot
  function saveToActiveSlot() {
    // Get code from editor
    const code = editor.state.doc.toString();

    // Save to localStorage with bank and slot index
    const storageKey = getStorageKey(currentBank, activeSlotIndex);
    localStorage.setItem(storageKey, code);

    // Update bank dots to reflect new content
    updateBankDots();

    // Run the code first (to ensure visuals are updated) then capture screenshot
    const success = runCode(editor, hydra);
    if (success) {
      // Capture screenshot with a longer delay to ensure rendering is complete
      captureScreenshot(currentBank, activeSlotIndex);
    }

    // Show temporary "Saved to Slot!" notification
    const savedNotification = document.createElement('div');
    savedNotification.className = 'saved-notification';
    savedNotification.textContent = `Saved to Bank ${currentBank + 1}, Slot ${activeSlotIndex + 1}!`;
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
  function loadSlot(index, runCodeAfterLoad = true) {
    const storageKey = getStorageKey(currentBank, index);
    const savedCode = localStorage.getItem(storageKey);

    if (savedCode) {
      // Load code into editor
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: savedCode }
      });

      // Run the code if requested
      if (runCodeAfterLoad) {
        runCode(editor, hydra);
      }

      return true;
    }

    return false;
  }

  // Function to capture screenshot of canvas and set as slot thumbnail
  function captureScreenshot(bankIndex, slotIndex) {
    try {
      // Delay capture to allow rendering to complete
      setTimeout(() => {
        // Get the canvas element
        const canvas = document.querySelector('#hydra-canvas canvas');
        if (!canvas) return;

        // Force a new animation frame to make sure rendering is complete
        requestAnimationFrame(() => {
          // Create thumbnail image from canvas
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7); // Use JPEG with 70% quality for smaller size

          // Save thumbnail to localStorage with bank and slot index
          localStorage.setItem(`${getStorageKey(bankIndex, slotIndex)}-thumbnail`, thumbnail);

          // Update the slot thumbnail if we're on the current bank
          if (bankIndex === currentBank) {
            const thumbnailElement = slotElements[slotIndex].querySelector('.slot-thumbnail');
            thumbnailElement.style.backgroundImage = `url(${thumbnail})`;
          }
        });
      }, 300); // Longer delay (300ms) to allow for rendering
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    }
  }

  // Function to load all thumbnails for the current bank
  function loadAllSlotsForCurrentBank() {
    // Clear all thumbnails first
    for (let i = 0; i < 16; i++) {
      const thumbnailElement = slotElements[i].querySelector('.slot-thumbnail');
      thumbnailElement.style.backgroundImage = '';
    }

    // Load thumbnails for current bank
    for (let i = 0; i < 16; i++) {
      const thumbnail = localStorage.getItem(`${getStorageKey(currentBank, i)}-thumbnail`);
      if (thumbnail) {
        const thumbnailElement = slotElements[i].querySelector('.slot-thumbnail');
        thumbnailElement.style.backgroundImage = `url(${thumbnail})`;
      }
    }
  }

  // Load all saved slots on startup
  function loadAllSlots() {
    // Set the bank title
    title.textContent = `SLOTS ${currentBank + 1}`;

    // Load thumbnails for the initial bank
    loadAllSlotsForCurrentBank();

    // Update bank dots to reflect which banks have content
    updateBankDots();

    // Set the first slot as active by default
    setActiveSlot(0);
  }

  // Assemble the panel
  handle.appendChild(titleContainer);
  handle.appendChild(clearBtn);

  // Function to clear all slots
  function clearAllSlots() {
    // Create confirmation options
    const options = [
      'Clear Current Bank',
      'Clear All Banks',
      'Cancel'
    ];

    const choice = confirm('Clear current bank only or all banks?');

    if (choice === null) {
      return; // User canceled
    }

    if (choice) {
      // Clear all banks
      for (let bank = 0; bank < 4; bank++) {
        for (let slot = 0; slot < 16; slot++) {
          localStorage.removeItem(getStorageKey(bank, slot));
          localStorage.removeItem(`${getStorageKey(bank, slot)}-thumbnail`);
        }
      }

      // Clear current bank's thumbnail display
      for (let i = 0; i < 16; i++) {
        const thumbnailElement = slotElements[i].querySelector('.slot-thumbnail');
        thumbnailElement.style.backgroundImage = '';
      }

      // Update bank dots
      updateBankDots();

      // Show notification
      const clearedNotification = document.createElement('div');
      clearedNotification.className = 'saved-notification';
      clearedNotification.style.backgroundColor = 'rgba(220, 50, 50, 0.8)';
      clearedNotification.textContent = 'Cleared All Banks!';
      document.body.appendChild(clearedNotification);

      setTimeout(() => {
        clearedNotification.classList.add('fade-out');
        setTimeout(() => {
          if (clearedNotification.parentNode) {
            document.body.removeChild(clearedNotification);
          }
        }, 500);
      }, 1500);
    } else {
      // Clear only current bank
      for (let i = 0; i < 16; i++) {
        localStorage.removeItem(getStorageKey(currentBank, i));
        localStorage.removeItem(`${getStorageKey(currentBank, i)}-thumbnail`);

        // Clear thumbnail display
        const thumbnailElement = slotElements[i].querySelector('.slot-thumbnail');
        thumbnailElement.style.backgroundImage = '';
      }

      // Update bank dots
      updateBankDots();

      // Show notification
      const clearedNotification = document.createElement('div');
      clearedNotification.className = 'saved-notification';
      clearedNotification.style.backgroundColor = 'rgba(220, 50, 50, 0.8)';
      clearedNotification.textContent = `Cleared Bank ${currentBank + 1}!`;
      document.body.appendChild(clearedNotification);

      setTimeout(() => {
        clearedNotification.classList.add('fade-out');
        setTimeout(() => {
          if (clearedNotification.parentNode) {
            document.body.removeChild(clearedNotification);
          }
        }, 500);
      }, 1500);
    }
  }

  // Add click handler for clear button
  clearBtn.addEventListener('click', clearAllSlots);

  content.appendChild(slotsGrid);

  panel.appendChild(handle);
  panel.appendChild(content);

  // Add to document
  document.body.appendChild(panel);

  // Make draggable
  makeDraggable(panel, handle);

  // Load all saved slots
  loadAllSlots();

  // Flash the active bank dot for visual feedback
  function flashActiveBankDot(bankIndex) {
    if (bankIndex < 0 || bankIndex >= bankDots.length) return;
    
    // Save original color and transform
    const originalColor = bankDots[bankIndex].style.backgroundColor;
    const originalTransform = bankDots[bankIndex].style.transform;
    
    // Flash effect
    bankDots[bankIndex].style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // Bright white
    bankDots[bankIndex].style.transform = 'scale(1.3)'; // Bigger
    bankDots[bankIndex].style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.7)'; // Glow
    
    // Reset after animation
    setTimeout(() => {
      bankDots[bankIndex].style.backgroundColor = originalColor;
      bankDots[bankIndex].style.transform = originalTransform;
      bankDots[bankIndex].style.boxShadow = 'none';
    }, 500);
  }
  
  // Make the flash function available globally
  window.flashActiveBankDot = flashActiveBankDot;
  
  // Return API
  return {
    panel,
    saveToActiveSlot,
    loadSlot,
    getActiveSlotIndex: () => activeSlotIndex,
    getBank: () => currentBank,
    setActiveSlot,
    clearAllSlots,
    switchBank,
    cycleBank,
    flashActiveBankDot
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

    // Calculate position based on bottom alignment
    const bottomOffset = parseInt(element.style.bottom || '0');
    currentY = window.innerHeight - rect.height - bottomOffset;

    // Set explicit left and top position
    element.style.left = currentX + 'px';
    element.style.top = currentY + 'px';

    // Remove the bottom positioning to prevent stretching
    element.style.bottom = '';

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