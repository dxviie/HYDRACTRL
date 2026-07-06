import { createDocPanel } from "../DocPanel.js";
import { createMidiManager } from "../MidiManager.js";
import { createSlotsPanel } from "../SlotsPanel.js";
// Import utilities
import { createStatsPanel } from "../StatsPanel.js";
import { createCodeMirrorEditor } from "../utils/CodeMirrorEditor.js";
import { isMobileOrTablet } from "../utils/DeviceDetection.js";
import { makeDraggable } from "../utils/Draggable.js";
import { savePanelPosition } from "../utils/PanelStorage.js";
import { createEventBus } from "./core/EventBus.js";
import { createPluginHost } from "./core/PluginHost.js";
import { createSafeStorage } from "./core/Storage.js";
import { notify, notifyError } from "./core/notify.js";
import { createAudioWatchdogPlugin } from "./plugins/AudioWatchdogPlugin.js";
import { createAutoRunPlugin } from "./plugins/AutoRunPlugin.js";
import { createBreakoutPlugin } from "./plugins/BreakoutPlugin.js";
import { createInfoPanelPlugin } from "./plugins/InfoPanelPlugin.js";
import { createMidiUiPlugin } from "./plugins/MidiUiPlugin.js";
import { createMobileUiPlugin } from "./plugins/MobileUiPlugin.js";
import { createSlotAdvancePlugin } from "./plugins/SlotAdvancePlugin.js";
import { createUrlSharePlugin, readSketchFromHash } from "./plugins/UrlSharePlugin.js";

// Shared application services: safe storage (never throws on quota errors or
// in private mode) and the event bus that panels and plugins communicate through.
const storage = createSafeStorage({
  onWriteError: () => {
    notifyError("Storage is full — changes may not persist. Export your banks and clear space.");
  },
});
const events = createEventBus();

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
}

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

  // Enable resizing on the editor container
  editorContainer.style.resize = "both";
  editorContainer.style.overflow = "auto";

  // Initialize tab state with persistent setup code
  const savedSetupCode =
    localStorage.getItem("hydractrl-setup-code") ||
    "// Setup code runs once before main code\n// Use this for audio settings, global variables, etc.\n// This only persists in your browser and will not be exported to JSON.\n\n";

  const editorTabs = {
    main: { code: DEFAULT_CODE },
    setup: { code: savedSetupCode },
  };
  let currentTab = "main";

  // Create the hydra editor with CodeMirror
  const editor = createCodeMirrorEditor(editorContent, editorTabs[currentTab].code);

  // Add tab switching functionality
  const tabButtons = document.querySelectorAll(".editor-tab");
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Save current editor content
      editorTabs[currentTab].code = editor.getCode();

      // If leaving setup tab, save to localStorage
      if (currentTab === "setup") {
        localStorage.setItem("hydractrl-setup-code", editor.getCode());
      }

      // Switch to new tab
      currentTab = button.dataset.tab;

      // Update active tab UI
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Load new tab content
      editor.setCode(editorTabs[currentTab].code);
      editor.focus();
    });
  });

  // Add getter for tab content
  editor.getTabCode = (tab) => {
    if (tab === currentTab) {
      return editor.getCode();
    }
    return editorTabs[tab]?.code || "";
  };

  // Add getter for current tab
  editor.getCurrentTab = () => currentTab;

  // Add method to get both setup and main code
  editor.getAllCode = () => {
    // Save current editor content first
    editorTabs[currentTab].code = editor.getCode();

    // Always return setup + main code, regardless of current tab
    // This ensures setup always runs with the main sketch
    return {
      setup: editorTabs.setup.code,
      main: editorTabs.main.code,
    };
  };

  // Add method to set both setup and main code
  editor.setAllCode = (setupCode, mainCode) => {
    editorTabs.setup.code = setupCode || "";
    editorTabs.main.code = mainCode || "";

    // Update current editor content with the appropriate tab
    editor.setCode(editorTabs[currentTab].code);
  };

  // Make the editor draggable by the handle with position persistence
  makeDraggable(editorContainer, document.getElementById("editor-handle"), "editor-panel");

  // Add a resize observer to save dimensions when resized
  const resizeObserver = new ResizeObserver(
    debounce(() => {
      // Skip saving if editor is being dragged to avoid conflicts
      if (editorContainer.classList.contains("dragging")) return;

      // Get the position and dimensions
      const position = {
        left: Number.parseInt(editorContainer.style.left || "0"),
        top: Number.parseInt(editorContainer.style.top || "0"),
        width: editorContainer.offsetWidth,
        height: editorContainer.offsetHeight,
      };

      // Save to localStorage
      savePanelPosition("editor-panel", position);
    }, 100),
  );

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
    const canvasContainer = document.getElementById("hydra-canvas");
    const canvas = document.createElement("canvas");
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
    // Thumbnails are always included in exports (small enough to fit)
    // We now use tiny 32x32 thumbnails with low quality compression

    return new HydraSynth({
      canvas: canvas,
      detectAudio: true, // Enable audio reactivity for a.fft[]
      enableStreamCapture: false,
      numBins: 6, // Set bins for a.fft[0], a.fft[1], etc.
      numSources: 4, // Limit sources for better performance
      precision: "mediump", // Better performance
    });
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

// Run hydra code with setup support
async function runCode(editor, hydra) {
  try {
    // Get code from editor - check if it has tab support
    let setupCode = "";
    let mainCode;

    if (editor._editor && editor._editor.getAllCode) {
      // Editor has tab support, get both setup and main code
      const allCode = editor._editor.getAllCode();
      setupCode = allCode.setup.trim();
      mainCode = allCode.main.trim();
    } else {
      // Fallback for direct editor access
      mainCode = editor.state ? editor.state.doc.toString() : editor.getCode();
    }
    // Remove any existing error notifications
    const existingErrors = document.querySelectorAll(".error-notification");
    existingErrors.forEach((el) => el.remove());

    // Clear canvas by resetting default outputs
    hydra.hush();

    // Create an async function to execute the code with hydra in scope
    // This allows top-level await support
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

    // Combine setup and main code
    const codeToExecute = setupCode ? `${setupCode}\n\n${mainCode}` : mainCode;

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
        ${codeToExecute}
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

// Show or hide the editor and all panels. Uses the visibility property to
// preserve layout. This is the single source of truth for UI visibility —
// used by the toggle button, the keyboard shortcut and startup restore.
function setUiVisibility(visible) {
  const editorContainer = document.getElementById("editor-container");
  const statsPanelElement = document.querySelector(".stats-panel");
  const slotsPanelElement = document.querySelector(".slots-panel");
  const docPanelElement = document.querySelector(".doc-panel");
  const xyPadPanelElement = document.querySelector(".xy-pad-panel");

  const xyPadVisible = storage.get("hydractrl-xy-pad-visible") === "true";
  const visibility = visible ? "visible" : "hidden";

  if (editorContainer) editorContainer.style.visibility = visibility;
  if (statsPanelElement) statsPanelElement.style.visibility = visibility;
  if (slotsPanelElement) slotsPanelElement.style.visibility = visibility;
  if (docPanelElement) docPanelElement.style.visibility = visibility;
  // Only touch the XY pad if it's supposed to be visible
  if (xyPadPanelElement && xyPadVisible) xyPadPanelElement.style.visibility = visibility;

  document.body.classList.toggle("ui-hidden", !visible);
  storage.set("hydractrl-ui-visible", visible ? "true" : "false");
  events.emit("ui:visibility", { visible });

  if (visible) {
    // Focus the editor and trigger resize after showing
    setTimeout(() => {
      if (window._editorProxy) {
        window._editorProxy.focus();
      }
      // Force a resize event to make sure sizes are updated
      window.dispatchEvent(new Event("resize"));
    }, 50);
  }
}

// Toggle editor and panel visibility
function toggleEditor() {
  const isVisible = storage.get("hydractrl-ui-visible") !== "false";
  setUiVisibility(!isVisible);
}

// Save code to local storage
function saveCode(editor) {
  const code = editor.state.doc.toString();
  storage.set("hydractrl-code", code);
}

// Load code from local storage
function loadCode(editor) {
  const savedCode = localStorage.getItem("hydractrl-code");
  if (savedCode) {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: savedCode },
    });

    // Update mobile code overlay if available
    if (window.codeOverlay) {
      window.codeOverlay.update(savedCode);
    }
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
      const response = await fetch("/assets/banks/hydractrl-init-basic.json");
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

                // Save using the same key format as SlotsPanel; storage.set is
                // quota-safe so a full store can't abort the whole import
                const storageKey = getStorageKey(bankIndex, slot.slotIndex);
                storage.set(storageKey, decodedCode);

                // Save thumbnail if available in the imported data
                if (slot.thumbnail) {
                  storage.set(`${storageKey}-thumbnail`, slot.thumbnail);
                  storage.set(`${storageKey}-thumbnail-timestamp`, Date.now());
                }
              } catch (decodeError) {
                console.error("Error decoding slot data:", decodeError);
              }
            }
          });
        }
      });

      notify("Default scenes imported successfully!");

      return true;
    } catch (error) {
      console.error("Error importing default scenes:", error);
      return false;
    }
  }

  return hasSavedScenes;
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
    const isMobile = isMobileOrTablet();

    const editor = initEditor(); // No longer async
    const hydra = await initHydra();

    // Apply UI visibility state from localStorage right after panels are created.
    // Only applies when explicitly hidden, so first-time users see the UI.
    const applyUiVisibility = () => {
      if (storage.get("hydractrl-ui-visible") === "false") {
        setUiVisibility(false);
      }
    };

    const { P5Wrapper } = await import("./p5-wrapper.ts");

    window.P5 = P5Wrapper; // Expose P5 globally for use in the editor

    // Store references to these globally
    window.mainHydra = hydra;
    window.breakoutHydra = null;
    window.breakoutWindow = null;

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
        notify("Saved!", { duration: 1500 });
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

      // (Ctrl/⌘+Y auto-run toggle lives in the AutoRunPlugin)

      // Ctrl/Cmd+` (backtick) to toggle editor visibility.
      // Match on the physical key (e.code) so this works on international
      // keyboard layouts where "`" needs a modifier or doesn't exist (issue #7).
      if (e.code === "Backquote" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleEditor();
      }

      // Escape always brings the UI back when it is hidden, so there is a
      // layout-independent way to recover from a hidden UI (issue #7).
      if (e.key === "Escape" && document.body.classList.contains("ui-hidden")) {
        e.preventDefault();
        setUiVisibility(true);
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Hexadecimal keys 0-F (physical keys) to select slots 0-15
        let slotIndex = -1;
        const keyCode = e.code; // Use e.code for physical key identification

        // Handle Digit0 to Digit9 for slots 0-9
        if (keyCode.startsWith("Digit")) {
          const digit = Number.parseInt(keyCode.substring(5)); // e.g., "Digit0" -> 0
          if (!Number.isNaN(digit) && digit >= 0 && digit <= 9) {
            slotIndex = digit; // Digit0 maps to slot 0, Digit1 to 1, ..., Digit9 to 9
          }
        }
        // Handle KeyA to KeyF for slots 10-15
        else if (keyCode.startsWith("Key")) {
          const keyChar = keyCode.substring(3); // e.g., "KeyA" -> "A"
          if (keyChar.length === 1) {
            // Ensure it's a single character like 'A', not 'F1' etc.
            const charCode = keyChar.charCodeAt(0);
            if (charCode >= "A".charCodeAt(0) && charCode <= "F".charCodeAt(0)) {
              slotIndex = charCode - "A".charCodeAt(0) + 10; // KeyA maps to slot 10
            }
          }
        }

        // Atl/Opt+X to export scene bank
        if (e.key === "x" && window.slotsPanel && window.slotsPanel.exportAllSlots) {
          e.preventDefault();
          window.slotsPanel.exportAllSlots();
        }
        // Atl/Opt+I to import scene bank
        if (e.key === "i" && window.slotsPanel && window.slotsPanel.importSlots) {
          e.preventDefault();
          window.slotsPanel.importSlots();
        }

        if (slotIndex !== -1 && window.slotsPanel) {
          e.preventDefault(); // Prevent default browser/OS action (e.g., typing special chars on Mac)
          window.slotsPanel.setActiveSlot(slotIndex);
        }
      }

      // Alt+Left/Right arrow keys to cycle between banks (only when no MIDI device is connected)
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.code === "ArrowLeft" && window.slotsPanel && window.slotsPanel.cycleBank) {
          /* Use e.code */
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

        if (e.code === "ArrowRight" && window.slotsPanel && window.slotsPanel.cycleBank) {
          /* Use e.code */
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

    // A sketch shared via URL (#sketch=...) takes precedence over saved code
    // and is deliberately NOT persisted — the user's banks stay untouched
    // unless they explicitly save (issue #5).
    const urlSketch = readSketchFromHash(window.location.hash);
    if (urlSketch !== null) {
      editor.dispatch({ changes: { insert: urlSketch } });
      notify("Loaded sketch from URL (not saved to your banks)");
    } else {
      // Load saved code if available
      loadCode(editor);
    }

    // Run initial code
    await runCodeOnAllInstances(editor, hydra);

    // Focus the editor initially
    if (!isMobile) {
      editor.focus();
    }

    // Only create certain panels based on device type
    let statsPanel, docPanel, midiManager;

    if (!isMobile) {
      // Create the stats panel using our simple implementation
      statsPanel = createStatsPanel();

      // Create the documentation panel (hidden by default)
      docPanel = createDocPanel();

      // Connect the docs button to toggle the documentation panel
      statsPanel.docsButton.addEventListener("click", () => {
        docPanel.toggle();
      });
    }

    // Import default scenes if there are no saved scenes in localStorage
    await importDefaultScenesIfEmpty();

    // Create the slots panel (always shown, but positioned differently on mobile)
    const slotsPanel = createSlotsPanel(editor, hydra, runCode, isMobile, {
      // Don't let slot 0 overwrite a sketch that was loaded from the URL
      keepEditorContent: urlSketch !== null,
    });

    if (!isMobile) {
      // Initialize MIDI support with the slots panel (desktop only)
      midiManager = createMidiManager(slotsPanel);

      // Create XY pad panel (desktop only)
      import("./../XYPadPanel.js").then((module) => {
        const xyPadPanel = module.createXYPadPanel();
        window.xyPadPanel = xyPadPanel;

        // Set the XY pad panel in the MIDI manager
        midiManager.setXYPadPanel(xyPadPanel);

        // Set initial visibility based on localStorage
        const xyPadVisible = localStorage.getItem("hydractrl-xy-pad-visible") === "true";
        xyPadPanel.togglePanel(xyPadVisible);
      });
    }

    // (Mobile-specific UI — code overlay, dice button, hidden editor — is
    // handled by the MobileUiPlugin; the About panel by the InfoPanelPlugin.)

    // Apply UI visibility state after all panels are created
    applyUiVisibility();

    // Initialize MIDI access (desktop only)
    let midiSupported = false;
    if (!isMobile && midiManager) {
      midiSupported = midiManager.init();
    }

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
    window.toggleEditor = toggleEditor; // Expose toggle editor function

    // Set up the plugin system. Plugins receive a stable context object and
    // communicate with the rest of the app through the event bus, so they
    // can be added or removed without touching the core (see docs/PLUGINS.md).
    const pluginContext = {
      hydra,
      editor,
      runCode: () => runCodeOnAllInstances(editor, hydra),
      // Run the current code on one specific hydra instance (e.g. a breakout
      // window's), without touching the main instance
      runCodeOn: (instance) => runCode(editor, instance),
      events,
      storage,
      notify,
      isMobile,
      midi: { manager: midiManager, supported: midiSupported },
      getPanels: () => ({
        stats: statsPanel,
        slots: slotsPanel,
        doc: docPanel,
        xyPad: window.xyPadPanel,
      }),
    };
    const pluginHost = createPluginHost(pluginContext);
    pluginHost.register(createUrlSharePlugin());
    pluginHost.register(createAudioWatchdogPlugin());
    pluginHost.register(createInfoPanelPlugin());
    pluginHost.register(createAutoRunPlugin());
    pluginHost.register(createSlotAdvancePlugin());
    pluginHost.register(createBreakoutPlugin());
    pluginHost.register(createMidiUiPlugin());
    pluginHost.register(createMobileUiPlugin());
    pluginHost.init();

    // Public extension point: external code (console, userscripts, future
    // built-ins) can register plugins via window.hydractrl.
    window.hydractrl = {
      version: "0.0.1",
      events,
      storage,
      plugins: pluginHost,
      registerPlugin: (plugin) => pluginHost.register(plugin),
    };
  } catch (error) {
    console.error("Error initializing application:", error);
    // Never fail silently into a black screen: tell the user what happened.
    showErrorNotification(
      `HYDRACTRL failed to start: ${error.message || error}. ` +
        "Check the console for details (WebGL support is required).",
    );
  }
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
