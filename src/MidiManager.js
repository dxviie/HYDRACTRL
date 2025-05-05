/**
 * MIDI Manager
 * A simple manager for MIDI input devices with special support for Korg nanoPAD2
 */
export function createMidiManager(slotsPanel) {
  // Track the MIDI access and active device
  let midiAccess = null;
  let activeDevice = null;
  let isConnected = false;

  // Track if this is a nanoPAD2 or similar controller
  let isNanoPad = false;

  // Create notification for MIDI status
  const midiStatus = document.createElement('div');
  midiStatus.className = 'midi-status';
  midiStatus.style.position = 'absolute';
  midiStatus.style.bottom = '10px';
  midiStatus.style.left = '10px';
  midiStatus.style.fontSize = '10px';
  midiStatus.style.color = '#aaa';
  midiStatus.style.padding = '4px';
  midiStatus.style.borderRadius = '3px';
  midiStatus.style.backgroundColor = 'rgba(30, 30, 30, 0.6)';
  midiStatus.style.display = 'none';
  document.body.appendChild(midiStatus);

  // Show/hide MIDI status with animation
  function showMidiStatus(message, isError = false) {
    midiStatus.textContent = message;
    midiStatus.style.color = isError ? '#ff5555' : '#aaa';
    midiStatus.style.display = 'block';
    midiStatus.style.opacity = '1';

    // Auto hide after 5 seconds
    setTimeout(() => {
      midiStatus.style.opacity = '0';
      setTimeout(() => {
        midiStatus.style.display = 'none';
      }, 500);
    }, 5000);
  }

  // Initialize MIDI system
  function init() {
    if (!navigator.requestMIDIAccess) {
      console.warn('WebMIDI is not supported in this browser');
      showMidiStatus('MIDI not supported in this browser', true);
      return false;
    }

    navigator.requestMIDIAccess()
      .then(onMIDISuccess, onMIDIFailure);

    return true;
  }

  // Handle successful MIDI access
  function onMIDISuccess(access) {
    midiAccess = access;

    // Listen for connect/disconnect events
    midiAccess.onstatechange = onStateChange;

    // Check if any MIDI inputs exist
    if (midiAccess.inputs.size === 0) {
      showMidiStatus('No MIDI devices found. Please connect one.');
      return;
    }

    // Find the first available input device (default behavior)
    connectToFirstAvailableDevice();
  }

  // Connect to the first available MIDI device
  function connectToFirstAvailableDevice() {
    for (const entry of midiAccess.inputs) {
      const input = entry[1];
      connectToDevice(input);
      break;
    }
  }

  // Connect to a specific MIDI device
  function connectToDevice(inputDevice) {
    if (activeDevice) {
      // Remove listeners from previous device
      activeDevice.onmidimessage = null;
    }

    activeDevice = inputDevice;
    activeDevice.onmidimessage = onMIDIMessage;
    isConnected = true;

    // Check if it's a nanoPAD or similar
    isNanoPad = activeDevice.name && (
      activeDevice.name.toLowerCase().includes('nanopad') ||
      activeDevice.name.toLowerCase().includes('korg')
    );

    showMidiStatus(`Connected: ${activeDevice.name || 'MIDI Device'}`);
    console.log(`MIDI connected: ${activeDevice.name}`);
  }

  // Handle MIDI connection/disconnection
  function onStateChange(event) {
    // Check if a device was connected
    if (event.port.state === 'connected' && event.port.type === 'input') {
      if (!isConnected) {
        connectToDevice(event.port);
      }
      showMidiStatus(`Connected: ${event.port.name}`);
    }

    // Check if the active device was disconnected
    if (event.port.state === 'disconnected' &&
      activeDevice && event.port.id === activeDevice.id) {
      isConnected = false;
      activeDevice = null;
      showMidiStatus('MIDI device disconnected');

      // Try to connect to another device if available
      connectToFirstAvailableDevice();
    }
  }

  // Handle MIDI failure
  function onMIDIFailure(error) {
    console.error('MIDI access failed:', error);
    showMidiStatus('MIDI access failed. Check permissions.', true);
  }

  // Track the current scene on the nanoPAD
  let currentScene = 0; // Scene 1 by default

  // Handle MIDI messages
  function onMIDIMessage(message) {
    const data = message.data;
    const cmd = data[0] & 0xF0; // Command byte (top 4 bits)
    const channel = data[0] & 0x0F; // Channel (bottom 4 bits)

    // nanoPAD2 specific handling
    if (isNanoPad) {
      // Note On message (button press)
      if (cmd === 0x90 && data[2] > 0) { // Note On with velocity > 0
        const note = data[1];
        handleNanoPadNote(note);
      }

      // Control change (CC) messages - used for scene changes
      // nanoKONTROL and nanoPAD2 use control change messages for scene buttons
      if (cmd === 0xB0) { // CC message
        const ccNum = data[1];
        const value = data[2];

        // Scene button detection
        if ((ccNum === 16 || ccNum === 17 || ccNum === 18 || ccNum === 19) && value > 0) {
          // Scene buttons on nanoPAD2
          // Scene 1-4 typically use CC numbers 16-19
          const sceneNumber = ccNum - 16; // 0-3

          // Update current scene
          currentScene = sceneNumber;

          // Switch bank to match scene
          if (slotsPanel && slotsPanel.switchBank) {
            slotsPanel.switchBank(sceneNumber);
          }

          // Update MIDI status
          showMidiStatus(`Scene ${sceneNumber + 1} / Bank ${sceneNumber + 1} selected`);
        }
      }
    } else {
      // Generic MIDI handling for other devices
      // Note On
      if (cmd === 0x90 && data[2] > 0) {
        const note = data[1];
        handleGenericNote(note);
      }
    }
  }

  // Define the default MIDI mapping structure
  const defaultMidiMapping = [
    // Bank 0 (Scene 1) - maps top row to even slots, bottom row to odd slots
    [
      { note: 37, slot: 0 },
      { note: 39, slot: 1 },
      { note: 41, slot: 2 },
      { note: 43, slot: 3 },
      { note: 45, slot: 4 },
      { note: 47, slot: 5 },
      { note: 49, slot: 6 },
      { note: 51, slot: 7 },
      { note: 36, slot: 8 },
      { note: 38, slot: 9 },
      { note: 40, slot: 10 },
      { note: 42, slot: 11 },
      { note: 44, slot: 12 },
      { note: 46, slot: 13 },
      { note: 48, slot: 14 },
      { note: 50, slot: 15 }
    ],
    // Bank 1 (Scene 2) - using same mapping, but notes from 52 > 67
    [
    ],
    // Bank 2 (Scene 3) - using same mapping, but notes from 68 > 83
    [
    ],
    // Bank 3 (Scene 4) - using same mapping, but notes from 84 > 99
    [
    ]
  ];

  // Load saved mapping from localStorage or use default
  function loadMidiMapping() {
    try {
      const savedMapping = localStorage.getItem('hydractrl-midi-mapping');
      if (savedMapping) {
        const parsed = JSON.parse(savedMapping);
        // Validate the mapping structure
        if (Array.isArray(parsed) && parsed.length === 4) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading MIDI mapping:', error);
    }

    // Return default mapping if no valid mapping is found
    return JSON.parse(JSON.stringify(defaultMidiMapping));
  }

  // Save mapping to localStorage
  function saveMidiMapping(mapping) {
    try {
      localStorage.setItem('hydractrl-midi-mapping', JSON.stringify(mapping));
      return true;
    } catch (error) {
      console.error('Error saving MIDI mapping:', error);
      return false;
    }
  }

  // Load or initialize the MIDI mapping
  const midiMapping = loadMidiMapping();

  // Handle nanoPAD2 pad press
  function handleNanoPadNote(note) {
    console.log(`nanoPAD2 pad: ${note}`);

    // Look up the slot from the mapping based on current scene
    const mappings = midiMapping[currentScene];

    // Find the mapping entry for this note
    const mapping = mappings.find(m => m.note === note);

    // If a mapping was found, select the corresponding slot
    if (mapping && slotsPanel) {
      console.log(`MIDI note ${note} maps to slot ${mapping.slot}`);
      slotsPanel.setActiveSlot(mapping.slot);
    } else {
      console.log(`No mapping found for MIDI note ${note} in bank ${currentScene}`);
    }
  }

  // Handle generic MIDI notes for other controllers
  function handleGenericNote(note) {
    // Map MIDI notes to slot index (0-15)
    // Common midi note range starts at 48 (C3)
    const slotIndex = (note - 48) % 16;

    if (slotIndex >= 0 && slotIndex < 16 && slotsPanel) {
      slotsPanel.setActiveSlot(slotIndex);
    }
  }

  // Public API
  return {
    init,
    isConnected: () => isConnected,
    getActiveDevice: () => activeDevice,
    // Get current scene
    getCurrentScene: () => currentScene,
    // Set scene and bank
    setScene: (sceneIndex) => {
      if (sceneIndex >= 0 && sceneIndex < 4) {
        currentScene = sceneIndex;

        // Also change the bank to match
        if (slotsPanel && slotsPanel.switchBank) {
          slotsPanel.switchBank(sceneIndex);
        }

        return true;
      }
      return false;
    },
    // Allow manual connection to a specific device by index
    connectToDeviceByIndex: (index) => {
      if (!midiAccess) return false;

      const inputs = Array.from(midiAccess.inputs.values());
      if (index >= 0 && index < inputs.length) {
        connectToDevice(inputs[index]);
        return true;
      }

      return false;
    },
    // List available devices
    listDevices: () => {
      if (!midiAccess) return [];

      return Array.from(midiAccess.inputs.values()).map(input => ({
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer,
        isActive: activeDevice && input.id === activeDevice.id
      }));
    },
    // Get the current MIDI mapping for reference
    getMidiMapping: () => {
      return JSON.parse(JSON.stringify(midiMapping)); // Return a deep copy
    },
    // Update a specific note mapping in the current bank
    updateMapping: (note, slotIndex) => {
      if (slotIndex < 0 || slotIndex > 15) return false;

      // Find the existing mapping for this note
      const mapIndex = midiMapping[currentScene].findIndex(m => m.note === note);

      if (mapIndex >= 0) {
        // Update existing mapping
        midiMapping[currentScene][mapIndex].slot = slotIndex;
      } else {
        // Add new mapping
        midiMapping[currentScene].push({
          note: note,
          slot: slotIndex
        });
      }

      // Save to localStorage
      saveMidiMapping(midiMapping);

      return true;
    },
    // Set an entirely new mapping for a specific bank/scene
    setMappingForBank: (bankIndex, newMapping) => {
      if (bankIndex < 0 || bankIndex > 3) return false;

      // Validate mapping
      if (!Array.isArray(newMapping)) return false;

      midiMapping[bankIndex] = newMapping;

      // Save to localStorage
      saveMidiMapping(midiMapping);
      return true;
    },

    // Save current mapping configuration
    saveMapping: () => {
      return saveMidiMapping(midiMapping);
    },

    // Reset to default mapping
    resetToDefaultMapping: () => {
      // Reset to default mapping
      for (let i = 0; i < 4; i++) {
        midiMapping[i] = JSON.parse(JSON.stringify(defaultMidiMapping[i]));
      }

      // Save to localStorage
      saveMidiMapping(midiMapping);
      return true;
    }
  };
}