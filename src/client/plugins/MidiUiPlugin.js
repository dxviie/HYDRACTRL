/**
 * MidiUiPlugin - MIDI status and device controls in the stats panel.
 *
 * Renders the device list, the refresh / scene-sync / mapping buttons and the
 * connection status text. The MIDI engine itself (MidiManager) stays in the
 * core — this plugin is only the UI around it.
 *
 * Exposes `window.updateMidiDeviceList` because MidiManager refreshes the
 * list through it when devices or scenes change.
 */

export function createMidiUiPlugin() {
  return {
    id: "midi-ui",
    name: "MIDI Device UI",
    description: "MIDI device list and controls in the stats panel",

    setup(ctx) {
      const stats = ctx.getPanels().stats;
      const manager = ctx.midi?.manager;
      if (ctx.isMobile || !stats || !manager) return;

      if (!ctx.midi.supported) {
        stats.midi.statusText.textContent = "MIDI: Not supported";
        stats.midi.statusText.style.color = "#ff5555"; // Red
        return;
      }

      stats.midi.statusText.textContent = "MIDI: Initializing...";

      function updateMidiDeviceList() {
        // Clear device container except for the buttons
        while (stats.midi.deviceContainer.children.length > 2) {
          stats.midi.deviceContainer.removeChild(stats.midi.deviceContainer.lastChild);
        }

        // Get device list
        const devices = manager.listDevices();

        if (devices.length === 0) {
          stats.midi.statusText.textContent = "MIDI: No devices found";
          return;
        }

        // Update status text with active device
        const activeDevice = manager.getActiveDevice();
        if (activeDevice) {
          stats.midi.statusText.textContent = `MIDI: ${activeDevice.name || "Unknown Device"}`;

          // Highlight nanoPAD if connected
          if (
            activeDevice.name &&
            (activeDevice.name.toLowerCase().includes("nanopad") ||
              activeDevice.name.toLowerCase().includes("korg"))
          ) {
            stats.midi.statusText.style.color = "#50fa7b"; // Green
          } else {
            stats.midi.statusText.style.color = "#aaa";
          }
        } else {
          stats.midi.statusText.textContent = "MIDI: No active device";
          stats.midi.statusText.style.color = "#aaa";
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
            manager.connectToDeviceByIndex(index);
            updateMidiDeviceList();
          });

          stats.midi.deviceContainer.appendChild(deviceButton);
        });
      }

      // MidiManager refreshes the list through this global on device/scene changes
      window.updateMidiDeviceList = updateMidiDeviceList;

      // Add refresh button
      const refreshButton = document.createElement("button");
      refreshButton.textContent = "Refresh MIDI";
      refreshButton.style.fontSize = "10px";
      refreshButton.style.padding = "2px 4px";
      refreshButton.style.margin = "4px 0";
      refreshButton.style.width = "fit-content";

      refreshButton.addEventListener("click", () => {
        updateMidiDeviceList();
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
        const slots = ctx.getPanels().slots;
        if (slots) {
          // Set MIDI scene to match current bank
          const currentBank = slots.getBank();
          manager.setScene(currentBank);
          updateMidiDeviceList();

          ctx.notify(`Synced nanoPAD Scene ${currentBank + 1} with Bank ${currentBank + 1}`, {
            type: "success",
          });
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
        if (manager.resetToDefaultMapping && confirm("Reset MIDI mapping to defaults?")) {
          manager.resetToDefaultMapping();
          ctx.notify("MIDI mapping reset to defaults", { type: "error", duration: 2000 });
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
        if (manager.getMidiMapping) {
          const mapping = manager.getMidiMapping();
          const currentBank = manager.getCurrentScene();

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
      const lineBreak = document.createElement("br");
      stats.midi.deviceContainer.appendChild(refreshButton);
      stats.midi.deviceContainer.appendChild(syncButton);
      stats.midi.deviceContainer.appendChild(lineBreak);
      stats.midi.deviceContainer.appendChild(infoButton);
      stats.midi.deviceContainer.appendChild(resetButton);

      // Initial update of device list, once devices have had time to register
      const initialTimer = setTimeout(updateMidiDeviceList, 1000);

      return {
        api: { updateDeviceList: updateMidiDeviceList },
        dispose() {
          clearTimeout(initialTimer);
          for (const el of [refreshButton, syncButton, lineBreak, infoButton, resetButton]) {
            el.remove();
          }
          if (window.updateMidiDeviceList === updateMidiDeviceList) {
            window.updateMidiDeviceList = undefined;
          }
        },
      };
    },
  };
}
