/**
 * InfoPanelPlugin - the "About" panel with keyboard shortcuts.
 *
 * Shows app information, the keyboard shortcut reference and the
 * "show on startup" preference. On mobile it doubles as the landing screen
 * with a big "load random scenes" button.
 *
 * Exposes `window.showInfoPanel` / `window.hideInfoPanel` because the stats
 * panel's info button (and legacy code) calls them.
 */

import { makeDraggable } from "../../utils/Draggable.js";

const STARTUP_KEY = "hydractrl-show-info-on-startup";

/** Keyboard shortcut reference shown in the panel. Exported for reuse/tests. */
export const KEYBOARD_SHORTCUTS = [
  { keys: "Ctrl/⌘ + `", action: "Toggle UI visibility" },
  { keys: "Esc", action: "Bring back hidden UI" },
  { keys: "Alt/⌥ + U", action: "Copy sketch as shareable URL" },
  { keys: "Ctrl/⌘ + Enter", action: "Run code" },
  { keys: "Ctrl/⌘ + S", action: "Save code" },
  { keys: "Ctrl/⌘ + Y", action: "Toggle Auto Run" },
  { keys: "Alt/⌥ + 0-9 / A-F", action: "Select slot 1 to 16 (HEX)" },
  { keys: "Alt/⌥ + ←/→", action: "Cycle between banks (only when no MIDI connected)" },
  { keys: "Alt/⌥ + X", action: "Export all slots" },
  { keys: "Alt/⌥ + I", action: "Import slots file" },
];

export function createInfoPanelPlugin() {
  return {
    id: "info-panel",
    name: "Info Panel",
    description: "About panel with keyboard shortcuts and startup preference",

    setup(ctx) {
      const isMobile = ctx.isMobile;

      function createPanel() {
        // Check if panel already exists
        if (document.getElementById("info-panel")) {
          return document.getElementById("info-panel");
        }

        // Create the panel container
        const panel = document.createElement("div");
        panel.id = "info-panel";
        panel.className = "info-panel";
        panel.style.position = "fixed";
        panel.style.backgroundColor =
          "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity)) !important";
        panel.style.borderRadius = "8px";
        panel.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
        panel.style.backdropFilter = "blur(var(--color-panel-blur))";
        panel.style.zIndex = "1000";
        panel.style.overflow = "hidden";
        panel.style.display = "flex";
        panel.style.flexDirection = "column";

        if (isMobile) {
          // Mobile positioning: center on screen
          panel.style.top = "50%";
          panel.style.left = "50%";
          panel.style.transform = "translate(-50%, -50%)";
          panel.style.width = "90vw";
          panel.style.maxWidth = "400px";
          panel.style.maxHeight = "70vh";
        } else {
          // Desktop positioning
          panel.style.top = "50%";
          panel.style.left = "50%";
          panel.style.transform = "translate(-50%, -50%)";
          panel.style.width = "500px";
          panel.style.maxWidth = "90vw";
          panel.style.maxHeight = "80vh";
        }

        // Create the header with title and close button
        const header = document.createElement("div");
        header.className = "info-panel-header";
        header.style.backgroundColor = "rgba(var(--color-bg-tertiary-rgb), var(--panel-opacity))";
        header.style.padding = "12px 16px";
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.cursor = "move";
        header.style.userSelect = "none";

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
        if (isMobile) {
          aboutText.innerHTML = `This app is designed for desktop, but you can play around here by loading random clips (by clicking on the dice 🎲). For the full experience, visit this site on a desktop computer. Check out the <a href="https://dxviie.github.io/HYDRACTRL/" style="color:var(--color-text-secondary);text-decoration:underline">GitHub Page</a> for more info.`;
        } else {
          aboutText.innerHTML = `HYDRACTRL is a tool built around <a href="https://hydra.ojack.xyz" target="_blank" style="color:var(--color-text-secondary);text-decoration:underline">hydra</a> designed for live performances. Check out the <a href="https://dxviie.github.io/HYDRACTRL/" style="color:var(--color-text-secondary);text-decoration:underline">GitHub Page</a> for a feature overview.`;
        }
        aboutText.style.margin = "0 0 15px 0";
        aboutText.style.fontSize = "13px";
        aboutText.style.lineHeight = "1.4";
        aboutText.style.color = "var(--color-text-secondary)";

        aboutSection.appendChild(aboutText);

        // Add big dice button for mobile
        if (isMobile) {
          const mobileDiceButton = document.createElement("button");
          mobileDiceButton.className = "mobile-dice-button";
          mobileDiceButton.innerHTML = "🎲 Load Random Scenes";
          mobileDiceButton.style.fontSize = "16px";
          mobileDiceButton.style.padding = "12px 24px";
          mobileDiceButton.style.margin = "10px 0";
          mobileDiceButton.style.backgroundColor = "var(--color-perf-medium)";
          mobileDiceButton.style.color = "white";
          mobileDiceButton.style.border = "none";
          mobileDiceButton.style.borderRadius = "6px";
          mobileDiceButton.style.cursor = "pointer";
          mobileDiceButton.style.width = "100%";
          mobileDiceButton.style.fontWeight = "bold";

          mobileDiceButton.addEventListener("click", () => {
            const slots = ctx.getPanels().slots;
            if (slots && slots.loadRandomScenes) {
              slots.loadRandomScenes();
            }
            hide();
          });

          aboutSection.appendChild(mobileDiceButton);
        }

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

        // Add shortcuts to table
        KEYBOARD_SHORTCUTS.forEach((shortcut) => {
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
        showOnStartupCheckbox.checked = ctx.storage.get(STARTUP_KEY) !== "false"; // Default to true

        const showOnStartupLabel = document.createElement("label");
        showOnStartupLabel.htmlFor = "show-on-startup";
        showOnStartupLabel.textContent = "Show on startup";
        showOnStartupLabel.style.marginLeft = "8px";
        showOnStartupLabel.style.fontSize = "13px";
        showOnStartupLabel.style.color = "var(--color-text-secondary)";

        showOnStartupCheckbox.addEventListener("change", (e) => {
          ctx.storage.set(STARTUP_KEY, e.target.checked);
        });

        startupSection.appendChild(showOnStartupCheckbox);
        startupSection.appendChild(showOnStartupLabel);

        // Add everything to content
        content.appendChild(aboutSection);
        if (!isMobile) {
          content.appendChild(shortcutsSection);
          content.appendChild(startupSection);
        }

        // Add header and content to panel
        panel.appendChild(header);
        panel.appendChild(content);

        // Add to body
        document.body.appendChild(panel);

        // Close button functionality
        closeButton.addEventListener("click", () => {
          hide();
        });

        // Add one-time event listeners to close the panel
        const outsideClickHandler = (e) => {
          // Only close if click is outside the panel
          if (panel.parentNode && !panel.contains(e.target)) {
            hide();
            document.removeEventListener("mousedown", outsideClickHandler);
          }
        };

        // Prevent clicks inside the panel from bubbling to document
        panel.addEventListener("mousedown", (e) => {
          e.stopPropagation();
        });

        const escKeyHandler = (e) => {
          if (panel.parentNode && e.key === "Escape") {
            hide();
            e.stopPropagation(); // Prevent editor toggle
            document.removeEventListener("keydown", escKeyHandler);
          }
        };

        // We'll add these listeners when the panel is shown
        panel.outsideClickHandler = outsideClickHandler;
        panel.escKeyHandler = escKeyHandler;

        // Make the panel draggable using the header as handle (desktop only)
        if (!isMobile) {
          makeDraggable(panel, header, "info-panel");
        }

        return panel;
      }

      function show() {
        const panel = createPanel();
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

      function hide() {
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

      // Legacy globals: the stats panel's info button calls window.showInfoPanel
      window.showInfoPanel = show;
      window.hideInfoPanel = hide;

      // Show on startup: always on mobile (it is the landing screen), on
      // desktop only when the preference allows it. Slight delay so the rest
      // of the UI settles first.
      let startupTimer = null;
      if (isMobile || ctx.storage.get(STARTUP_KEY) !== "false") {
        startupTimer = setTimeout(show, 500);
      }

      return {
        api: { show, hide },
        dispose() {
          clearTimeout(startupTimer);
          const panel = document.getElementById("info-panel");
          if (panel) {
            document.removeEventListener("mousedown", panel.outsideClickHandler);
            document.removeEventListener("keydown", panel.escKeyHandler);
            panel.remove();
          }
          if (window.showInfoPanel === show) window.showInfoPanel = undefined;
          if (window.hideInfoPanel === hide) window.hideInfoPanel = undefined;
        },
      };
    },
  };
}
