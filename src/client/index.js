// Import utilities
import { createStatsPanel } from '../StatsPanel.js';
import { createSlotsPanel } from '../SlotsPanel.js';
import { createSharePanel } from '../SharePanel.js';
import { createEditor } from '../utils/SimpleEditor.js';
import { createMidiManager } from '../MidiManager.js';
import { createCanvasSharing } from '../utils/CanvasSharing.js';
import { loadPanelPosition, savePanelPosition } from '../utils/PanelStorage.js';

// Default starter code for Hydra
const DEFAULT_CODE = `// HYDRACTRL Sample

osc(10, 0.1, 1.2)
  .color(0.5, 0.1, 0.9)
  .rotate(0, 0.1)
  .modulateScale(osc(3, 0.2))
  .out()
`;

// Initialize a syntax-highlighted editor for Hydra
function initEditor() {
  const editorContent = document.getElementById('editor-content');

  // Create the hydra editor with syntax highlighting
  const editor = createEditor(editorContent, DEFAULT_CODE);

  // Make the editor draggable by the handle with position persistence
  makeDraggable(
    document.getElementById('editor-container'),
    document.getElementById('editor-handle'),
    'editor-panel'
  );

  // Create a simplified API that mimics our previous interface
  return {
    // Match our previous API
    state: {
      doc: {
        toString: () => editor.getCode(),
        length: editor.getCode().length
      }
    },
    dispatch: ({ changes }) => {
      if (changes && changes.insert) {
        // For loadCode functionality
        editor.setCode(changes.insert);
      }
    },
    focus: () => editor.focus(),
    // Add the raw editor object for direct access if needed
    _editor: editor
  };
}

// Function to make an element draggable
function makeDraggable(element, handle, panelId) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  // Apply saved position if available
  if (panelId) {
    const savedPosition = loadPanelPosition(panelId);
    if (savedPosition) {
      if (savedPosition.left !== undefined) element.style.left = savedPosition.left + 'px';
      if (savedPosition.top !== undefined) element.style.top = savedPosition.top + 'px';
      if (savedPosition.width !== undefined && savedPosition.width !== 'auto')
        element.style.width = savedPosition.width + 'px';
      if (savedPosition.height !== undefined && savedPosition.height !== 'auto')
        element.style.height = savedPosition.height + 'px';
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
    element.classList.add('dragging');
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
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
    element.classList.remove('dragging');

    // Save position to localStorage if specified
    if (panelId) {
      savePanelPosition(panelId, {
        left: parseInt(element.style.left),
        top: parseInt(element.style.top),
        width: element.offsetWidth,
        height: element.offsetHeight
      });
    }
  }
}

// Polyfill for Node.js 'global' that hydra-synth expects in the browser environment
if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  window.global = window;
}

// Check for WebGL support
function isWebGLSupported() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
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
    let canvasContainer = document.getElementById('hydra-canvas');
    let canvas = document.createElement('canvas');
    canvas.width = canvasContainer.clientWidth || 500;
    canvas.height = canvasContainer.clientHeight || 400;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);

    // Ensure we have the buffer ready for WebGL to use
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dynamically import hydra-synth
    const hydraModule = await import('hydra-synth');
    const HydraSynth = hydraModule.default || hydraModule;

    // Create a new hydra instance with explicit canvas reference
    const hydra = new HydraSynth({
      canvas: canvas,
      detectAudio: true, // Enable audio reactivity for a.fft[]
      enableStreamCapture: false,
      numBins: 6, // Set bins for a.fft[0], a.fft[1], etc.
      numSources: 4, // Limit sources for better performance
      precision: 'mediump' // Better performance
    });

    return hydra;
  } catch (error) {
    console.error("Error initializing Hydra:", error);
    throw error; // Re-throw to handle in the calling function
  }
}

// Display error message to the user
function showErrorNotification(errorMessage) {
  // Remove any existing error notifications
  const existingErrors = document.querySelectorAll('.error-notification');
  existingErrors.forEach(el => el.remove());

  // Create error notification element
  const errorNotification = document.createElement('div');
  errorNotification.className = 'error-notification';

  // Create title
  const errorTitle = document.createElement('div');
  errorTitle.className = 'error-title';
  errorTitle.textContent = 'Hydra Error (click to dismiss)';

  // Create message
  const errorMessageEl = document.createElement('div');
  errorMessageEl.className = 'error-message';
  errorMessageEl.textContent = errorMessage;

  // Add elements to notification
  errorNotification.appendChild(errorTitle);
  errorNotification.appendChild(errorMessageEl);

  // Add to body
  document.body.appendChild(errorNotification);

  // Allow clicking to dismiss
  errorNotification.addEventListener('click', () => {
    errorNotification.classList.add('fade-out');
    setTimeout(() => {
      if (errorNotification.parentNode) {
        document.body.removeChild(errorNotification);
      }
    }, 500);
  });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (errorNotification.parentNode) {
      errorNotification.classList.add('fade-out');
      setTimeout(() => {
        if (errorNotification.parentNode) {
          document.body.removeChild(errorNotification);
        }
      }, 500);
    }
  }, 10000);
}

// Run hydra code
async function runCode(editor, hydra) {
  try {
    // Get code from editor
    const code = editor.state.doc.toString();

    // Clear any previous errors
    console.clear();

    // Remove any existing error notifications
    const existingErrors = document.querySelectorAll('.error-notification');
    existingErrors.forEach(el => el.remove());

    // Clear canvas by resetting default outputs
    hydra.hush();

    // Create an async function to execute the code with hydra in scope
    // This allows top-level await support
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    
    const fn = new AsyncFunction('hydra', `
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
    `);

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
    console.error('Error running Hydra code:', error);
    showErrorNotification(error.message || 'Failed to execute Hydra code');
    return false;
  }
}

// Toggle editor visibility
function toggleEditor() {
  const editorContainer = document.getElementById('editor-container');
  const isVisible = editorContainer.style.display !== 'none';

  if (isVisible) {
    // Hide the editor
    editorContainer.style.display = 'none';
  } else {
    // Show the editor
    editorContainer.style.display = 'flex'; // Use flex to maintain the flex layout

    // Focus the editor after making it visible
    setTimeout(() => {
      if (window._editorProxy) {
        window._editorProxy.focus();
      }

      // Force a resize event to make sure sizes are updated
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }
}

// Save code to local storage
function saveCode(editor) {
  const code = editor.state.doc.toString();
  localStorage.setItem('hydractrl-code', code);
}

// Load code from local storage
function loadCode(editor) {
  const savedCode = localStorage.getItem('hydractrl-code');
  if (savedCode) {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: savedCode }
    });
  }
}

// Initialize the application
async function init() {
  try {
    const editor = initEditor(); // No longer async
    const hydra = await initHydra();

    // Set up event listeners
    document.getElementById('run-btn').addEventListener('click', async () => {
      const success = await runCode(editor, hydra);
      if (success) {
        editor.focus(); // Return focus to editor after successful run
      }
    });

    document.getElementById('save-btn').addEventListener('click', () => {
      // First save to regular storage
      saveCode(editor);

      // Then save to active slot if slots panel exists
      if (window.slotsPanel) {
        window.slotsPanel.saveToActiveSlot();
      } else {
        // Show temporary "Saved!" notification only if not using slots
        const savedNotification = document.createElement('div');
        savedNotification.className = 'saved-notification';
        savedNotification.textContent = 'Saved!';
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

      editor.focus(); // Return focus to editor after saving
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter or Cmd+Enter to run code
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode(editor, hydra).then(success => {
          if (success) {
            editor.focus();
          }
        });
      }

      // Ctrl+S or Cmd+S to save code
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCode(editor);
        // Also save to active slot if slots panel exists
        if (window.slotsPanel) {
          window.slotsPanel.saveToActiveSlot();
        }
      }

      // ESC to toggle editor visibility
      if (e.key === 'Escape') {
        toggleEditor();
      }

      // Number keys 1-9 to select slots 1-9 (when holding Ctrl)
      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= 9 && window.slotsPanel) {
          e.preventDefault();
          window.slotsPanel.setActiveSlot(num - 1); // Convert to 0-based index
        }

        // Ctrl+Left/Right arrow keys to cycle between banks (only when no MIDI device is connected)
        if (e.key === 'ArrowLeft' && window.slotsPanel && window.slotsPanel.cycleBank) {
          // Check if MIDI device is connected
          const midiConnected = window.midiManager && window.midiManager.isConnected && window.midiManager.isConnected();

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

        if (e.key === 'ArrowRight' && window.slotsPanel && window.slotsPanel.cycleBank) {
          // Check if MIDI device is connected
          const midiConnected = window.midiManager && window.midiManager.isConnected && window.midiManager.isConnected();

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
    await runCode(editor, hydra);

    // Focus the editor initially
    editor.focus();

    // Create the stats panel using our simple implementation
    const statsPanel = createStatsPanel();

    // Create the slots panel
    const slotsPanel = createSlotsPanel(editor, hydra, runCode);

    // Initialize MIDI support with the slots panel
    const midiManager = createMidiManager(slotsPanel);

    // Initialize MIDI access
    const midiSupported = midiManager.init();

    // Create updateMidiDeviceList function at the global scope so it can be
    // called from multiple places in the code
    window.updateMidiDeviceList = function () {
      // Clear device container except for the buttons
      while (statsPanel.midi.deviceContainer.children.length > 2) {
        statsPanel.midi.deviceContainer.removeChild(
          statsPanel.midi.deviceContainer.lastChild
        );
      }

      // Get device list
      const devices = midiManager.listDevices();

      if (devices.length === 0) {
        statsPanel.midi.statusText.textContent = 'MIDI: No devices found';
        return;
      }

      // Update status text with active device
      const activeDevice = midiManager.getActiveDevice();
      if (activeDevice) {
        statsPanel.midi.statusText.textContent = `MIDI: ${activeDevice.name || 'Unknown Device'}`;

        // Highlight nanoPAD if connected
        if (activeDevice.name && (
          activeDevice.name.toLowerCase().includes('nanopad') ||
          activeDevice.name.toLowerCase().includes('korg'))) {
          statsPanel.midi.statusText.style.color = '#50fa7b'; // Green

          // Add scene information
          const currentScene = midiManager.getCurrentScene();
          statsPanel.midi.statusText.textContent =
            `MIDI: ${activeDevice.name}`;
        } else {
          statsPanel.midi.statusText.style.color = '#aaa';
        }
      } else {
        statsPanel.midi.statusText.textContent = 'MIDI: No active device';
        statsPanel.midi.statusText.style.color = '#aaa';
      }

      // Add device buttons
      devices.forEach((device, index) => {
        const deviceButton = document.createElement('button');
        deviceButton.textContent = device.name || `Device ${index + 1}`;
        deviceButton.style.fontSize = '10px';
        deviceButton.style.padding = '2px 4px';
        deviceButton.style.margin = '2px 0';

        if (device.isActive) {
          deviceButton.style.backgroundColor = 'rgba(80, 250, 123, 0.3)';
        }

        deviceButton.addEventListener('click', () => {
          midiManager.connectToDeviceByIndex(index);
          window.updateMidiDeviceList();
        });

        statsPanel.midi.deviceContainer.appendChild(deviceButton);
      });
    };

    // Update the stats panel with MIDI info if supported
    if (midiSupported) {
      statsPanel.midi.statusText.textContent = 'MIDI: Initializing...';

      // Add refresh button
      const refreshButton = document.createElement('button');
      refreshButton.textContent = 'Refresh MIDI';
      refreshButton.style.fontSize = '10px';
      refreshButton.style.padding = '2px 4px';
      refreshButton.style.margin = '4px 0';
      refreshButton.style.width = 'fit-content';

      refreshButton.addEventListener('click', () => {
        window.updateMidiDeviceList();
      });

      // Add sync nanoPAD scenes button
      const syncButton = document.createElement('button');
      syncButton.textContent = 'Sync Scene ⟷ Bank';
      syncButton.style.fontSize = '10px';
      syncButton.style.padding = '2px 4px';
      syncButton.style.margin = '2px 0px';
      syncButton.style.backgroundColor = 'rgba(80, 250, 123, 0.2)';
      syncButton.title = 'Synchronize nanoPAD scene with current bank';

      syncButton.addEventListener('click', () => {
        if (window.slotsPanel && window.midiManager) {
          // Get current bank
          const currentBank = window.slotsPanel.getBank();

          // Set MIDI scene to match current bank
          window.midiManager.setScene(currentBank);

          // Update UI
          window.updateMidiDeviceList();

          // Show temporary notification
          const notification = document.createElement('div');
          notification.className = 'saved-notification';
          notification.style.backgroundColor = 'rgba(80, 250, 123, 0.8)';
          notification.textContent = `Synced nanoPAD Scene ${currentBank + 1} with Bank ${currentBank + 1}`;
          document.body.appendChild(notification);

          setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
              if (notification.parentNode) {
                document.body.removeChild(notification);
              }
            }, 500);
          }, 2000);
        }
      });

      // Add reset mapping button
      const resetButton = document.createElement('button');
      resetButton.textContent = 'Reset MIDI Mapping';
      resetButton.style.fontSize = '10px';
      resetButton.style.padding = '2px 4px';
      resetButton.style.margin = '4px 0';
      resetButton.style.backgroundColor = 'rgba(255, 120, 120, 0.2)';
      resetButton.title = 'Reset to default nanoPAD mapping';

      resetButton.addEventListener('click', () => {
        if (window.midiManager && window.midiManager.resetToDefaultMapping) {
          if (confirm('Reset MIDI mapping to defaults?')) {
            window.midiManager.resetToDefaultMapping();

            // Show temporary notification
            const notification = document.createElement('div');
            notification.className = 'saved-notification';
            notification.style.backgroundColor = 'rgba(255, 120, 120, 0.8)';
            notification.textContent = 'MIDI mapping reset to defaults';
            document.body.appendChild(notification);

            setTimeout(() => {
              notification.classList.add('fade-out');
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
      const infoButton = document.createElement('button');
      infoButton.textContent = 'Show Mapping';
      infoButton.style.fontSize = '10px';
      infoButton.style.padding = '2px 4px';
      infoButton.style.margin = '4px 0 4px 8px';
      infoButton.title = 'Show current MIDI mapping';

      infoButton.addEventListener('click', () => {
        if (window.midiManager && window.midiManager.getMidiMapping) {
          const mapping = window.midiManager.getMidiMapping();
          const currentBank = window.midiManager.getCurrentScene();

          // Create a formatted display of the current bank's mapping
          let message = `MIDI Mapping for Bank ${currentBank + 1}:\n`;

          // Sort by slot for better display
          const sortedMapping = [...mapping[currentBank]].sort((a, b) => a.slot - b.slot);

          sortedMapping.forEach(map => {
            message += `MIDI Note ${map.note} → Slot ${map.slot + 1}\n`;
          });

          alert(message);
        }
      });

      // Add buttons to device container
      statsPanel.midi.deviceContainer.appendChild(refreshButton);
      statsPanel.midi.deviceContainer.appendChild(syncButton);
      statsPanel.midi.deviceContainer.appendChild(document.createElement('br'));
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
      statsPanel.midi.statusText.textContent = 'MIDI: Not supported';
      statsPanel.midi.statusText.style.color = '#ff5555'; // Red
    }

    // Add to window for debugging and access
    window.statsPanel = statsPanel;
    window.slotsPanel = slotsPanel;
    window.midiManager = midiManager;
    window._editorProxy = editor; // Expose editor proxy for focus etc.

    // Initialize canvas sharing for Resolume integration
    const canvas = document.querySelector('#hydra-canvas canvas');
    if (canvas) {
      // Create canvas sharing utility
      const canvasSharing = createCanvasSharing(canvas, {
        frameRate: 30,
        quality: 0.85,
        format: 'image/jpeg',
        autoStart: false
      });

      // Create the share panel UI
      const sharePanel = createSharePanel(canvasSharing);

      // Expose canvas sharing to window for debugging
      window.canvasSharing = canvasSharing;
      window.sharePanel = sharePanel;
    } else {
      console.error("Could not find Hydra canvas for streaming");
    }

  } catch (error) {
    console.error("Error initializing application:", error);
  }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);