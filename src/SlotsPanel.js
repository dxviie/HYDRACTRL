/**
 * Slots Panel Component
 * A draggable panel with 16 slots for saving and loading Hydra programs
 */
import { loadPanelPosition, savePanelPosition } from "./utils/PanelStorage.js";

export function createSlotsPanel(editor, hydra, runCode) {
  // Load saved position or use defaults
  const savedPosition = loadPanelPosition("slots-panel");

  // Create the panel container
  const panel = document.createElement("div");
  panel.className = "slots-panel";
  panel.style.position = "absolute";

  if (savedPosition) {
    panel.style.left = savedPosition.left + "px";
    panel.style.top = savedPosition.top + "px";
    // Don't apply width as slots panel has fixed width slots
  } else {
    panel.style.right = "20px";
    panel.style.top = "20px";
  }

  panel.style.backgroundColor = "var(--color-bg-secondary)";
  panel.style.borderRadius = "8px";
  panel.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
  panel.style.backdropFilter = "blur(var(--color-panel-blur))";
  panel.style.zIndex = "100";
  panel.style.overflow = "hidden";
  panel.style.width = "auto";
  panel.style.padding = "8px";

  // Create the handle
  const handle = document.createElement("div");
  handle.className = "slots-handle";
  handle.style.height = "24px";
  handle.style.backgroundColor = "var(--color-bg-tertiary)";
  handle.style.display = "flex";
  handle.style.justifyContent = "space-between";
  handle.style.alignItems = "center";
  handle.style.padding = "0 8px";
  handle.style.cursor = "move";
  handle.style.userSelect = "none";
  handle.style.marginBottom = "8px";
  handle.style.borderRadius = "4px";

  // Create the title container
  const titleContainer = document.createElement("div");
  titleContainer.className = "slots-title-container";
  titleContainer.style.display = "flex";
  titleContainer.style.alignItems = "center";
  titleContainer.style.gap = "8px";

  // Create the title
  const title = document.createElement("div");
  title.className = "slots-title";
  title.style.fontSize = "12px";
  title.style.fontWeight = "bold";
  title.style.textTransform = "uppercase";
  title.style.color = "var(--color-text-secondary)";
  title.textContent = "SCENE ";

  // Create bank selector dots container
  const dotsContainer = document.createElement("div");
  dotsContainer.className = "bank-selector";
  dotsContainer.style.display = "flex";
  dotsContainer.style.gap = "5px";
  dotsContainer.style.alignItems = "center";

  // Bank dot elements array
  const bankDots = [];

  // Create 4 bank selector dots
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement("div");
    dot.className = "bank-dot";
    dot.dataset.bank = i;
    dot.style.width = "8px";
    dot.style.height = "8px";
    dot.style.borderRadius = "50%";
    dot.style.backgroundColor = i === 0 ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.3)";
    dot.style.cursor = "pointer";
    dot.style.transition = "all 0.2s ease";

    // Add hover effect
    dot.addEventListener("mouseover", () => {
      const bank = parseInt(dot.dataset.bank);
      if (bank !== currentBank) {
        // Highlight with a brighter version of its current color
        if (bankHasContent(bank)) {
          dot.style.backgroundColor = "rgba(255, 0, 234, 0.8)";
        } else {
          dot.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
        }
        dot.style.transform = "scale(1.1)";
      }
    });

    dot.addEventListener("mouseout", () => {
      // On mouseout, restore proper color based on content state
      updateBankDots();
    });

    // Add click handler to switch banks
    dot.addEventListener("click", (e) => {
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

  // Create shortcuts label
  const shortcutsLabel = document.createElement("div");
  shortcutsLabel.className = "shortcut";
  shortcutsLabel.style.marginLeft = "4px";
  shortcutsLabel.innerHTML = "<span style='font-size: 10px; color: var(--color-text-secondary);'>Alt/⌥ + ←/→</span>";
  dotsContainer.appendChild(shortcutsLabel);

  // Create icons container
  const iconsContainer = document.createElement("div");
  iconsContainer.className = "slots-icons";
  iconsContainer.style.display = "flex";
  iconsContainer.style.alignItems = "center";
  iconsContainer.style.marginLeft = "1rem";
  iconsContainer.style.gap = "3px";

  // Create export button
  const exportBtn = document.createElement("div");
  exportBtn.className = "slots-export";
  exportBtn.title = "Export scenes (Alt/⌥ + X)";
  exportBtn.style.fontSize = "12px";
  exportBtn.style.width = "14px";
  exportBtn.style.height = "14px";
  exportBtn.style.display = "flex";
  exportBtn.style.alignItems = "center";
  exportBtn.style.justifyContent = "center";
  exportBtn.style.cursor = "pointer";
  exportBtn.style.color = "white";
  exportBtn.style.fontWeight = "bold";
  exportBtn.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><g fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'><path d='M12 16.5v-9M8.5 11L12 7.5l3.5 3.5'/><path d='M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z'/></g></svg>"
  // Create import button
  const importBtn = document.createElement("div");
  importBtn.className = "slots-import";
  importBtn.title = "Import scenes (Alt/⌥ + I)";
  importBtn.style.fontSize = "12px";
  importBtn.style.width = "14px";
  importBtn.style.height = "14px";
  importBtn.style.display = "flex";
  importBtn.style.alignItems = "center";
  importBtn.style.justifyContent = "center";
  importBtn.style.cursor = "pointer";
  importBtn.style.color = "white";
  importBtn.style.fontWeight = "bold";
  importBtn.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' style='transform: rotate(180deg);' width='32' height='32' viewBox='0 0 24 24'><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><g fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'><path d='M12 16.5v-9M8.5 11L12 7.5l3.5 3.5'/><path d='M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z'/></g></svg>"

  // Add icons to container
  iconsContainer.appendChild(exportBtn);
  iconsContainer.appendChild(importBtn);

  // Add the title, dots, and icons to the title container
  titleContainer.appendChild(title);
  titleContainer.appendChild(dotsContainer);

  // Create the clear button
  const clearBtn = document.createElement("div");
  clearBtn.className = "slots-clear";
  clearBtn.style.fontSize = "14px";
  clearBtn.style.color = "var(--color-error)";
  clearBtn.style.cursor = "pointer";
  clearBtn.style.fontWeight = "bold";
  clearBtn.style.borderRadius = "3px";
  clearBtn.style.lineHeight = "1";
  clearBtn.style.width = "14px";
  clearBtn.style.height = "14px";
  clearBtn.style.display = "flex";
  clearBtn.style.alignItems = "center";
  clearBtn.style.justifyContent = "center";
  clearBtn.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><path fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6zM15 9l-6 6m0-6l6 6'/></svg>"

  // Add hover effect
  clearBtn.addEventListener("mouseover", () => {
    clearBtn.style.backgroundColor = "rgba(255, 68, 68, 0.2)";
    clearBtn.style.transform = "scale(1.1)";
  });

  clearBtn.addEventListener("mouseout", () => {
    clearBtn.style.backgroundColor = "transparent";
    clearBtn.style.transform = "scale(1)";
  });

  // Create the content container
  const content = document.createElement("div");
  content.className = "slots-content";

  // Create slots grid - 2 rows of 8 slots
  const slotsGrid = document.createElement("div");
  slotsGrid.className = "slots-grid";
  slotsGrid.style.display = "grid";
  slotsGrid.style.gridTemplateColumns = "repeat(8, 1fr)";
  slotsGrid.style.gridTemplateRows = "repeat(2, 1fr)";
  slotsGrid.style.gap = "4px";
  slotsGrid.style.width = "100%";

  // Local storage key prefix
  const STORAGE_KEY_PREFIX = "hydractrl-slot-";

  // Track current bank (0-3) and active slot
  let currentBank = 0; // Default to first bank
  let activeSlotIndex = 0; // Default to first slot

  // Storage key includes bank
  const getStorageKey = (bank, index) => `${STORAGE_KEY_PREFIX}bank-${bank}-slot-${index}`;

  // Store slot elements for easy access
  const slotElements = [];

  // Create 16 slots
  for (let i = 0; i < 16; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.index = i;
    slot.style.backgroundColor = "var(--color-bg-editor)";
    slot.style.borderRadius = "4px";
    slot.style.cursor = "pointer";
    slot.style.height = "40px";
    slot.style.width = "40px";
    slot.style.display = "flex";
    slot.style.justifyContent = "center";
    slot.style.alignItems = "center";
    slot.style.position = "relative";
    slot.style.overflow = "hidden";
    slot.style.border = "1px solid var(--color-bg-tertiary)";

    // Add index overlay
    const index = document.createElement("div");
    index.className = "slot-index";
    index.style.position = "absolute";
    index.style.bottom = "2px";
    index.style.right = "4px";
    index.style.fontSize = "12px";
    index.style.fontWeight = "bold";
    index.innerHTML = "<span style='font-size: 8px; margin-right: 2px;'>Alt/⌥ +</span>" + i.toString(16).toUpperCase();

    // Thumbnail container for preview images
    const thumbnail = document.createElement("div");
    thumbnail.className = "slot-thumbnail";
    thumbnail.style.width = "100%";
    thumbnail.style.height = "100%";
    thumbnail.style.backgroundSize = "cover";
    thumbnail.style.backgroundPosition = "center";

    // Add click event to select slot
    slot.addEventListener("click", () => {
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
        bankDots[i].style.backgroundColor = "rgba(255, 255, 255, 0.8)";
        bankDots[i].style.transform = "scale(1.1)";
      } else if (bankHasContent(i)) {
        // Bank with content is colored fuchsia
        bankDots[i].style.backgroundColor = "rgba(255, 0, 234, 0.8)";
        bankDots[i].style.transform = "scale(1)";
      } else {
        // Empty bank is dim
        bankDots[i].style.backgroundColor = "rgba(255, 255, 255, 0.3)";
        bankDots[i].style.transform = "scale(1)";
      }
    }
  }

  // Function to switch bank
  function switchBank(bankIndex) {
    if (bankIndex === currentBank) return;

    // Save current bank index
    currentBank = bankIndex;

    // Update bank indicator in title
    title.textContent = `SCENE ${bankIndex + 1}`;

    // Update bank dots styling
    updateBankDots();

    // Load all thumbnails for the new bank
    loadAllSlotsForCurrentBank();

    // Set the first slot as active
    setActiveSlot(0);
  }

  // Function to update active slot styling
  async function setActiveSlot(index, loadContent = true) {
    // Remove active class from previous active slot
    slotElements[activeSlotIndex].style.border = "1px solid var(--color-bg-tertiary)";

    // Update active slot index
    activeSlotIndex = index;

    // Add active class to new active slot
    slotElements[activeSlotIndex].style.border = "2px solid var(--color-perf-medium)";

    // Load code from storage if requested
    if (loadContent) {
      await loadSlot(activeSlotIndex);
    }
  }

  // Function to save current code to active slot
  async function saveToActiveSlot() {
    try {
      // Get main code only - setup code is saved separately as user setting
      let codeToSave;
      if (editor.getCurrentTab && editor.getCurrentTab() === "main") {
        // Save current main tab content
        codeToSave = editor.getCode();
      } else if (editor.getTabCode) {
        // Get main tab content even if not currently active
        codeToSave = editor.getTabCode("main");
      } else {
        // Fallback for direct editor access
        codeToSave = editor.state.doc.toString();
      }

      // Store the target bank and slot for screenshot capture
      // This ensures the screenshot goes to the correct slot even if we change slots later
      const targetBank = currentBank;
      const targetSlot = activeSlotIndex;

      console.log(`Saving to bank ${targetBank}, slot ${targetSlot}`);

      // Save to localStorage with bank and slot index
      const storageKey = getStorageKey(targetBank, targetSlot);
      localStorage.setItem(storageKey, codeToSave);

      // Update bank dots to reflect new content
      updateBankDots();

      // Run the code first (to ensure visuals are updated) then capture screenshot
      const success = await runCode(editor, hydra);
      if (success) {
        // Capture screenshot with a longer delay to ensure rendering is complete
        // Pass the target bank and slot explicitly to ensure it's saved to the right place
        captureScreenshot(targetBank, targetSlot);
      }

      // Show temporary "Saved to Slot!" notification
      const savedNotification = document.createElement("div");
      savedNotification.className = "saved-notification";
      savedNotification.textContent = `Saved to Bank ${targetBank + 1}, Slot ${targetSlot + 1}`;
      document.body.appendChild(savedNotification);

      setTimeout(() => {
        savedNotification.classList.add("fade-out");
        setTimeout(() => {
          if (savedNotification.parentNode) {
            document.body.removeChild(savedNotification);
          }
        }, 500);
      }, 1500);

      // Return the target slot info so callers know where we saved
      // Make sure to return a plain object that can be serialized
      const result = { bank: targetBank, slot: targetSlot };
      console.log("Returning saved slot info:", result);
      return result;
    } catch (error) {
      console.error("Error saving to slot:", error);
      // Return current bank and slot as fallback
      return { bank: currentBank, slot: activeSlotIndex };
    }
  }

  // Function to load code from slot
  async function loadSlot(index, runCodeAfterLoad = true) {
    const storageKey = getStorageKey(currentBank, index);
    const savedCode = localStorage.getItem(storageKey);

    if (savedCode) {
      // Load main code into editor - setup code persists separately
      if (editor.getCurrentTab && editor.getCurrentTab() !== "main") {
        // Switch to main tab first if not already there
        const mainTabButton = document.querySelector('.editor-tab[data-tab="main"]');
        if (mainTabButton) {
          mainTabButton.click();
        }
      }
      
      // Load code into editor (this will be main code only)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: savedCode },
      });

      // Run the code if requested
      if (runCodeAfterLoad) {
        await runCode(editor, hydra);
      }

      return true;
    }

    return false;
  }

  // Function to check localStorage size and purge thumbnails if needed
  function checkAndPurgeLocalStorage() {
    try {
      // Calculate total localStorage size
      let totalSize = 0;
      let thumbnailKeys = [];

      // Iterate through all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);

        // Calculate size in bytes (approximate)
        const size = (key.length + value.length) * 2; // UTF-16 uses 2 bytes per character
        totalSize += size;

        // Collect thumbnail keys for potential purging
        if (key.includes('-thumbnail')) {
          thumbnailKeys.push({
            key,
            size,
            timeStamp: Number(localStorage.getItem(key + '-timestamp') || Date.now())
          });
        }
      }

      // Convert to MB
      const totalSizeMB = totalSize / (1024 * 1024);

      // If we're approaching the 5MB limit, start purging thumbnails
      // Starting with oldest ones first
      if (totalSizeMB > 4.5) {
        console.warn(`LocalStorage usage high (${totalSizeMB.toFixed(2)}MB). Purging old thumbnails.`);

        // Sort thumbnails by timestamp (oldest first)
        thumbnailKeys.sort((a, b) => a.timeStamp - b.timeStamp);

        // Purge thumbnails until we get below 4MB
        for (const item of thumbnailKeys) {
          localStorage.removeItem(item.key);
          localStorage.removeItem(item.key + '-timestamp');

          totalSize -= item.size;
          const newSizeMB = totalSize / (1024 * 1024);

          if (newSizeMB < 4.0) {
            console.log(`Purged thumbnails, new size: ${newSizeMB.toFixed(2)}MB`);
            break;
          }
        }

        // Reload thumbnails for current bank after purging
        loadAllSlotsForCurrentBank();
        return true; // Thumbnails were purged
      }

      return false; // No need to purge
    } catch (error) {
      console.error("Error checking localStorage size:", error);
      return false;
    }
  }

  // Function to capture screenshot of canvas and set as slot thumbnail
  function captureScreenshot(bankIndex, slotIndex) {
    try {
      // We need to preserve a reference to the exact slot we're capturing for
      const targetBankIndex = bankIndex;
      const targetSlotIndex = slotIndex;

      // Check and purge localStorage if needed before adding a new thumbnail
      checkAndPurgeLocalStorage();

      // Delay capture to allow rendering to complete
      setTimeout(() => {
        // Get the canvas element
        const canvas = document.querySelector("#hydra-canvas canvas");
        if (!canvas) return;

        // Force a new animation frame to make sure rendering is complete
        requestAnimationFrame(() => {
          // Create a tiny temporary canvas for the thumbnail (32x32 pixels)
          const thumbnailSize = 32;
          const tmpCanvas = document.createElement("canvas");
          tmpCanvas.width = thumbnailSize;
          tmpCanvas.height = thumbnailSize;
          const ctx = tmpCanvas.getContext("2d");

          // Apply smoothing for better thumbnail quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Draw the main canvas scaled down to our tiny canvas
          ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height,
            0, 0, thumbnailSize, thumbnailSize);

          // Create thumbnail image from the small canvas with very low quality
          const thumbnail = tmpCanvas.toDataURL("image/jpeg", 0.4); // Use JPEG with 40% quality for smaller size

          // Save thumbnail to localStorage with bank and slot index
          // We use the target indices here to ensure we're saving to the correct slot
          localStorage.setItem(`${getStorageKey(targetBankIndex, targetSlotIndex)}-thumbnail`, thumbnail);

          // Store timestamp for age-based purging
          localStorage.setItem(`${getStorageKey(targetBankIndex, targetSlotIndex)}-thumbnail-timestamp`, Date.now());

          // Update the slot thumbnail if the target bank is visible
          if (targetBankIndex === currentBank) {
            // Find the slot element using the preserved target slot index
            const thumbnailElement = slotElements[targetSlotIndex].querySelector(".slot-thumbnail");
            if (thumbnailElement) {
              thumbnailElement.style.backgroundImage = `url(${thumbnail})`;
            }
          }
        });
      }, 300); // Longer delay (300ms) to allow for rendering
    } catch (error) {
      console.error("Error capturing screenshot:", error);
    }
  }

  // Function to load all thumbnails for the current bank
  function loadAllSlotsForCurrentBank() {
    // Clear all thumbnails first
    for (let i = 0; i < 16; i++) {
      const thumbnailElement = slotElements[i].querySelector(".slot-thumbnail");
      thumbnailElement.style.backgroundImage = "";
    }

    // Load thumbnails for current bank
    for (let i = 0; i < 16; i++) {
      const storageKey = getStorageKey(currentBank, i);
      const hasCode = localStorage.getItem(storageKey);
      const thumbnail = localStorage.getItem(`${storageKey}-thumbnail`);
      const thumbnailElement = slotElements[i].querySelector(".slot-thumbnail");

      // Clear the thumbnail display first
      thumbnailElement.style.backgroundImage = "";
      thumbnailElement.style.backgroundColor = "";

      if (thumbnail) {
        // If we have a thumbnail, display it
        thumbnailElement.style.backgroundImage = `url(${thumbnail})`;
        thumbnailElement.style.backgroundColor = "";
        thumbnailElement.style.opacity = "1";
      } else if (hasCode) {
        // If we have code but no thumbnail, show a colored background
        thumbnailElement.style.backgroundColor = "var(--color-syntax-function)";
        thumbnailElement.style.opacity = "0.4";
        // Add a subtle border to indicate there's code
        slotElements[i].style.borderColor = "var(--color-syntax-function)";
      } else {
        // Reset border for empty slots
        slotElements[i].style.borderColor = "var(--color-bg-tertiary)";
      }
    }
  }

  // Load all saved slots on startup
  function loadAllSlots() {
    // Set the bank title
    title.textContent = `SCENE ${currentBank + 1}`;

    // Load thumbnails for the initial bank
    loadAllSlotsForCurrentBank();

    // Update bank dots to reflect which banks have content
    updateBankDots();

    // Set the first slot as active by default
    setActiveSlot(0);
  }

  // Assemble the panel
  handle.appendChild(titleContainer);
  iconsContainer.appendChild(clearBtn);
  handle.appendChild(iconsContainer);
  // handle.appendChild(clearBtn);

  // Function to clear all slots
  function clearAllSlots() {
    // Create confirmation options
    const options = ["Clear Current Bank", "Clear All Banks", "Clear All Thumbnails Only", "Cancel"];

    // Show dialog with options
    const message = "What would you like to clear?\n\n" +
      "1. Clear Current Bank - Removes all slots in the current bank\n" +
      "2. Clear All Banks - Removes all slots in all banks\n" +
      "3. Clear All Thumbnails Only - Keeps code but removes all thumbnails to save space";

    const choice = prompt(message, "1");

    if (choice === null || choice === "") {
      return; // User canceled
    }

    // Process based on user selection
    if (choice === "3" || choice.toLowerCase() === "thumbnails") {
      // Clear all thumbnails only (across all banks)
      let thumbnailCount = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('-thumbnail')) {
          localStorage.removeItem(key);
          thumbnailCount++;
        }
      }

      // Clear current bank's thumbnail display
      for (let i = 0; i < 16; i++) {
        const thumbnailElement = slotElements[i].querySelector(".slot-thumbnail");
        thumbnailElement.style.backgroundImage = "";
        thumbnailElement.style.backgroundColor = "";

        // Add colored background for slots that still have code
        const storageKey = getStorageKey(currentBank, i);
        const hasCode = localStorage.getItem(storageKey);
        if (hasCode) {
          thumbnailElement.style.backgroundColor = "var(--color-syntax-function)";
          thumbnailElement.style.opacity = "0.3";
        }
      }

      // Show notification
      const clearedNotification = document.createElement("div");
      clearedNotification.className = "saved-notification";
      clearedNotification.style.backgroundColor = "var(--color-perf-medium)";
      clearedNotification.textContent = `Cleared ${thumbnailCount} Thumbnails!`;
      document.body.appendChild(clearedNotification);

      setTimeout(() => {
        clearedNotification.classList.add("fade-out");
        setTimeout(() => {
          if (clearedNotification.parentNode) {
            document.body.removeChild(clearedNotification);
          }
        }, 500);
      }, 1500);

      return;
    }

    // Handle original clear options
    if (choice === "2" || choice.toLowerCase() === "all") {
      // Clear all banks
      for (let bank = 0; bank < 4; bank++) {
        for (let slot = 0; slot < 16; slot++) {
          localStorage.removeItem(getStorageKey(bank, slot));
          localStorage.removeItem(`${getStorageKey(bank, slot)}-thumbnail`);
          localStorage.removeItem(`${getStorageKey(bank, slot)}-thumbnail-timestamp`);
        }
      }

      // Clear current bank's thumbnail display
      for (let i = 0; i < 16; i++) {
        const thumbnailElement = slotElements[i].querySelector(".slot-thumbnail");
        thumbnailElement.style.backgroundImage = "";
        thumbnailElement.style.backgroundColor = "";
      }

      // Update bank dots
      updateBankDots();

      // Show notification
      const clearedNotification = document.createElement("div");
      clearedNotification.className = "saved-notification";
      clearedNotification.style.backgroundColor = "var(--color-error)";
      clearedNotification.textContent = "Cleared All Banks!";
      document.body.appendChild(clearedNotification);

      setTimeout(() => {
        clearedNotification.classList.add("fade-out");
        setTimeout(() => {
          if (clearedNotification.parentNode) {
            document.body.removeChild(clearedNotification);
          }
        }, 500);
      }, 1500);
    } else {
      // Clear only current bank (default option)
      for (let i = 0; i < 16; i++) {
        localStorage.removeItem(getStorageKey(currentBank, i));
        localStorage.removeItem(`${getStorageKey(currentBank, i)}-thumbnail`);
        localStorage.removeItem(`${getStorageKey(currentBank, i)}-thumbnail-timestamp`);

        // Clear thumbnail display
        const thumbnailElement = slotElements[i].querySelector(".slot-thumbnail");
        thumbnailElement.style.backgroundImage = "";
        thumbnailElement.style.backgroundColor = "";
      }

      // Update bank dots
      updateBankDots();

      // Show notification
      const clearedNotification = document.createElement("div");
      clearedNotification.className = "saved-notification";
      clearedNotification.style.backgroundColor = "var(--color-error)";
      clearedNotification.textContent = `Cleared Bank ${currentBank + 1}!`;
      document.body.appendChild(clearedNotification);

      setTimeout(() => {
        clearedNotification.classList.add("fade-out");
        setTimeout(() => {
          if (clearedNotification.parentNode) {
            document.body.removeChild(clearedNotification);
          }
        }, 500);
      }, 1500);
    }
  }

  // Add click handler for clear button
  clearBtn.addEventListener("click", clearAllSlots);

  content.appendChild(slotsGrid);

  panel.appendChild(handle);
  panel.appendChild(content);

  // Add to document
  document.body.appendChild(panel);

  // Make draggable with position persistence
  makeDraggable(panel, handle, "slots-panel");

  // Add window resize event listener to ensure panel stays on screen
  window.addEventListener("resize", () => {
    // Get current panel position
    const left = parseInt(panel.style.left || "0");
    const top = parseInt(panel.style.top || "0");

    // Ensure the panel stays within the viewport bounds
    const minVisiblePart = 100; // Minimum visible part in pixels
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Check horizontal position - ensure panel is not too far off-screen
    if (left > windowWidth - minVisiblePart) {
      panel.style.left = windowWidth - minVisiblePart + "px";
    }

    // Check vertical position - ensure panel is not too far off-screen
    if (top > windowHeight - minVisiblePart) {
      panel.style.top = windowHeight - minVisiblePart + "px";
    }
  });

  // Load all saved slots
  loadAllSlots();

  // Flash the active bank dot for visual feedback
  function flashActiveBankDot(bankIndex) {
    if (bankIndex < 0 || bankIndex >= bankDots.length) return;

    // Save original color and transform
    const originalColor = bankDots[bankIndex].style.backgroundColor;
    const originalTransform = bankDots[bankIndex].style.transform;

    // Flash effect
    bankDots[bankIndex].style.backgroundColor = "rgba(255, 255, 255, 0.9)"; // Bright white
    bankDots[bankIndex].style.transform = "scale(1.3)"; // Bigger
    bankDots[bankIndex].style.boxShadow = "0 0 10px rgba(255, 255, 255, 0.7)"; // Glow

    // Reset after animation
    setTimeout(() => {
      bankDots[bankIndex].style.backgroundColor = originalColor;
      bankDots[bankIndex].style.transform = originalTransform;
      bankDots[bankIndex].style.boxShadow = "none";
    }, 500);
  }

  // Make the flash function available globally
  window.flashActiveBankDot = flashActiveBankDot;

  // Function to export all filled slots in all banks
  function exportAllSlots() {
    // Create an object to hold all scenes data
    const scenesData = {
      version: 1,
      banks: [],
      exportDate: new Date().toISOString(),
    };

    // Loop through all banks
    for (let bankIndex = 0; bankIndex < 4; bankIndex++) {
      const bankData = {
        bankIndex,
        slots: [],
      };

      let hasFilledSlots = false;

      // Loop through all slots in this bank
      for (let slotIndex = 0; slotIndex < 16; slotIndex++) {
        const storageKey = getStorageKey(bankIndex, slotIndex);
        const code = localStorage.getItem(storageKey);
        const thumbnail = localStorage.getItem(`${storageKey}-thumbnail`);

        if (code) {
          hasFilledSlots = true;
          // Add slot data with base64 encoded content
          // Use encodeURIComponent before btoa to handle non-Latin1 characters
          const slotData = {
            slotIndex,
            code: btoa(encodeURIComponent(code)), // Safe base64 encoding
          };

          // Always include thumbnails in exports if available
          // Since we're now using tiny thumbnails, they should be small enough
          if (thumbnail) {
            slotData.thumbnail = thumbnail;
          }

          bankData.slots.push(slotData);
        }
      }

      // Only add banks that have filled slots
      if (hasFilledSlots) {
        scenesData.banks.push(bankData);
      }
    }

    // Check if there's data to export
    if (scenesData.banks.length === 0) {
      alert("No scenes found to export.");
      return;
    }

    // Convert to JSON and prepare for download
    const jsonData = JSON.stringify(scenesData, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `hydractrl-scenes-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up
    URL.revokeObjectURL(url);

    // Show notification
    const notification = document.createElement("div");
    notification.className = "saved-notification";
    notification.textContent = "Scenes exported successfully!";
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("fade-out");
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 500);
    }, 1500);
  }

  // Function to import slots from JSON file
  function importSlots() {
    // Create a file input element
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    // Set up file reader
    fileInput.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) {
        document.body.removeChild(fileInput);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const scenesData = JSON.parse(e.target.result);

          // Validate format
          if (!scenesData.version || !Array.isArray(scenesData.banks)) {
            throw new Error("Invalid scenes data format");
          }

          // Confirm import with user
          const confirmImport = confirm(
            `Import ${scenesData.banks.length} bank(s) of scenes?\nThis will overwrite any existing scenes in those slots.`,
          );

          if (confirmImport) {
            // Import all banks and slots
            scenesData.banks.forEach((bankData) => {
              const { bankIndex, slots } = bankData;

              if (bankIndex >= 0 && bankIndex < 4 && Array.isArray(slots)) {
                slots.forEach((slot) => {
                  if (slot.slotIndex >= 0 && slot.slotIndex < 16 && slot.code) {
                    try {
                      // Decode base64 code and handle non-Latin1 characters
                      const decodedCode = decodeURIComponent(atob(slot.code));

                      // Save to localStorage
                      const storageKey = getStorageKey(bankIndex, slot.slotIndex);
                      localStorage.setItem(storageKey, decodedCode);

                      // Always remove existing thumbnail first
                      localStorage.removeItem(`${storageKey}-thumbnail`);
                      localStorage.removeItem(`${storageKey}-thumbnail-timestamp`);

                      // Save thumbnail if available in the imported data
                      if (slot.thumbnail) {
                        localStorage.setItem(`${storageKey}-thumbnail`, slot.thumbnail);
                        localStorage.setItem(`${storageKey}-thumbnail-timestamp`, Date.now());
                      }
                    } catch (decodeError) {
                      console.error("Error decoding slot data:", decodeError);
                    }
                  }
                });
              }
            });

            // Reload current bank
            loadAllSlotsForCurrentBank();
            updateBankDots();

            // Execute the first slot that has code after import
            let firstSlotExecuted = false;
            for (let bankIndex = 0; bankIndex < 4 && !firstSlotExecuted; bankIndex++) {
              for (let slotIndex = 0; slotIndex < 16; slotIndex++) {
                const storageKey = getStorageKey(bankIndex, slotIndex);
                if (localStorage.getItem(storageKey)) {
                  // Switch to the bank if needed
                  if (bankIndex !== currentBank) {
                    switchBank(bankIndex);
                  }
                  // Set and load the first slot
                  setActiveSlot(slotIndex, true);
                  firstSlotExecuted = true;
                  break;
                }
              }
            }

            // Show notification
            const notification = document.createElement("div");
            notification.className = "saved-notification";
            notification.textContent = "Scenes imported successfully!";
            document.body.appendChild(notification);

            setTimeout(() => {
              notification.classList.add("fade-out");
              setTimeout(() => {
                if (notification.parentNode) {
                  document.body.removeChild(notification);
                }
              }, 500);
            }, 1500);
          }
        } catch (error) {
          console.error("Error importing scenes:", error);
          alert("Error importing scenes. Invalid file format.");
        }

        // Clean up file input
        document.body.removeChild(fileInput);
      };

      reader.onerror = () => {
        alert("Error reading file");
        document.body.removeChild(fileInput);
      };

      reader.readAsText(file);
    };

    // Trigger file selection
    fileInput.click();
  }

  // Add event listeners for export/import buttons
  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent drag from activating
    exportAllSlots();
  });

  importBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent drag from activating
    importSlots();
  });

  // Add hover effects for export/import buttons
  exportBtn.addEventListener("mouseover", () => {
    exportBtn.style.transform = "scale(1.2)";
    exportBtn.style.color = "rgba(255, 255, 255, 1)";
  });

  exportBtn.addEventListener("mouseout", () => {
    exportBtn.style.transform = "scale(1)";
    exportBtn.style.color = "white";
  });

  importBtn.addEventListener("mouseover", () => {
    importBtn.style.transform = "scale(1.2)";
    importBtn.style.color = "rgba(255, 255, 255, 1)";
  });

  importBtn.addEventListener("mouseout", () => {
    importBtn.style.transform = "scale(1)";
    importBtn.style.color = "white";
  });

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
    flashActiveBankDot,
    exportAllSlots,
    importSlots,
  };
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

      // Calculate position based on bottom alignment
      const bottomOffset = parseInt(element.style.bottom || "0");
      currentY = window.innerHeight - rect.height - bottomOffset;

      // Set explicit left and top position
      element.style.left = currentX + "px";
      element.style.top = currentY + "px";

      // Remove the bottom and right positioning to prevent stretching
      element.style.bottom = "";
      element.style.right = "";
    } else {
      // Already positioned by left/top (from saved position or default)
      currentX = parseInt(element.style.left || "0");
      currentY = parseInt(element.style.top || "0");
    }

    // Ensure the panel stays within the viewport bounds
    const minVisiblePart = 100; // Minimum visible part in pixels

    // Check horizontal position - ensure panel is not too far off-screen
    if (currentX < -element.offsetWidth + minVisiblePart) {
      currentX = 0;
      element.style.left = currentX + "px";
    } else if (currentX > window.innerWidth - minVisiblePart) {
      currentX = window.innerWidth - minVisiblePart;
      element.style.left = currentX + "px";
    }

    // Check vertical position - ensure panel is not too far off-screen
    if (currentY < 0) {
      currentY = 0;
      element.style.top = currentY + "px";
    } else if (currentY > window.innerHeight - minVisiblePart) {
      currentY = window.innerHeight - minVisiblePart;
      element.style.top = currentY + "px";
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
