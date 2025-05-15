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
  const midiStatus = document.createElement("div");
  midiStatus.className = "midi-status";
  midiStatus.style.position = "absolute";
  midiStatus.style.bottom = "10px";
  midiStatus.style.left = "10px";
  midiStatus.style.fontSize = "10px";
  midiStatus.style.color = "#aaa";
  midiStatus.style.padding = "4px";
  midiStatus.style.borderRadius = "3px";
  midiStatus.style.backgroundColor = "rgba(30, 30, 30, 0.6)";
  midiStatus.style.display = "none";
  document.body.appendChild(midiStatus);

  // Show/hide MIDI status with animation
  function showMidiStatus(message, isError = false) {
    midiStatus.textContent = message;
    midiStatus.style.color = isError ? "#ff5555" : "#aaa";
    midiStatus.style.display = "block";
    midiStatus.style.opacity = "1";

    // Auto hide after 5 seconds
    setTimeout(() => {
      midiStatus.style.opacity = "0";
      setTimeout(() => {
        midiStatus.style.display = "none";
      }, 500);
    }, 5000);
  }

  // Initialize MIDI system
  function init() {
    if (!navigator.requestMIDIAccess) {
      console.warn("WebMIDI is not supported in this browser");
      showMidiStatus("MIDI not supported in this browser", true);
      return false;
    }

    navigator.requestMIDIAccess({ sysex: true }).then(onMIDISuccess, onMIDIFailure);

    console.log(
      "MIDI Debug Info: If your scene buttons aren't recognized, " +
        "press them and check the console log to see their MIDI messages. " +
        "Then you can add them to the supported patterns.",
    );

    return true;
  }

  // Handle successful MIDI access
  function onMIDISuccess(access) {
    midiAccess = access;

    // Listen for connect/disconnect events
    midiAccess.onstatechange = onStateChange;

    // Check if any MIDI inputs exist
    if (midiAccess.inputs.size === 0) {
      showMidiStatus("No MIDI devices found. Please connect one.");
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
    isNanoPad =
      activeDevice.name &&
      (activeDevice.name.toLowerCase().includes("nanopad") ||
        activeDevice.name.toLowerCase().includes("korg"));

    showMidiStatus(`Connected: ${activeDevice.name || "MIDI Device"}`);
    console.log(`MIDI connected: ${activeDevice.name}`);
  }

  // Handle MIDI connection/disconnection
  function onStateChange(event) {
    // Check if a device was connected
    if (event.port.state === "connected" && event.port.type === "input") {
      if (!isConnected) {
        connectToDevice(event.port);
      }
      showMidiStatus(`Connected: ${event.port.name}`);
    }

    // Check if the active device was disconnected
    if (event.port.state === "disconnected" && activeDevice && event.port.id === activeDevice.id) {
      isConnected = false;
      activeDevice = null;
      showMidiStatus("MIDI device disconnected");

      // Try to connect to another device if available
      connectToFirstAvailableDevice();
    }
  }

  // Handle MIDI failure
  function onMIDIFailure(error) {
    console.error("MIDI access failed:", error);
    showMidiStatus("MIDI access failed. Check permissions.", true);
  }

  // Track the current scene on the nanoPAD
  let currentScene = 0; // Scene 1 by default

  // Track rate limiting for messages that may come from XY pad
  const lastCCValues = {};
  const THROTTLE_TIME = 500; // ms between allowed bank changes
  let lastBankChange = 0;

  // Handle MIDI messages
  function onMIDIMessage(message) {
    const data = message.data;
    const cmd = data[0] & 0xf0; // Command byte (top 4 bits)
    const channel = data[0] & 0x0f; // Channel (bottom 4 bits)

    // Special guard for XY pad - block high frequency CC messages
    if (cmd === 0xb0) {
      // Control Change
      const ccNum = data[1];
      const value = data[2];

      // Check if this CC number is known to be an XY pad (usually CC 16-17 or 0-1)
      const xyPadCCs = [0, 1, 16, 17, 18, 19];
      if (xyPadCCs.includes(ccNum)) {
        // Throttle the message if it's coming too fast
        const now = Date.now();
        const ccKey = `${channel}_${ccNum}`;
        const lastTime = lastCCValues[ccKey]?.time || 0;
        const lastValue = lastCCValues[ccKey]?.value || 0;

        // Store the current value and time
        lastCCValues[ccKey] = { time: now, value: value };

        // If this message is coming too quickly after the last one, it's likely the XY pad
        if (now - lastTime < 100) {
          console.log(`Blocking potential XY pad message: CC#${ccNum}=${value}`);
          return; // Skip processing this message further
        }

        // If this CC value could trigger a bank change, enforce a cooldown period
        if (value >= 0 && value <= 3) {
          if (now - lastBankChange < THROTTLE_TIME) {
            console.log(`Throttling potential bank change message: CC#${ccNum}=${value}`);
            return; // Skip processing this message
          }
          lastBankChange = now;
        }
      }
    }

    // Enhanced MIDI debugging
    let messageType = "Unknown";
    switch (cmd) {
      case 0x80:
        messageType = "Note Off";
        break;
      case 0x90:
        messageType = data[2] > 0 ? "Note On" : "Note Off";
        break;
      case 0xa0:
        messageType = "Aftertouch";
        break;
      case 0xb0:
        messageType = "Control Change";
        break;
      case 0xc0:
        messageType = "Program Change";
        break;
      case 0xd0:
        messageType = "Channel Pressure";
        break;
      case 0xe0:
        messageType = "Pitch Bend";
        break;
      case 0xf0:
        messageType = "System Exclusive";
        break;
    }

    // Special case for SysEx messages (240 = 0xF0)
    if (data[0] === 240) {
      // Check for nanoPAD2 scene change SysEx messages
      // Pattern: [240, 66, 64, 0, 1, 18, 0, 95, 79, sceneNumber, 247]
      if (data[1] === 66 && data[2] === 64 && data[8] === 79) {
        const sceneNumber = data[9];
        if (sceneNumber >= 0 && sceneNumber <= 3) {
          // Throttle scene changes to prevent issues from XY pad
          const now = Date.now();

          // Only allow a scene change if it's been at least THROTTLE_TIME ms since the last one
          // This prevents the XY pad from triggering multiple scene changes
          if (now - lastBankChange >= THROTTLE_TIME) {
            console.log(`nanoPAD2 Scene change SysEx detected: Scene ${sceneNumber + 1}`);
            lastBankChange = now;
            handlePossibleSceneChange(sceneNumber);
          } else {
            console.log(`Throttling nanoPAD2 scene change to prevent XY pad interference`);
          }
        }
      }
    }

    console.log(
      `MIDI ${messageType}: [${data.join(", ")}] Channel: ${channel + 1}`,
      cmd === 0x90
        ? `Note: ${data[1]} Velocity: ${data[2]}`
        : cmd === 0xb0
          ? `Controller: ${data[1]} Value: ${data[2]}`
          : cmd === 0xc0
            ? `Program: ${data[1]}`
            : "",
    );

    // nanoPAD2 specific handling
    if (isNanoPad) {
      // Note On message (button press)
      if (cmd === 0x90 && data[2] > 0) {
        // Note On with velocity > 0
        const note = data[1];

        // Process regular pad notes (not scene buttons)
        handleNanoPadNote(note);
      }

      // Program Change messages - sometimes used for scene changes
      if (cmd === 0xc0) {
        // Program Change
        const program = data[1];

        // If program is in range 0-3, it might be a scene change
        if (program >= 0 && program <= 3) {
          handlePossibleSceneChange(program);
        }
      }

      // For nanoPAD2, we've determined that it uses SysEx messages for scene changes
      // So we'll completely ignore CC messages for scene changes to prevent the XY pad
      // from triggering unwanted bank changes
      if (cmd === 0xb0) {
        // CC message
        // Just log the message but don't take action
        const ccNum = data[1];
        const value = data[2];
        console.log(`Ignoring CC#${ccNum}=${value} to prevent XY pad interference`);
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

  // Helper for handling scene changes
  function handlePossibleSceneChange(sceneNumber) {
    if (sceneNumber >= 0 && sceneNumber <= 3) {
      console.log(`Scene change detected: ${sceneNumber + 1}`);

      // Update current scene
      currentScene = sceneNumber;

      // Switch bank to match scene
      if (slotsPanel && slotsPanel.switchBank) {
        slotsPanel.switchBank(sceneNumber);
      }

      // Update MIDI status with highlighted text
      showMidiStatus(`Scene ${sceneNumber + 1} / Bank ${sceneNumber + 1} selected`);

      // Update UI if needed
      if (window.updateMidiDeviceList) {
        window.updateMidiDeviceList();
      }

      // Visual feedback - flash the active bank dot
      if (window.flashActiveBankDot) {
        window.flashActiveBankDot(sceneNumber);
      } else {
        // Create a temporary visual indicator
        const notification = document.createElement("div");
        notification.className = "saved-notification";
        notification.style.backgroundColor = "rgba(80, 250, 123, 0.8)";
        notification.textContent = `Scene ${sceneNumber + 1} / Bank ${sceneNumber + 1}`;
        notification.style.position = "fixed";
        notification.style.top = "50%";
        notification.style.left = "50%";
        notification.style.transform = "translate(-50%, -50%)";
        notification.style.fontSize = "24px";
        notification.style.padding = "20px";
        notification.style.borderRadius = "10px";
        notification.style.boxShadow = "0 0 20px rgba(0, 0, 0, 0.5)";
        notification.style.zIndex = "2000";
        document.body.appendChild(notification);

        // Remove after a short time
        setTimeout(() => {
          notification.classList.add("fade-out");
          setTimeout(() => {
            if (notification.parentNode) {
              document.body.removeChild(notification);
            }
          }, 300);
        }, 800);
      }

      return true;
    }
    return false;
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
      { note: 50, slot: 15 },
    ],
    // Bank 1 (Scene 2) - using same mapping pattern with different notes
    [
      { note: 53, slot: 0 }, // Top row (higher notes)
      { note: 55, slot: 1 },
      { note: 57, slot: 2 },
      { note: 59, slot: 3 },
      { note: 61, slot: 4 },
      { note: 63, slot: 5 },
      { note: 65, slot: 6 },
      { note: 67, slot: 7 },
      { note: 52, slot: 8 }, // Bottom row (lower notes)
      { note: 54, slot: 9 },
      { note: 56, slot: 10 },
      { note: 58, slot: 11 },
      { note: 60, slot: 12 },
      { note: 62, slot: 13 },
      { note: 64, slot: 14 },
      { note: 66, slot: 15 },
    ],
    // Bank 2 (Scene 3) - using same mapping pattern with different notes
    [
      { note: 69, slot: 0 }, // Top row (higher notes)
      { note: 71, slot: 1 },
      { note: 73, slot: 2 },
      { note: 75, slot: 3 },
      { note: 77, slot: 4 },
      { note: 79, slot: 5 },
      { note: 81, slot: 6 },
      { note: 83, slot: 7 },
      { note: 68, slot: 8 }, // Bottom row (lower notes)
      { note: 70, slot: 9 },
      { note: 72, slot: 10 },
      { note: 74, slot: 11 },
      { note: 76, slot: 12 },
      { note: 78, slot: 13 },
      { note: 80, slot: 14 },
      { note: 82, slot: 15 },
    ],
    // Bank 3 (Scene 4) - using same mapping pattern with different notes
    [
      { note: 85, slot: 0 }, // Top row (higher notes)
      { note: 87, slot: 1 },
      { note: 89, slot: 2 },
      { note: 91, slot: 3 },
      { note: 93, slot: 4 },
      { note: 95, slot: 5 },
      { note: 97, slot: 6 },
      { note: 99, slot: 7 },
      { note: 84, slot: 8 }, // Bottom row (lower notes)
      { note: 86, slot: 9 },
      { note: 88, slot: 10 },
      { note: 90, slot: 11 },
      { note: 92, slot: 12 },
      { note: 94, slot: 13 },
      { note: 96, slot: 14 },
      { note: 98, slot: 15 },
    ],
  ];

  // Load saved mapping from localStorage or use default
  function loadMidiMapping() {
    try {
      const savedMapping = localStorage.getItem("hydractrl-midi-mapping");
      if (savedMapping) {
        const parsed = JSON.parse(savedMapping);
        // Validate the mapping structure
        if (Array.isArray(parsed) && parsed.length === 4) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("Error loading MIDI mapping:", error);
    }

    // Return default mapping if no valid mapping is found
    return JSON.parse(JSON.stringify(defaultMidiMapping));
  }

  // Save mapping to localStorage
  function saveMidiMapping(mapping) {
    try {
      localStorage.setItem("hydractrl-midi-mapping", JSON.stringify(mapping));
      return true;
    } catch (error) {
      console.error("Error saving MIDI mapping:", error);
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
    const mapping = mappings.find((m) => m.note === note);

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

      return Array.from(midiAccess.inputs.values()).map((input) => ({
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer,
        isActive: activeDevice && input.id === activeDevice.id,
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
      const mapIndex = midiMapping[currentScene].findIndex((m) => m.note === note);

      if (mapIndex >= 0) {
        // Update existing mapping
        midiMapping[currentScene][mapIndex].slot = slotIndex;
      } else {
        // Add new mapping
        midiMapping[currentScene].push({
          note: note,
          slot: slotIndex,
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
    },
  };
}
