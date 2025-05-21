// Import utilities
import { createStatsPanel } from "../StatsPanel.js";
import { createSlotsPanel } from "../SlotsPanel.js";
import { createDocPanel } from "../DocPanel.js";
import { createCodeMirrorEditor } from "../utils/CodeMirrorEditor.js";
import { createMidiManager } from "../MidiManager.js";
import { loadPanelPosition, savePanelPosition } from "../utils/PanelStorage.js";
import P5 from "./p5-wrapper.js";

// Helper function to debounce events
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Default starter code for Hydra
const DEFAULT_CODE = `// HYDRACTRL Sample

osc(10, 0.1, 1.2)
  .color(0.5, 0.1, 0.9)
  .rotate(0, 0.1)
  .modulateScale(osc(3, 0.2))
  .out()
`;

// Initialize a CodeMirror editor for Hydra
function initEditor() {
  const editorContent = document.getElementById("editor-content");
  const editorContainer = document.getElementById("editor-container");

  // Create the hydra editor with CodeMirror
  const editor = createCodeMirrorEditor(editorContent, DEFAULT_CODE);

  // Make the editor draggable by the handle with position persistence
  makeDraggable(
    editorContainer,
    document.getElementById("editor-handle"),
    "editor-panel",
  );

  // Add a resize observer to save dimensions when resized
  const resizeObserver = new ResizeObserver(debounce(() => {
    // Skip saving if editor is being dragged to avoid conflicts
    if (editorContainer.classList.contains("dragging")) return;

    // Get the position and dimensions
    const position = {
      left: parseInt(editorContainer.style.left || "0"),
      top: parseInt(editorContainer.style.top || "0"),
      width: editorContainer.offsetWidth,
      height: editorContainer.offsetHeight,
    };

    // Save to localStorage
    savePanelPosition("editor-panel", position);
  }, 100));

  // Start observing the editor container
  resizeObserver.observe(editorContainer);

  // Create a simplified API that mimics our previous interface
  return {
    // Match our previous API
    state: {
      doc: {
        toString: () => editor.getCode(),
        length: editor.getCode().length,
      },
    },
    dispatch: ({ changes }) => {
      if (changes && changes.insert) {
        // For loadCode functionality
        editor.setCode(changes.insert);
      }
    },
    focus: () => editor.focus(),
    // Add the raw editor object for direct access if needed
    _editor: editor,
  };
}

// Function to make an element draggable
function makeDraggable(element, handle, panelId) {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;

  // Apply saved position if available
  if (panelId) {
    const savedPosition = loadPanelPosition(panelId);
    if (savedPosition) {
      if (savedPosition.left !== undefined) element.style.left = savedPosition.left + "px";
      if (savedPosition.top !== undefined) element.style.top = savedPosition.top + "px";
      if (savedPosition.width !== undefined && savedPosition.width !== "auto")
        element.style.width = savedPosition.width + "px";
      if (savedPosition.height !== undefined && savedPosition.height !== "auto")
        element.style.height = savedPosition.height + "px";
    }
  }

  if (handle) {
    // If handle is specified, use it for dragging
    handle.onmousedown = dragMouseDown;
  } else {
    // Otherwise, use the entire element
    element.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    element.classList.add("dragging");
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call function whenever the cursor moves
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // Calculate new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = element.offsetTop - pos2 + "px";
    element.style.left = element.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
    element.classList.remove("dragging");

    // Save position to localStorage if specified
    if (panelId) {
      savePanelPosition(panelId, {
        left: parseInt(element.style.left),
        top: parseInt(element.style.top),
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    }
  }
}

// Polyfill for Node.js 'global' that hydra-synth expects in the browser environment
if (typeof window !== "undefined" && typeof window.global === "undefined") {
  window.global = window;
}

// Check for WebGL support
function isWebGLSupported() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}

// Initialize Hydra with proper canvas setup
async function initHydra() {
  try {
    // Check WebGL support first
    if (!isWebGLSupported()) {
      throw new Error("WebGL is not supported in your browser");
    }

    // Get or create the canvas element
    let canvasContainer = document.getElementById("hydra-canvas");
    let canvas = document.createElement("canvas");
    canvas.width = canvasContainer.clientWidth || 500;
    canvas.height = canvasContainer.clientHeight || 400;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvasContainer.innerHTML = "";
    canvasContainer.appendChild(canvas);

    // Ensure we have the buffer ready for WebGL to use
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Dynamically import hydra-synth
    const hydraModule = await import("hydra-synth");
    const HydraSynth = hydraModule.default || hydraModule;

    // Create a new hydra instance with explicit canvas reference
    const hydra = new HydraSynth({
      canvas: canvas,
      detectAudio: true, // Enable audio reactivity for a.fft[]
      enableStreamCapture: false,
      numBins: 6, // Set bins for a.fft[0], a.fft[1], etc.
      numSources: 4, // Limit sources for better performance
      precision: "mediump", // Better performance
    });

    // Thumbnails are always included in exports (small enough to fit)
    // We now use tiny 32x32 thumbnails with low quality compression

    return hydra;
  } catch (error) {
    console.error("Error initializing Hydra:", error);
    throw error; // Re-throw to handle in the calling function
  }
}

// Display error message to the user
function showErrorNotification(errorMessage) {
  // Remove any existing error notifications
  const existingErrors = document.querySelectorAll(".error-notification");
  existingErrors.forEach((el) => el.remove());

  // Create error notification element
  const errorNotification = document.createElement("div");
  errorNotification.className = "error-notification";

  // Create title
  const errorTitle = document.createElement("div");
  errorTitle.className = "error-title";
  errorTitle.textContent = "Hydra Error (click to dismiss)";

  // Create message
  const errorMessageEl = document.createElement("div");
  errorMessageEl.className = "error-message";
  errorMessageEl.textContent = errorMessage;

  // Add elements to notification
  errorNotification.appendChild(errorTitle);
  errorNotification.appendChild(errorMessageEl);

  // Add to body
  document.body.appendChild(errorNotification);

  // Allow clicking to dismiss
  errorNotification.addEventListener("click", () => {
    errorNotification.classList.add("fade-out");
    setTimeout(() => {
      if (errorNotification.parentNode) {
        document.body.removeChild(errorNotification);
      }
    }, 500);
  });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (errorNotification.parentNode) {
      errorNotification.classList.add("fade-out");
      setTimeout(() => {
        if (errorNotification.parentNode) {
          document.body.removeChild(errorNotification);
        }
      }, 500);
    }
  }, 10000);
}

// Create info panel with app information and keyboard shortcuts
function createInfoPanel() {
  // Check if panel already exists
  if (document.getElementById("info-panel")) {
    return document.getElementById("info-panel");
  }

  // Create the panel container
  const panel = document.createElement("div");
  panel.id = "info-panel";
  panel.className = "info-panel";
  panel.style.position = "fixed";
  panel.style.top = "50%";
  panel.style.left = "50%";
  panel.style.transform = "translate(-50%, -50%)";
  panel.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity)) !important";
  panel.style.borderRadius = "8px";
  panel.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
  panel.style.backdropFilter = "blur(var(--color-panel-blur))";
  panel.style.zIndex = "1000";
  panel.style.overflow = "hidden";
  panel.style.width = "500px";
  panel.style.maxWidth = "90vw";
  panel.style.maxHeight = "80vh";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";

  // Create the header with title and close button
  const header = document.createElement("div");
  header.className = "info-panel-header";
  header.style.backgroundColor = "rgba(var(--color-bg-tertiary-rgb), var(--panel-opacity))";
  header.style.padding = "12px 16px";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const title = document.createElement("h2");
  title.textContent = "About";
  title.style.margin = "0";
  title.style.fontSize = "16px";
  title.style.fontWeight = "bold";
  title.style.color = "var(--color-text-primary)";

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "20px";
  closeButton.style.color = "var(--color-text-primary)";
  closeButton.style.cursor = "pointer";
  closeButton.style.padding = "0 5px";
  closeButton.title = "Close";

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create the content container
  const content = document.createElement("div");
  content.className = "info-panel-content";
  content.style.padding = "20px";
  content.style.overflowY = "auto";

  // Create sections
  // About section
  const aboutSection = document.createElement("div");
  aboutSection.className = "info-section";

  const aboutText = document.createElement("p");
  aboutText.innerHTML = `HYDRACTRL is a tool built around <a href="https://hydra.ojack.xyz" target="_blank" style="color:var(--color-text-secondary);text-decoration:underline">hydra</a> designed for live performances. Save up to 64 slots of hydra goodness across 4 scenes. Unlimited banks with the import/export option. Korg Nanopad2 support. Breakout view to easily send your output over the network with OBS or NDI Studio.`;
  aboutText.style.margin = "0 0 15px 0";
  aboutText.style.fontSize = "13px";
  aboutText.style.lineHeight = "1.4";
  aboutText.style.color = "var(--color-text-secondary)";

  aboutSection.appendChild(aboutText);

  // Keyboard shortcuts section
  const shortcutsSection = document.createElement("div");
  shortcutsSection.className = "info-section";
  shortcutsSection.style.marginTop = "20px";

  const shortcutsTitle = document.createElement("h3");
  shortcutsTitle.textContent = "Keyboard Shortcuts";
  shortcutsTitle.style.fontSize = "14px";
  shortcutsTitle.style.marginTop = "0";
  shortcutsTitle.style.marginBottom = "10px";
  shortcutsTitle.style.color = "var(--color-text-primary)";

  // Create table for shortcuts
  const shortcutsTable = document.createElement("table");
  shortcutsTable.style.width = "100%";
  shortcutsTable.style.borderCollapse = "collapse";
  shortcutsTable.style.fontSize = "13px";

  // Define shortcuts
  const shortcuts = [
    { keys: "Ctrl/⌘ + `", action: "Toggle UI visibility" },
    { keys: "Ctrl/⌘ + Enter", action: "Run code" },
    { keys: "Ctrl/⌘ + S", action: "Save code" },
    { keys: "Ctrl/⌘ + Y", action: "Toggle Auto Run" },
    { keys: "Alt + 0-9 / A-F", action: "Select slot 1 to 16 (HEX)" },
    { keys: "Ctrl/⌘ + ←/→", action: "Cycle between banks (only when no MIDI connected)" },
    { keys: "Ctrl/⌘ + X", action: "Export all slots" },
    { keys: "Ctrl/⌘ + I", action: "Import slots file" }
  ];

  // Add shortcuts to table
  shortcuts.forEach(shortcut => {
    const row = document.createElement("tr");
    row.style.borderBottom = "1px solid var(--color-bg-tertiary)";

    const keysCell = document.createElement("td");
    keysCell.textContent = shortcut.keys;
    keysCell.style.padding = "8px 16px 8px 0";
    keysCell.style.fontFamily = "monospace";
    keysCell.style.whiteSpace = "nowrap";
    keysCell.style.color = "var(--color-text-primary)";

    const actionCell = document.createElement("td");
    actionCell.textContent = shortcut.action;
    actionCell.style.padding = "8px 0";
    actionCell.style.color = "var(--color-text-secondary)";

    row.appendChild(keysCell);
    row.appendChild(actionCell);
    shortcutsTable.appendChild(row);
  });

  shortcutsSection.appendChild(shortcutsTitle);
  shortcutsSection.appendChild(shortcutsTable);

  // Show on startup option
  const startupSection = document.createElement("div");
  startupSection.className = "startup-section";
  startupSection.style.marginTop = "20px";
  startupSection.style.display = "flex";
  startupSection.style.alignItems = "center";

  const showOnStartupCheckbox = document.createElement("input");
  showOnStartupCheckbox.type = "checkbox";
  showOnStartupCheckbox.id = "show-on-startup";
  showOnStartupCheckbox.checked = localStorage.getItem("hydractrl-show-info-on-startup") !== "false"; // Default to true

  const showOnStartupLabel = document.createElement("label");
  showOnStartupLabel.htmlFor = "show-on-startup";
  showOnStartupLabel.textContent = "Show on startup";
  showOnStartupLabel.style.marginLeft = "8px";
  showOnStartupLabel.style.fontSize = "13px";
  showOnStartupLabel.style.color = "var(--color-text-secondary)";

  showOnStartupCheckbox.addEventListener("change", (e) => {
    localStorage.setItem("hydractrl-show-info-on-startup", e.target.checked);
  });

  startupSection.appendChild(showOnStartupCheckbox);
  startupSection.appendChild(showOnStartupLabel);

  // Add everything to content
  content.appendChild(aboutSection);
  content.appendChild(shortcutsSection);
  content.appendChild(startupSection);

  // Add header and content to panel
  panel.appendChild(header);
  panel.appendChild(content);

  // Add to body
  document.body.appendChild(panel);

  // Close button functionality
  closeButton.addEventListener("click", () => {
    hideInfoPanel();
  });

  // Add one-time event listeners to close the panel
  const outsideClickHandler = (e) => {
    // Only close if click is outside the panel
    if (panel.parentNode && !panel.contains(e.target)) {
      hideInfoPanel();
      document.removeEventListener("mousedown", outsideClickHandler);
    }
  };

  // Prevent clicks inside the panel from bubbling to document
  panel.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  const escKeyHandler = (e) => {
    if (panel.parentNode && e.key === "Escape") {
      hideInfoPanel();
      e.stopPropagation(); // Prevent editor toggle
      document.removeEventListener("keydown", escKeyHandler);
    }
  };

  // We'll add these listeners when the panel is shown
  panel.outsideClickHandler = outsideClickHandler;
  panel.escKeyHandler = escKeyHandler;

  return panel;
}

// Show the info panel
function showInfoPanel() {
  const panel = createInfoPanel();
  panel.style.display = "flex";

  // Add a fade-in effect
  panel.style.opacity = "0";
  setTimeout(() => {
    panel.style.opacity = "1";
    panel.style.transition = "opacity 0.3s ease-in-out";
  }, 10);

  // Add event listeners to close when clicking outside or pressing ESC
  // First remove any existing listeners to avoid duplicates
  document.removeEventListener("mousedown", panel.outsideClickHandler);
  document.removeEventListener("keydown", panel.escKeyHandler);

  // Then add the listeners
  document.addEventListener("mousedown", panel.outsideClickHandler);
  document.addEventListener("keydown", panel.escKeyHandler);
}

// Hide the info panel
function hideInfoPanel() {
  const panel = document.getElementById("info-panel");
  if (panel) {
    // Remove event listeners
    document.removeEventListener("mousedown", panel.outsideClickHandler);
    document.removeEventListener("keydown", panel.escKeyHandler);

    // Fade out and hide
    panel.style.opacity = "0";
    panel.style.transition = "opacity 0.3s ease-in-out";

    setTimeout(() => {
      panel.style.display = "none";
    }, 300);
  }
}

// Run hydra code
async function runCode(editor, hydra) {
  try {
    // Get code from editor
    const code = editor.state.doc.toString();

    // Clear any previous errors
    console.clear();

    // Remove any existing error notifications
    const existingErrors = document.querySelectorAll(".error-notification");
    existingErrors.forEach((el) => el.remove());

    // Clear canvas by resetting default outputs
    hydra.hush();

    // Create an async function to execute the code with hydra in scope
    // This allows top-level await support
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

    const fn = new AsyncFunction(
      "hydra",
      `
      // Set global h variable to hydra for convenience
      window.h = hydra;
      // Make hydra functions available in global scope
      Object.keys(hydra).forEach(key => {
        if (typeof hydra[key] === 'function' && key !== 'eval') {
          window[key] = hydra[key].bind(hydra);
        }
      });
      
      // Execute the user's code
      try {
        ${code}
        return { success: true };
      } catch(e) {
        console.error('Error in Hydra code:', e);
        return { 
          success: false, 
          error: e,
          message: e.message || 'Unknown error'
        };
      }
    `,
    );

    // Execute the function with hydra as parameter
    const result = await fn(hydra);

    // Check if there was an error
    if (result && !result.success) {
      showErrorNotification(result.message);
      return false;
    }

    console.log("Hydra code executed successfully");
    return true;
  } catch (error) {
    console.error("Error running Hydra code:", error);
    showErrorNotification(error.message || "Failed to execute Hydra code");
    return false;
  }
}

// Toggle editor and panel visibility
function toggleEditor() {
  const editorContainer = document.getElementById("editor-container");
  const statsPanelElement = document.querySelector(".stats-panel");
  const slotsPanelElement = document.querySelector(".slots-panel");
  const docPanelElement = document.querySelector(".doc-panel");
  
  // Get visibility state from localStorage, defaulting to visible (true)
  // We invert the storage value because we're about to toggle it
  const isVisible = localStorage.getItem("hydractrl-ui-visible") !== "false";

  if (isVisible) {
    // Hide the editor and panels using visibility property to preserve layout
    editorContainer.style.visibility = "hidden";
    
    // Hide all panels if they exist
    if (statsPanelElement) statsPanelElement.style.visibility = "hidden";
    if (slotsPanelElement) slotsPanelElement.style.visibility = "hidden";
    if (docPanelElement) docPanelElement.style.visibility = "hidden";
    
    // Add a CSS class to the body to indicate hidden UI (useful for styling)
    document.body.classList.add("ui-hidden");
    
    // Store the new visibility state
    localStorage.setItem("hydractrl-ui-visible", "false");
  } else {
    // Show the editor and panels
    editorContainer.style.visibility = "visible";
    
    // Show all panels if they exist
    if (statsPanelElement) statsPanelElement.style.visibility = "visible";
    if (slotsPanelElement) slotsPanelElement.style.visibility = "visible";
    if (docPanelElement) docPanelElement.style.visibility = "visible";
    
    // Remove the hidden UI class
    document.body.classList.remove("ui-hidden");
    
    // Store the new visibility state
    localStorage.setItem("hydractrl-ui-visible", "true");

    // Focus the editor after making it visible
    setTimeout(() => {
      if (window._editorProxy) {
        window._editorProxy.focus();
      }

      // Force a resize event to make sure sizes are updated
      window.dispatchEvent(new Event("resize"));
    }, 50);
  }
}

// Save code to local storage
function saveCode(editor) {
  const code = editor.state.doc.toString();
  localStorage.setItem("hydractrl-code", code);
}

// Load code from local storage
function loadCode(editor) {
  const savedCode = localStorage.getItem("hydractrl-code");
  if (savedCode) {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: savedCode },
    });
  }
}

// Check if any scenes are stored in localStorage and import default bank if none
async function importDefaultScenesIfEmpty() {
  // Check if any scenes exist in localStorage
  let hasSavedScenes = false;
  const STORAGE_KEY_PREFIX = "hydractrl-slot-";
  const getStorageKey = (bank, index) => `${STORAGE_KEY_PREFIX}bank-${bank}-slot-${index}`;

  for (let bank = 0; bank < 4; bank++) {
    for (let slot = 0; slot < 16; slot++) {
      if (localStorage.getItem(getStorageKey(bank, slot))) {
        hasSavedScenes = true;
        break;
      }
    }
    if (hasSavedScenes) break;
  }

  // If no scenes found, import the default extension pack
  if (!hasSavedScenes) {
    try {
      console.log("No saved scenes found. Importing default extension pack...");

      // Fetch the default extension pack
      const response = await fetch('/assets/banks/default-extension-pack.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch default extension pack: ${response.status}`);
      }

      const scenesData = await response.json();

      // Validate format
      if (!scenesData.version || !Array.isArray(scenesData.banks)) {
        throw new Error("Invalid scenes data format");
      }

      // Import all banks and slots
      scenesData.banks.forEach((bankData) => {
        const { bankIndex, slots } = bankData;

        if (bankIndex >= 0 && bankIndex < 4 && Array.isArray(slots)) {
          slots.forEach((slot) => {
            if (slot.slotIndex >= 0 && slot.slotIndex < 16 && slot.code) {
              try {
                // Decode base64 code and handle non-Latin1 characters
                const decodedCode = decodeURIComponent(atob(slot.code));

                // Save to localStorage using the same key format as SlotsPanel
                const storageKey = getStorageKey(bankIndex, slot.slotIndex);
                localStorage.setItem(storageKey, decodedCode);

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

      // Show notification
      const notification = document.createElement("div");
      notification.className = "saved-notification";
      notification.textContent = "Default scenes imported successfully!";
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.classList.add("fade-out");
        setTimeout(() => {
          if (notification.parentNode) {
            document.body.removeChild(notification);
          }
        }, 500);
      }, 2000);

      return true;
    } catch (error) {
      console.error("Error importing default scenes:", error);
      return false;
    }
  }

  return hasSavedScenes;
}

// Initialize a new window for breakout view
function openBreakoutWindow(width = 1280, height = 720) {
  // Default options for the window
  const options = `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes`;

  // Open a blank window first
  const breakoutWindow = window.open("", "HydraBreakout", options);

  if (!breakoutWindow) {
    showErrorNotification(
      "Could not open breakout window. Please check your popup blocker settings.",
    );
    return null;
  }

  // Add basic HTML structure to the new window
  breakoutWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HYDRACTRL Breakout</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          overflow: hidden;
          width: 100%;
          height: 100%;
          background-color: #000;
        }
        
        #hydra-canvas-breakout {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 0;
          left: 0;
        }
      </style>
    </head>
    <body>
      <div id="hydra-canvas-breakout"></div>
    </body>
    </html>
  `);

  // Close the document to finish writing
  breakoutWindow.document.close();

  return breakoutWindow;
}

// Initialize Hydra in the breakout window
async function initBreakoutHydra(breakoutWindow, mainHydra) {
  try {
    if (!breakoutWindow || !breakoutWindow.document) {
      throw new Error("Invalid breakout window");
    }

    // Get or create the canvas element in the breakout window
    let canvasContainer = breakoutWindow.document.getElementById("hydra-canvas-breakout");
    let canvas = breakoutWindow.document.createElement("canvas");
    canvas.width = breakoutWindow.innerWidth || 500;
    canvas.height = breakoutWindow.innerHeight || 400;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvasContainer.innerHTML = "";
    canvasContainer.appendChild(canvas);

    // Ensure we have the buffer ready for WebGL to use
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Dynamically import hydra-synth in the main window
    const hydraModule = await import("hydra-synth");
    const HydraSynth = hydraModule.default || hydraModule;

    // Create a new hydra instance with explicit canvas reference
    const breakoutHydra = new HydraSynth({
      canvas: canvas,
      detectAudio: true, // Enable audio reactivity for a.fft[]
      enableStreamCapture: false,
      numBins: 6, // Set bins for a.fft[0], a.fft[1], etc.
      numSources: 4, // Limit sources for better performance
      precision: "mediump", // Better performance
    });

    // Define loadScript function in breakout window
    breakoutWindow.loadScript = function (url) {
      return new Promise((resolve, reject) => {
        const script = breakoutWindow.document.createElement("script");
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        breakoutWindow.document.head.appendChild(script);
      });
    };

    // Copy existing global variables and functions to breakout window
    if (window.hydraText) {
      breakoutWindow.hydraText = window.hydraText;
    }

    // Listen for window resize events
    breakoutWindow.addEventListener("resize", () => {
      // Adjust canvas size when window is resized
      canvas.width = breakoutWindow.innerWidth;
      canvas.height = breakoutWindow.innerHeight;
    });

    // Listen for window close events
    breakoutWindow.addEventListener("beforeunload", () => {
      // Update UI when breakout window is closed
      if (window.statsPanel && window.statsPanel.display) {
        window.statsPanel.display.sizeSelectionContainer.style.display = "none";
      }
      window.breakoutHydra = null;
      window.breakoutWindow = null;
    });

    return breakoutHydra;
  } catch (error) {
    console.error("Error initializing breakout Hydra:", error);
    throw error;
  }
}

// Run Hydra code on both main and breakout windows
async function runCodeOnAllInstances(editor, mainHydra) {
  // Run on main Hydra instance
  const success = await runCode(editor, mainHydra);

  // If breakout window is active, run the same code there
  if (window.breakoutHydra && window.breakoutWindow && !window.breakoutWindow.closed) {
    try {
      await runCode(editor, window.breakoutHydra);
    } catch (error) {
      console.error("Error running Hydra code in breakout window:", error);
    }
  }

  return success;
}

// Initialize the application
async function init() {
  try {
    const editor = initEditor(); // No longer async
    const hydra = await initHydra();
    
    // Apply UI visibility state from localStorage right after panels are created
    const applyUiVisibility = () => {
      const isVisible = localStorage.getItem("hydractrl-ui-visible");
      
      // Only apply if explicitly set to false (hidden)
      if (isVisible === "false") {
        const editorContainer = document.getElementById("editor-container");
        const statsPanelElement = document.querySelector(".stats-panel");
        const slotsPanelElement = document.querySelector(".slots-panel");
        const docPanelElement = document.querySelector(".doc-panel");
        
        // Hide all UI elements using visibility to preserve layout
        if (editorContainer) editorContainer.style.visibility = "hidden";
        if (statsPanelElement) statsPanelElement.style.visibility = "hidden";
        if (slotsPanelElement) statsPanelElement.style.visibility = "hidden";
        if (docPanelElement) docPanelElement.style.visibility = "hidden";
        
        // Add a CSS class to the body to indicate hidden UI
        document.body.classList.add("ui-hidden");
      }
    };

    window.P5 = P5; // Expose P5 globally for use in the editor

    // Store references to these globally
    window.mainHydra = hydra;
    window.breakoutHydra = null;
    window.breakoutWindow = null;

    // Auto-run timer
    let autoRunTimer = null;
    let autoRunEnabled = localStorage.getItem("hydractrl-auto-run") === "true";

    // Auto-run function
    const setupAutoRun = () => {
      const autoRunCheckbox = document.getElementById("auto-run-checkbox");

      // Set initial state from localStorage
      autoRunCheckbox.checked = autoRunEnabled;

      // Function to toggle auto-run state
      const toggleAutoRun = () => {
        autoRunEnabled = !autoRunEnabled;
        autoRunCheckbox.checked = autoRunEnabled;
        localStorage.setItem("hydractrl-auto-run", autoRunEnabled);
      };

      // Listen for checkbox changes
      autoRunCheckbox.addEventListener("change", (e) => {
        autoRunEnabled = e.target.checked;
        localStorage.setItem("hydractrl-auto-run", autoRunEnabled);
      });

      // Set up simplified global keydown handler for auto-run
      window.addEventListener("keydown", () => {
        if (autoRunEnabled) {
          // Clear existing timer
          clearTimeout(autoRunTimer);
          // Set new timer
          autoRunTimer = setTimeout(async () => {
            await runCodeOnAllInstances(editor, hydra);
          }, 250);
        }
      });

      return { toggleAutoRun };
    };

    const { toggleAutoRun } = setupAutoRun();

    // Set up event listeners
    document.getElementById("run-btn").addEventListener("click", async () => {
      const success = await runCodeOnAllInstances(editor, hydra);
      if (success) {
        editor.focus(); // Return focus to editor after successful run
      }
    });

    document.getElementById("save-btn").addEventListener("click", () => {
      // First save to regular storage
      saveCode(editor);

      // Then save to active slot if slots panel exists
      if (window.slotsPanel) {
        const savedSlotInfo = window.slotsPanel.saveToActiveSlot();

        // Move to next slot if the option is enabled, passing the slot we just saved to
        if (window.moveToNextSlotOnSave && window.moveToNextSlot) {
          // Add debug to check what's happening
          console.log("Save button: Moving to next slot with info:", savedSlotInfo);
          window.moveToNextSlot(savedSlotInfo);
        }
      } else {
        // Show temporary "Saved!" notification only if not using slots
        const savedNotification = document.createElement("div");
        savedNotification.className = "saved-notification";
        savedNotification.textContent = "Saved!";
        document.body.appendChild(savedNotification);

        setTimeout(() => {
          savedNotification.classList.add("fade-out");
          setTimeout(() => {
            if (savedNotification.parentNode) {
              document.body.removeChild(savedNotification);
            }
          }, 500);
        }, 1500);
      }

      editor.focus(); // Return focus to editor after saving
    });

    // Add keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Ctrl+Enter or Cmd+Enter to run code
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runCodeOnAllInstances(editor, hydra).then((success) => {
          if (success) {
            editor.focus();
          }
        });
      }

      // Ctrl+S or Cmd+S to save code
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveCode(editor);
        // Also save to active slot if slots panel exists
        if (window.slotsPanel) {
          const savedSlotInfo = window.slotsPanel.saveToActiveSlot();

          // Move to next slot if the option is enabled, passing the slot we just saved to
          if (window.moveToNextSlotOnSave && window.moveToNextSlot) {
            // Add debug to check what's happening
            console.log("Moving to next slot with info:", savedSlotInfo);
            window.moveToNextSlot(savedSlotInfo);
          }
        }
      }

      // Ctrl+Y or Cmd+Y to toggle auto-run
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        toggleAutoRun();
        editor.focus();
      }

      // Ctrl/Cmd+` (backtick) to toggle editor visibility
      if (e.key === "`" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); // Prevent any default behavior
        toggleEditor();
      }

      if (e.altKey && !e.ctrlKey & !e.metaKey && !e.shiftKey) {
        // Hexadecimal keys 0-F to select slots 1-16
        // First handle 0-9 keys
        const numKey = e.key;
        if (numKey >= '0' && numKey <= '9' && window.slotsPanel) {
          e.preventDefault();
          // For key '0', select slot 1 (index 0)
          // For keys '1'-'9', select slots 2-10 (index 1-9)
          const slotIndex = numKey === '0' ? 0 : parseInt(numKey);
          window.slotsPanel.setActiveSlot(slotIndex);
        }

        // Then handle A-F keys for slots 11-16
        if (numKey >= 'a' && numKey <= 'f' && window.slotsPanel) {
          e.preventDefault();
          // Convert a-f to values 10-15
          const slotIndex = numKey.charCodeAt(0) - 'a'.charCodeAt(0) + 10;
          window.slotsPanel.setActiveSlot(slotIndex);
        } else if (numKey >= 'A' && numKey <= 'F' && window.slotsPanel) {
          e.preventDefault();
          // Convert A-F to values 10-15
          const slotIndex = numKey.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
          window.slotsPanel.setActiveSlot(slotIndex);
        }
      }

      // Check for either Ctrl or Cmd (metaKey) for the following shortcuts
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {

        // Ctrl/⌘+X to export scene bank
        if (e.key === "x" && window.slotsPanel && window.slotsPanel.exportAllSlots) {
          e.preventDefault();
          window.slotsPanel.exportAllSlots();
        }
        // Ctrl/⌘+I to import scene bank
        if (e.key === "i" && window.slotsPanel && window.slotsPanel.importSlots) {
          e.preventDefault();
          window.slotsPanel.importSlots();
        }

        // Ctrl/⌘+Left/Right arrow keys to cycle between banks (only when no MIDI device is connected)
        if (e.key === "ArrowLeft" && window.slotsPanel && window.slotsPanel.cycleBank) {
          // Check if MIDI device is connected
          const midiConnected =
            window.midiManager &&
            window.midiManager.isConnected &&
            window.midiManager.isConnected();

          // Only allow keyboard navigation when no MIDI device is connected
          if (!midiConnected) {
            e.preventDefault();
            window.slotsPanel.cycleBank(-1); // Previous bank

            // Flash the bank dot for visual feedback
            if (window.flashActiveBankDot) {
              window.flashActiveBankDot(window.slotsPanel.getBank());
            }
          }
        }

        if (e.key === "ArrowRight" && window.slotsPanel && window.slotsPanel.cycleBank) {
          // Check if MIDI device is connected
          const midiConnected =
            window.midiManager &&
            window.midiManager.isConnected &&
            window.midiManager.isConnected();

          // Only allow keyboard navigation when no MIDI device is connected
          if (!midiConnected) {
            e.preventDefault();
            window.slotsPanel.cycleBank(1); // Next bank

            // Flash the bank dot for visual feedback
            if (window.flashActiveBankDot) {
              window.flashActiveBankDot(window.slotsPanel.getBank());
            }
          }
        }
      }
    });

    // Load saved code if available
    loadCode(editor);

    // Run initial code
    await runCodeOnAllInstances(editor, hydra);

    // Focus the editor initially
    editor.focus();

    // Create the stats panel using our simple implementation
    const statsPanel = createStatsPanel();
    
    // Create the documentation panel (hidden by default)
    const docPanel = createDocPanel();
    
    // Connect the docs button to toggle the documentation panel
    statsPanel.docsButton.addEventListener("click", () => {
      docPanel.toggle();
    });

    // Import default scenes if there are no saved scenes in localStorage
    await importDefaultScenesIfEmpty();

    // Create the slots panel
    const slotsPanel = createSlotsPanel(editor, hydra, runCode);

    // Initialize MIDI support with the slots panel
    const midiManager = createMidiManager(slotsPanel);
    
    // Apply UI visibility state after all panels are created
    applyUiVisibility();

    // Initialize MIDI access
    const midiSupported = midiManager.init();

    // Create updateMidiDeviceList function at the global scope so it can be
    // called from multiple places in the code
    window.updateMidiDeviceList = function () {
      // Clear device container except for the buttons
      while (statsPanel.midi.deviceContainer.children.length > 2) {
        statsPanel.midi.deviceContainer.removeChild(statsPanel.midi.deviceContainer.lastChild);
      }

      // Get device list
      const devices = midiManager.listDevices();

      if (devices.length === 0) {
        statsPanel.midi.statusText.textContent = "MIDI: No devices found";
        return;
      }

      // Update status text with active device
      const activeDevice = midiManager.getActiveDevice();
      if (activeDevice) {
        statsPanel.midi.statusText.textContent = `MIDI: ${activeDevice.name || "Unknown Device"}`;

        // Highlight nanoPAD if connected
        if (
          activeDevice.name &&
          (activeDevice.name.toLowerCase().includes("nanopad") ||
            activeDevice.name.toLowerCase().includes("korg"))
        ) {
          statsPanel.midi.statusText.style.color = "#50fa7b"; // Green

          // Add scene information
          const currentScene = midiManager.getCurrentScene();
          statsPanel.midi.statusText.textContent = `MIDI: ${activeDevice.name}`;
        } else {
          statsPanel.midi.statusText.style.color = "#aaa";
        }
      } else {
        statsPanel.midi.statusText.textContent = "MIDI: No active device";
        statsPanel.midi.statusText.style.color = "#aaa";
      }

      // Add device buttons
      devices.forEach((device, index) => {
        const deviceButton = document.createElement("button");
        deviceButton.textContent = device.name || `Device ${index + 1}`;
        deviceButton.style.fontSize = "10px";
        deviceButton.style.padding = "2px 4px";
        deviceButton.style.margin = "2px 0";

        if (device.isActive) {
          deviceButton.style.backgroundColor = "rgba(80, 250, 123, 0.3)";
        }

        deviceButton.addEventListener("click", () => {
          midiManager.connectToDeviceByIndex(index);
          window.updateMidiDeviceList();
        });

        statsPanel.midi.deviceContainer.appendChild(deviceButton);
      });
    };


    // Update the stats panel with MIDI info if supported
    if (midiSupported) {
      statsPanel.midi.statusText.textContent = "MIDI: Initializing...";

      // Add refresh button
      const refreshButton = document.createElement("button");
      refreshButton.textContent = "Refresh MIDI";
      refreshButton.style.fontSize = "10px";
      refreshButton.style.padding = "2px 4px";
      refreshButton.style.margin = "4px 0";
      refreshButton.style.width = "fit-content";

      refreshButton.addEventListener("click", () => {
        window.updateMidiDeviceList();
      });

      // Add sync nanoPAD scenes button
      const syncButton = document.createElement("button");
      syncButton.textContent = "Sync Scene ⟷ Bank";
      syncButton.style.fontSize = "10px";
      syncButton.style.padding = "2px 4px";
      syncButton.style.margin = "2px 0px";
      syncButton.style.backgroundColor = "rgba(80, 250, 123, 0.2)";
      syncButton.title = "Synchronize nanoPAD scene with current bank";

      syncButton.addEventListener("click", () => {
        if (window.slotsPanel && window.midiManager) {
          // Get current bank
          const currentBank = window.slotsPanel.getBank();

          // Set MIDI scene to match current bank
          window.midiManager.setScene(currentBank);

          // Update UI
          window.updateMidiDeviceList();

          // Show temporary notification
          const notification = document.createElement("div");
          notification.className = "saved-notification";
          notification.style.backgroundColor = "rgba(80, 250, 123, 0.8)";
          notification.textContent = `Synced nanoPAD Scene ${currentBank + 1} with Bank ${currentBank + 1}`;
          document.body.appendChild(notification);

          setTimeout(() => {
            notification.classList.add("fade-out");
            setTimeout(() => {
              if (notification.parentNode) {
                document.body.removeChild(notification);
              }
            }, 500);
          }, 2000);
        }
      });

      // Add reset mapping button
      const resetButton = document.createElement("button");
      resetButton.textContent = "Reset MIDI Mapping";
      resetButton.style.fontSize = "10px";
      resetButton.style.padding = "2px 4px";
      resetButton.style.margin = "4px 0";
      resetButton.style.backgroundColor = "rgba(255, 120, 120, 0.2)";
      resetButton.title = "Reset to default nanoPAD mapping";

      resetButton.addEventListener("click", () => {
        if (window.midiManager && window.midiManager.resetToDefaultMapping) {
          if (confirm("Reset MIDI mapping to defaults?")) {
            window.midiManager.resetToDefaultMapping();

            // Show temporary notification
            const notification = document.createElement("div");
            notification.className = "saved-notification";
            notification.style.backgroundColor = "rgba(255, 120, 120, 0.8)";
            notification.textContent = "MIDI mapping reset to defaults";
            document.body.appendChild(notification);

            setTimeout(() => {
              notification.classList.add("fade-out");
              setTimeout(() => {
                if (notification.parentNode) {
                  document.body.removeChild(notification);
                }
              }, 500);
            }, 2000);
          }
        }
      });

      // Add info button that shows current mapping
      const infoButton = document.createElement("button");
      infoButton.textContent = "Show Mapping";
      infoButton.style.fontSize = "10px";
      infoButton.style.padding = "2px 4px";
      infoButton.style.margin = "4px 0 4px 8px";
      infoButton.title = "Show current MIDI mapping";

      infoButton.addEventListener("click", () => {
        if (window.midiManager && window.midiManager.getMidiMapping) {
          const mapping = window.midiManager.getMidiMapping();
          const currentBank = window.midiManager.getCurrentScene();

          // Create a formatted display of the current bank's mapping
          let message = `MIDI Mapping for Bank ${currentBank + 1}:\n`;

          // Sort by slot for better display
          const sortedMapping = [...mapping[currentBank]].sort((a, b) => a.slot - b.slot);

          sortedMapping.forEach((map) => {
            message += `MIDI Note ${map.note} → Slot ${map.slot + 1}\n`;
          });

          alert(message);
        }
      });

      // Add buttons to device container
      statsPanel.midi.deviceContainer.appendChild(refreshButton);
      statsPanel.midi.deviceContainer.appendChild(syncButton);
      statsPanel.midi.deviceContainer.appendChild(document.createElement("br"));
      statsPanel.midi.deviceContainer.appendChild(infoButton);
      statsPanel.midi.deviceContainer.appendChild(resetButton);

      // We've moved this function to the window scope above

      // Initial update of device list
      setTimeout(() => {
        if (window.updateMidiDeviceList) {
          window.updateMidiDeviceList();
        }
      }, 1000);
    } else {
      statsPanel.midi.statusText.textContent = "MIDI: Not supported";
      statsPanel.midi.statusText.style.color = "#ff5555"; // Red
    }

    // Create global flag for moving to next slot on save
    // Load from localStorage or default to false
    window.moveToNextSlotOnSave = localStorage.getItem("hydractrl-move-to-next-slot") === "true";

    // Set the checkbox state based on saved preference
    if (statsPanel.slots && statsPanel.slots.moveToNextSlotCheckbox) {
      statsPanel.slots.moveToNextSlotCheckbox.checked = window.moveToNextSlotOnSave;

      // Update the flag when checkbox is changed
      statsPanel.slots.moveToNextSlotCheckbox.addEventListener("change", (e) => {
        window.moveToNextSlotOnSave = e.target.checked;
        // Save preference to localStorage
        localStorage.setItem("hydractrl-move-to-next-slot", e.target.checked);
      });
    }

    // Function to move to the next slot after saving
    window.moveToNextSlot = function (savedSlotInfo) {
      if (!window.slotsPanel || !window.moveToNextSlotOnSave) return;

      console.log("moveToNextSlot called with:", savedSlotInfo);

      // Verify we have valid savedSlotInfo
      if (!savedSlotInfo || typeof savedSlotInfo !== 'object' ||
        savedSlotInfo.bank === undefined || savedSlotInfo.slot === undefined) {
        console.error("Invalid savedSlotInfo:", savedSlotInfo);
        // Fall back to current slot
        savedSlotInfo = {
          bank: window.slotsPanel.getBank(),
          slot: window.slotsPanel.getActiveSlotIndex()
        };
        console.log("Using fallback slot info:", savedSlotInfo);
      }

      // Ensure numeric values
      const currentBank = Number(savedSlotInfo.bank);
      const currentSlot = Number(savedSlotInfo.slot);

      console.log(`Moving from bank ${currentBank}, slot ${currentSlot}`);

      // Validate inputs and calculate next slot index
      // If values are NaN, default to sensible values
      if (isNaN(currentBank) || isNaN(currentSlot)) {
        console.error("Invalid bank or slot (NaN detected):", currentBank, currentSlot);
        return false;
      }

      // Calculate next slot index
      let nextSlot = (currentSlot + 1) % 16;
      let nextBank = currentBank;

      // If we're at the last slot of the current bank, go to the first slot of the next bank
      if (nextSlot === 0) {
        nextBank = (currentBank + 1) % 4;
      }

      console.log(`Next position: bank ${nextBank}, slot ${nextSlot}`);

      // If we're wrapping around from the last bank to the first, check if we have room
      if (nextBank < currentBank) {
        console.log("Wrapping around to first bank, showing warning");
        // We're going back to bank 0 from bank 3, show a warning popup
        const fullNotification = document.createElement("div");
        fullNotification.className = "saved-notification";
        fullNotification.style.backgroundColor = "var(--color-error)";
        fullNotification.textContent = "All banks full! Can't advance further.";
        document.body.appendChild(fullNotification);

        setTimeout(() => {
          fullNotification.classList.add("fade-out");
          setTimeout(() => {
            if (fullNotification.parentNode) {
              document.body.removeChild(fullNotification);
            }
          }, 500);
        }, 1500);

        // Don't advance to next slot in this case
        return false;
      }

      // Wait for any async operations to complete before changing slots
      // Use a timeout to ensure the screenshot capture has started and we don't lose focus
      setTimeout(() => {
        try {
          // If we need to switch banks
          if (nextBank !== currentBank) {
            console.log(`Switching to bank ${nextBank}`);
            window.slotsPanel.switchBank(nextBank);

            // Flash the bank dot for visual feedback
            if (window.flashActiveBankDot) {
              window.flashActiveBankDot(nextBank);
            }
          }

          // Switch to the next slot
          console.log(`Setting active slot to ${nextSlot}`);
          window.slotsPanel.setActiveSlot(nextSlot);
        } catch (error) {
          console.error("Error moving to next slot:", error);
        }
      }, 500); // Increased to 500ms to ensure more time for screenshot capture

      return true;
    };

    // Set up the toggle editor button
    const toggleEditorBtn = document.getElementById("toggle-editor-btn");
    if (toggleEditorBtn) {
      toggleEditorBtn.addEventListener("click", toggleEditor);
    }

    // Add to window for debugging and access
    window.statsPanel = statsPanel;
    window.slotsPanel = slotsPanel;
    window.midiManager = midiManager;
    window.docPanel = docPanel; // Expose doc panel for access
    window._editorProxy = editor; // Expose editor proxy for focus etc.
    window.showInfoPanel = showInfoPanel; // Expose info panel functions
    window.hideInfoPanel = hideInfoPanel;
    window.toggleEditor = toggleEditor; // Expose toggle editor function

    // Check if we should show the info panel on startup
    if (localStorage.getItem("hydractrl-show-info-on-startup") !== "false") {
      // Slight delay to allow UI to initialize
      setTimeout(() => {
        showInfoPanel();
      }, 500);
    }

    // Set up size buttons functionality
    statsPanel.display.sizeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const width = parseInt(button.dataset.width);
        const height = parseInt(button.dataset.height);
        const label = button.dataset.label;

        if (isNaN(width) || isNaN(height)) {
          return;
        }

        // Store the selected size
        statsPanel.display.selectedSize = { width, height, label };

        // Update the selected size indicator
        statsPanel.display.selectedSizeIndicator.textContent = `Selected: ${label}`;

        // Enable the breakout button
        statsPanel.display.breakoutButton.disabled = false;
        statsPanel.display.breakoutButton.style.opacity = "1";
        statsPanel.display.breakoutButton.title = `Open breakout window at ${width}×${height}`;

        // Highlight the selected button and unhighlight others
        statsPanel.display.sizeButtons.forEach((btn) => {
          if (btn === button) {
            btn.style.backgroundColor = "rgba(80, 250, 123, 0.3)";
          } else {
            btn.style.backgroundColor = "";
          }
        });
      });
    });

    // Set up breakout button functionality
    statsPanel.display.breakoutButton.addEventListener("click", async () => {
      // If window is already open, close it
      if (window.breakoutWindow && !window.breakoutWindow.closed) {
        window.breakoutWindow.close();
        window.breakoutHydra = null;
        window.breakoutWindow = null;

        // Reset button
        statsPanel.display.breakoutButton.textContent = "Breakout View";
        statsPanel.display.breakoutButton.style.backgroundColor = "";
        return;
      }

      // Check if a size is selected
      if (!statsPanel.display.selectedSize) {
        showErrorNotification("Please select a window size first");
        return;
      }

      const { width, height } = statsPanel.display.selectedSize;

      // Open a new breakout window with the selected size
      const breakoutWindow = openBreakoutWindow(width, height);
      if (!breakoutWindow) {
        return; // Error already shown by openBreakoutWindow
      }

      // Store reference to window
      window.breakoutWindow = breakoutWindow;

      try {
        // Initialize Hydra in the breakout window
        window.breakoutHydra = await initBreakoutHydra(breakoutWindow, hydra);

        // Update the breakout window title to include size
        const { label } = statsPanel.display.selectedSize;
        breakoutWindow.document.title = `HYDRACTRL Breakout - ${label}`;

        // Run the current code in the breakout window
        await runCode(editor, window.breakoutHydra);

        // Update button text and style
        statsPanel.display.breakoutButton.textContent = "Close Breakout";
        statsPanel.display.breakoutButton.style.backgroundColor = "rgba(255, 120, 120, 0.3)";

        // Event handler for window close
        window.breakoutWindow.addEventListener("beforeunload", () => {
          // Reset button
          statsPanel.display.breakoutButton.textContent = "Breakout View";
          statsPanel.display.breakoutButton.style.backgroundColor = "";

          window.breakoutHydra = null;
          window.breakoutWindow = null;
        });
      } catch (error) {
        console.error("Error initializing breakout view:", error);
        showErrorNotification(`Failed to initialize breakout view: ${error.message}`);

        // Clean up on failure
        if (window.breakoutWindow) {
          window.breakoutWindow.close();
          window.breakoutWindow = null;
        }
        window.breakoutHydra = null;

        // Reset button
        statsPanel.display.breakoutButton.textContent = "Breakout View";
        statsPanel.display.breakoutButton.style.backgroundColor = "";
      }
    });
  } catch (error) {
    console.error("Error initializing application:", error);
  }
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
