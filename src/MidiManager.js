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
    } else {
      // Generic MIDI handling for other devices
      // Note On
      if (cmd === 0x90 && data[2] > 0) {
        const note = data[1];
        handleGenericNote(note);
      }
    }
  }
  
  // Handle nanoPAD2 pad press
  function handleNanoPadNote(note) {
    console.log(`nanoPAD2 pad: ${note}`);
    
    // nanoPAD2 Scene 1 default mapping: 
    // First row: 36-43
    // Second row: 44-51
    
    // Map to slot index (0-15)
    let slotIndex = -1;
    
    // First row (pads 1-8)
    if (note >= 36 && note <= 43) {
      slotIndex = note - 36;
    }
    // Second row (pads 9-16)
    else if (note >= 44 && note <= 51) {
      slotIndex = note - 44 + 8;
    }
    
    // Select the slot if valid
    if (slotIndex >= 0 && slotIndex < 16 && slotsPanel) {
      slotsPanel.setActiveSlot(slotIndex);
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
    }
  };
}