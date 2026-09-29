/**
 * Simple Stats Panel
 * A minimal, draggable FPS counter that doesn't rely on complex component architecture
 */
import { FEEDBACK_FORM_ID } from "./project.js";
import { trackPointerDrag } from "./utils/Draggable.js";
import { loadPanelPosition, savePanelPosition } from "./utils/PanelStorage.js";

/**
 * @param {object} [options]
 * @param {boolean} [options.midi] - MIDI status, devices and MIDI Learn (off on tablets,
 *   which keep only the XY pad button of that section).
 * @param {boolean} [options.breakout] - The display section with the breakout window.
 */
export function createStatsPanel({ midi = true, breakout = true } = {}) {
  // Load saved position or use defaults
  const savedPosition = loadPanelPosition("stats-panel");

  // Load saved theme from localStorage
  const savedTheme = localStorage.getItem("hydractrl-theme") || "default";

  // Create the panel container
  const panel = document.createElement("div");
  panel.className = "stats-panel";
  panel.style.position = "absolute";

  if (savedPosition) {
    panel.style.left = savedPosition.left + "px";
    panel.style.top = savedPosition.top + "px";
  } else {
    panel.style.top = "20px";
    panel.style.right = "20px";
  }

  // Load saved opacity or use default
  const panelOpacity = localStorage.getItem("hydractrl-panel-opacity") || "90";
  const opacityDecimal = Number.parseInt(panelOpacity) / 100;

  // Add panel opacity CSS variable if it doesn't exist
  if (!document.documentElement.style.getPropertyValue("--panel-opacity")) {
    document.documentElement.style.setProperty("--panel-opacity", opacityDecimal);
  }

  panel.style.backgroundColor =
    "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity)) !important";
  panel.style.borderRadius = "var(--panel-radius)";
  panel.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
  panel.style.backdropFilter = "blur(var(--color-panel-blur))";
  panel.style.zIndex = "100";
  panel.style.overflow = "hidden";
  panel.style.width = "auto";
  panel.style.minWidth = "120px";

  // Create the handle
  const handle = document.createElement("div");
  handle.className = "stats-handle";
  handle.style.height = "24px";
  handle.style.backgroundColor = "rgba(var(--color-bg-tertiary-rgb), var(--panel-opacity))";
  handle.style.display = "flex";
  handle.style.justifyContent = "space-between";
  handle.style.alignItems = "center";
  handle.style.padding = "0 6px 0 8px";
  handle.style.cursor = "move";
  handle.style.userSelect = "none";

  // Create the title
  const title = document.createElement("div");
  title.className = "stats-title";
  title.style.fontSize = "11px";
  title.style.fontWeight = "600";
  title.style.letterSpacing = "0.08em";
  title.style.textTransform = "uppercase";
  title.style.color = "var(--color-text-secondary)";
  title.textContent = "SYSTEM";

  // Create buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "stats-buttons";
  buttonsContainer.style.display = "flex";
  buttonsContainer.style.alignItems = "center";
  buttonsContainer.style.gap = "6px";

  // Create the docs button
  const docsButton = document.createElement("div");
  docsButton.className = "docs-button";
  docsButton.style.fontSize = "14px";
  docsButton.style.color = "var(--color-text-secondary)";
  docsButton.style.cursor = "pointer";
  docsButton.style.display = "flex";
  docsButton.style.width = "14px";
  docsButton.style.height = "14px";
  docsButton.style.alignItems = "center";
  docsButton.style.justifyContent = "center";
  docsButton.style.transition = "all 0.2s ease";
  docsButton.title = "Hydra Functions Reference";
  docsButton.innerHTML =
    "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><path fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='3.5' d='M12 9.8V20m0-10.2c0-1.704.107-3.584-1.638-4.473C9.72 5 8.88 5 7.2 5H4.6C3.364 5 3 5.437 3 6.6v8.8c0 .568-.036 1.195.546 1.491c.214.109.493.109 1.052.109H7.43c2.377 0 3.26 1.036 4.569 3m0-10.2c0-1.704-.108-3.584 1.638-4.473C14.279 5 15.12 5 16.8 5h2.6c1.235 0 1.6.436 1.6 1.6v8.8c0 .567.035 1.195-.546 1.491c-.213.109-.493.109-1.052.109h-2.833c-2.377 0-3.26 1.036-4.57 3'/></svg>";
  docsButton.style.opacity = "0.7";

  docsButton.addEventListener("mouseenter", () => {
    docsButton.style.opacity = "1";
    docsButton.style.transform = "scale(1.1)";
  });

  docsButton.addEventListener("mouseleave", () => {
    docsButton.style.opacity = "0.7";
    docsButton.style.transform = "scale(1)";
  });

  // Create the toggle button
  const toggle = document.createElement("div");
  toggle.className = "stats-toggle";
  toggle.style.fontSize = "10px";
  toggle.style.color = "var(--color-text-secondary)";
  toggle.style.padding = "2px 4px";
  toggle.style.borderRadius = "2px";
  toggle.style.cursor = "pointer";
  toggle.textContent = "▲";

  // Create the content container
  const content = document.createElement("div");
  content.className = "stats-content";
  content.style.padding = "6px 8px";

  // Create the metrics container
  const metrics = document.createElement("div");
  metrics.className = "stats-metrics";
  metrics.style.display = "flex";
  metrics.style.gap = "12px";

  // MIDI section for expanded view
  const midiSection = document.createElement("div");
  midiSection.className = "stats-midi";
  midiSection.style.marginTop = "6px";
  midiSection.style.paddingTop = "6px";
  midiSection.style.borderTop = "1px solid var(--color-bg-tertiary)";
  midiSection.style.display = "none"; // Initially hidden
  midiSection.style.flexDirection = "column";
  midiSection.style.gap = "4px";

  // MIDI status text
  const midiStatusText = document.createElement("div");
  midiStatusText.className = "midi-status-text";
  midiStatusText.style.fontSize = "11px";
  midiStatusText.style.color = "var(--color-text-secondary)";
  midiStatusText.style.fontWeight = "600";
  midiStatusText.textContent = "MIDI: Not initialized";

  // MIDI device selection
  const midiDeviceContainer = document.createElement("div");
  midiDeviceContainer.style.display = "flex";
  midiDeviceContainer.style.flexDirection = "column";
  midiDeviceContainer.style.gap = "2px";

  // Create buttons container
  const midiButtonsContainer = document.createElement("div");
  midiButtonsContainer.style.display = "flex";
  midiButtonsContainer.style.gap = "4px";
  midiButtonsContainer.style.marginTop = "2px";

  // Create MIDI learn button
  const midiLearnButton = document.createElement("button");
  midiLearnButton.className = "midi-learn-button";
  midiLearnButton.style.backgroundColor = "var(--color-bg-tertiary)";
  midiLearnButton.style.border = "none";
  midiLearnButton.style.borderRadius = "4px";
  midiLearnButton.style.padding = "2px 8px";
  midiLearnButton.style.color = "var(--color-text-primary)";
  midiLearnButton.style.cursor = "pointer";
  midiLearnButton.style.fontSize = "11px";
  midiLearnButton.textContent = "MIDI Learn";

  // Create XY pad toggle button
  const xyPadButton = document.createElement("button");
  xyPadButton.className = "xy-pad-button";
  xyPadButton.style.backgroundColor = "var(--color-bg-tertiary)";
  xyPadButton.style.border = "none";
  xyPadButton.style.borderRadius = "4px";
  xyPadButton.style.padding = "2px 8px";
  xyPadButton.style.color = "var(--color-text-primary)";
  xyPadButton.style.cursor = "pointer";
  xyPadButton.style.fontSize = "11px";
  xyPadButton.textContent = "Show XY Pad";

  // Set initial button text based on localStorage
  const xyPadVisible = localStorage.getItem("hydractrl-xy-pad-visible") === "true";
  xyPadButton.textContent = xyPadVisible ? "Hide XY Pad" : "Show XY Pad";

  xyPadButton.addEventListener("click", () => {
    const xyPadPanelElement = document.querySelector(".xy-pad-panel");
    const isVisible = xyPadPanelElement.style.visibility !== "hidden";
    const newVisible = !isVisible;

    // Update visibility
    xyPadPanelElement.style.visibility = newVisible ? "visible" : "hidden";

    // Update localStorage and button text
    localStorage.setItem("hydractrl-xy-pad-visible", newVisible);
    xyPadButton.textContent = newVisible ? "Hide XY Pad" : "Show XY Pad";
  });

  // Create MIDI mapping display
  const midiMappingDisplay = document.createElement("div");
  midiMappingDisplay.className = "midi-mapping-display";
  midiMappingDisplay.style.fontSize = "11px";
  midiMappingDisplay.style.color = "var(--color-text-secondary)";
  midiMappingDisplay.style.marginTop = "4px";
  midiMappingDisplay.style.display = "none";

  // Add click handler for MIDI learn
  midiLearnButton.addEventListener("click", () => {
    if (window.midiManager.isLearning()) {
      window.midiManager.cancelLearnMode();
      midiLearnButton.textContent = "MIDI Learn";
      midiMappingDisplay.style.display = "none";
    } else {
      midiMappingDisplay.style.display = "block";
      midiMappingDisplay.textContent = "Click a slot, then press a pad to map it...";
      midiLearnButton.textContent = "Cancel Learn";

      // Start MIDI learn mode
      window.midiManager.startLearnMode((note) => {
        const activeSlot = window.slotsPanel.getActiveSlotIndex();
        if (activeSlot !== null) {
          window.midiManager.updateMapping(note, activeSlot);
          midiMappingDisplay.textContent = `Mapped pad ${note} to slot ${activeSlot + 1}`;
          setTimeout(() => {
            midiMappingDisplay.style.display = "none";
          }, 2000);
        }
        midiLearnButton.textContent = "MIDI Learn";
      });
    }
  });

  // Add buttons to container
  if (midi) midiButtonsContainer.appendChild(midiLearnButton);
  midiButtonsContainer.appendChild(xyPadButton);

  // Add to MIDI section; without MIDI only the XY pad button is left
  if (midi) {
    midiSection.appendChild(midiStatusText);
    midiSection.appendChild(midiDeviceContainer);
  } else {
    midiButtonsContainer.style.marginTop = "0";
  }
  midiSection.appendChild(midiButtonsContainer);
  if (midi) midiSection.appendChild(midiMappingDisplay);

  // Create a theme settings section
  const themeSection = document.createElement("div");
  themeSection.className = "stats-theme";
  themeSection.style.marginTop = "6px";
  themeSection.style.paddingTop = "6px";
  themeSection.style.borderTop = "1px solid var(--color-bg-tertiary)";
  themeSection.style.display = "none"; // Initially hidden
  themeSection.style.flexDirection = "column";
  themeSection.style.gap = "4px";

  // Theme section title
  const themeTitle = document.createElement("div");
  themeTitle.className = "theme-title";
  themeTitle.style.fontSize = "11px";
  themeTitle.style.color = "var(--color-text-secondary)";
  themeTitle.style.fontWeight = "600";
  themeTitle.style.letterSpacing = "0.08em";
  themeTitle.textContent = "THEME";

  // Theme selector container - compact row of swatches
  const themeSelector = document.createElement("div");
  themeSelector.style.display = "flex";
  themeSelector.style.gap = "6px";
  themeSelector.style.padding = "2px";

  // Define themes with primary, secondary, tertiary background colors and text colors
  const themes = [
    {
      name: "default",
      label: "Default",
      bgPrimary: "#1e1e1e",
      bgSecondary: "rgba(37, 37, 37, 0.9)",
      bgTertiary: "rgba(60, 60, 60, 0.7)",
      textPrimary: "#f5f5f5",
      textSecondary: "#aaa",
      className: "",
    },
    {
      name: "light",
      label: "Light",
      bgPrimary: "#f3f2f7",
      bgSecondary: "rgba(250, 249, 252, 0.94)",
      bgTertiary: "rgba(236, 234, 242, 0.96)",
      textPrimary: "#1c1a24",
      textSecondary: "#6a6679",
      swatch: ["#faf9fc", "#faf9fc", "#dcd8e7", "#1c1a24", "#6d28d9"],
      className: "theme-light",
    },
    {
      name: "dark",
      label: "Dark",
      bgPrimary: "#121212",
      bgSecondary: "rgba(25, 25, 25, 0.8)",
      bgTertiary: "rgba(35, 35, 35, 0.8)",
      textPrimary: "#ffffff",
      textSecondary: "#cccccc",
      className: "theme-dark",
    },
    {
      name: "neon-eighties",
      label: "Neon 80s",
      bgPrimary: "#0b0b2b",
      bgSecondary: "rgba(30, 30, 60, 0.8)",
      bgTertiary: "rgba(45, 45, 80, 0.8)",
      textPrimary: "#ff00ff",
      textSecondary: "#00ffff",
      className: "theme-neon-eighties",
    },
    {
      name: "nineties-pop",
      label: "Pop 90s",
      bgPrimary: "#fff3d6",
      bgSecondary: "rgba(255, 248, 231, 0.95)",
      bgTertiary: "rgba(255, 214, 10, 0.96)",
      textPrimary: "#1a1423",
      textSecondary: "#5a3d70",
      swatch: ["#fff8e7", "#ffd60a", "#ff3d9a", "#00c2b8", "#1a1423"],
      className: "theme-nineties-pop",
    },
  ];

  // Create theme swatches showing all theme colors (or the ones a theme picks)
  themes.forEach((theme) => {
    const [first, second, third, fourth, fifth] = theme.swatch || [
      theme.bgPrimary,
      theme.bgSecondary,
      theme.bgTertiary,
      theme.textPrimary,
      theme.textSecondary,
    ];
    const swatch = document.createElement("div");
    swatch.className = "theme-swatch";
    swatch.title = theme.label;
    swatch.dataset.theme = theme.name;
    swatch.dataset.className = theme.className;
    swatch.style.width = "20px";
    swatch.style.height = "20px";
    swatch.style.borderRadius = "4px";
    swatch.style.cursor = "pointer";
    swatch.style.transition = "all 0.2s";
    swatch.style.position = "relative";
    swatch.style.overflow = "hidden";
    swatch.style.boxShadow = "0 0 3px rgba(0, 0, 0, 0.2)";

    // Create a more complex pattern showing all theme colors
    swatch.style.background = `
      linear-gradient(135deg, 
        ${first} 0%, 
        ${first} 30%, 
        ${second} 30%, 
        ${second} 50%, 
        ${third} 50%, 
        ${third} 70%, 
        ${fourth} 70%, 
        ${fourth} 85%,
        ${fifth} 85%,
        ${fifth} 100%)
    `;

    // Add directly to theme selector
    themeSelector.appendChild(swatch);

    // Mark default theme as selected
    if (theme.name === "default") {
      swatch.style.border = "2px solid var(--color-text-primary)";
      swatch.style.boxShadow = "0 0 8px var(--color-text-primary)";
      swatch.style.transform = "scale(1.1)";
    }

    // Theme selection
    swatch.addEventListener("click", () => {
      // Remove selection styling from all swatches
      document.querySelectorAll(".theme-swatch").forEach((s) => {
        s.style.border = "none";
        s.style.boxShadow = "0 0 3px rgba(0, 0, 0, 0.2)";
        s.style.transform = "scale(1)";
      });

      // Add selection styling to clicked swatch
      swatch.style.border = "2px solid var(--color-text-primary)";
      swatch.style.boxShadow = "0 0 8px var(--color-text-primary)";
      swatch.style.transform = "scale(1.1)";

      // Apply the theme
      document.body.className = theme.className;

      // Store the selected theme in localStorage
      localStorage.setItem("hydractrl-theme", theme.name);

      // Get the current opacity value
      const currentOpacity = localStorage.getItem("hydractrl-panel-opacity") || "90";
      const opacityDecimal = Number.parseInt(currentOpacity) / 100;

      // Re-apply the opacity to all panels with the new theme colors
      setTimeout(() => {
        applyPanelOpacity(Number.parseInt(currentOpacity));
      }, 50);
    });
  });

  // Create opacity slider section
  const opacitySection = document.createElement("div");
  opacitySection.style.marginTop = "4px";
  opacitySection.style.display = "flex";
  opacitySection.style.flexDirection = "column";
  opacitySection.style.gap = "2px";

  // Opacity section title
  const opacityTitle = document.createElement("div");
  opacityTitle.style.fontSize = "11px";
  opacityTitle.style.color = "var(--color-text-secondary)";
  opacityTitle.style.fontWeight = "600";
  opacityTitle.style.letterSpacing = "0.08em";
  opacityTitle.textContent = "PANEL OPACITY";

  // Slider container with value display
  const sliderContainer = document.createElement("div");
  sliderContainer.style.display = "flex";
  sliderContainer.style.alignItems = "center";
  sliderContainer.style.gap = "8px";
  sliderContainer.style.width = "100%";

  // Opacity slider
  const opacitySlider = document.createElement("input");
  opacitySlider.type = "range";
  opacitySlider.min = "30";
  opacitySlider.max = "100";
  opacitySlider.step = "5";

  // Load saved opacity or use default
  const savedOpacity = localStorage.getItem("hydractrl-panel-opacity") || "90";
  opacitySlider.value = savedOpacity;
  opacitySlider.style.width = "100%";
  opacitySlider.style.margin = "0";

  // Opacity value display
  const opacityValue = document.createElement("span");
  opacityValue.style.fontSize = "11px";
  opacityValue.style.color = "var(--color-text-primary)";
  opacityValue.style.minWidth = "32px";
  opacityValue.style.textAlign = "right";
  opacityValue.textContent = savedOpacity + "%";

  // Function to apply opacity to all panels
  function applyPanelOpacity(opacity) {
    // Convert opacity to decimal
    const opacityDecimal = opacity / 100;

    // Apply to CSS variables using custom property
    document.documentElement.style.setProperty("--panel-opacity", opacityDecimal);

    // Add or update style element for global panel styling
    let styleEl = document.getElementById("panel-opacity-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "panel-opacity-styles";
      document.head.appendChild(styleEl);
    }

    // Update the CSS rules with !important to override inline styles
    styleEl.textContent = `
      .stats-panel, .editor-container, .slots-panel, .info-panel {
        background-color: rgba(var(--color-bg-secondary-rgb), ${opacityDecimal}) !important;
      }
      .stats-handle, .editor-handle {
        background-color: rgba(var(--color-bg-tertiary-rgb), ${opacityDecimal}) !important;
      }
      .editor-footer {
        background-color: rgba(var(--color-bg-tertiary-rgb), ${opacityDecimal}) !important;
      }
    `;
  }

  // Apply initial opacity
  applyPanelOpacity(Number.parseInt(savedOpacity));

  // Function to update range slider progress visualization
  function updateRangeProgress(slider) {
    const min = Number.parseInt(slider.min);
    const max = Number.parseInt(slider.max);
    const val = Number.parseInt(slider.value);
    const percentage = ((val - min) * 100) / (max - min);
    slider.style.setProperty("--range-progress", `${percentage}%`);
  }

  // Set initial progress visualization
  updateRangeProgress(opacitySlider);

  // Update opacity when slider is changed
  opacitySlider.addEventListener("input", () => {
    const opacity = opacitySlider.value;
    opacityValue.textContent = opacity + "%";

    // Update visual progress
    updateRangeProgress(opacitySlider);

    // Apply the opacity
    applyPanelOpacity(Number.parseInt(opacity));

    // Save to localStorage
    localStorage.setItem("hydractrl-panel-opacity", opacity);
  });

  // Add elements to slider container
  sliderContainer.appendChild(opacitySlider);
  sliderContainer.appendChild(opacityValue);

  // Add elements to opacity section
  opacitySection.appendChild(opacityTitle);
  opacitySection.appendChild(sliderContainer);

  // Add elements to theme section
  themeSection.appendChild(themeTitle);
  themeSection.appendChild(themeSelector);
  themeSection.appendChild(opacitySection);

  // Create a section for display settings
  const displaySection = document.createElement("div");
  displaySection.className = "stats-display";
  displaySection.style.marginTop = "6px";
  displaySection.style.paddingTop = "6px";
  displaySection.style.borderTop = "1px solid var(--color-bg-tertiary)";
  displaySection.style.display = "none"; // Initially hidden
  displaySection.style.flexDirection = "column";
  displaySection.style.gap = "4px";

  // Create slots settings section
  const slotsSection = document.createElement("div");
  slotsSection.className = "stats-slots";
  slotsSection.style.marginTop = "6px";
  slotsSection.style.paddingTop = "6px";
  slotsSection.style.borderTop = "1px solid var(--color-bg-tertiary)";
  slotsSection.style.display = "none"; // Initially hidden
  slotsSection.style.flexDirection = "column";
  slotsSection.style.gap = "4px";

  // Slots section title
  const slotsTitle = document.createElement("div");
  slotsTitle.className = "slots-settings-title";
  slotsTitle.style.fontSize = "11px";
  slotsTitle.style.color = "var(--color-text-secondary)";
  slotsTitle.style.fontWeight = "600";
  slotsTitle.style.letterSpacing = "0.08em";
  slotsTitle.textContent = "SLOTS";

  // Create move to next slot option
  const moveToNextSlotOption = document.createElement("div");
  moveToNextSlotOption.style.display = "flex";
  moveToNextSlotOption.style.alignItems = "center";
  moveToNextSlotOption.style.gap = "8px";
  moveToNextSlotOption.style.marginTop = "2px";

  // Checkbox for move to next slot
  const moveToNextSlotCheckbox = document.createElement("input");
  moveToNextSlotCheckbox.type = "checkbox";
  moveToNextSlotCheckbox.id = "move-to-next-slot";
  moveToNextSlotCheckbox.checked = false; // Default to not checked
  moveToNextSlotCheckbox.style.cursor = "pointer";

  // Label for move to next slot checkbox
  const moveToNextSlotLabel = document.createElement("label");
  moveToNextSlotLabel.htmlFor = "move-to-next-slot";
  moveToNextSlotLabel.textContent = "Move to next slot on save";
  moveToNextSlotLabel.style.fontSize = "11px";
  moveToNextSlotLabel.style.color = "var(--color-text-primary)";
  moveToNextSlotLabel.style.cursor = "pointer";

  // Add checkbox and label to option container
  moveToNextSlotOption.appendChild(moveToNextSlotCheckbox);
  moveToNextSlotOption.appendChild(moveToNextSlotLabel);

  // Add elements to slots section
  slotsSection.appendChild(slotsTitle);
  slotsSection.appendChild(moveToNextSlotOption);

  // Display section title
  const displayTitle = document.createElement("div");
  displayTitle.className = "display-title";
  displayTitle.style.fontSize = "11px";
  displayTitle.style.color = "var(--color-text-secondary)";
  displayTitle.style.fontWeight = "600";
  displayTitle.style.letterSpacing = "0.08em";
  displayTitle.textContent = "BREAKOUT WINDOW";

  // Window size dropdown and the open/close button, on one row
  const breakoutRow = document.createElement("div");
  breakoutRow.style.display = "flex";
  breakoutRow.style.gap = "4px";

  const sizeSelect = document.createElement("select");
  sizeSelect.className = "breakout-size";
  sizeSelect.title = "Breakout window size";
  sizeSelect.style.flex = "1";
  sizeSelect.style.minWidth = "0";

  // Common sizes, as "WIDTHxHEIGHT" values (the BreakoutPlugin reads them)
  const sizes = [
    { label: "nHD (640×360)", width: 640, height: 360 },
    { label: "qHD (960×540)", width: 960, height: 540 },
    { label: "HD (1280×720)", width: 1280, height: 720 },
    { label: "FHD (1920×1080)", width: 1920, height: 1080 },
    { label: "2K (2048×1080)", width: 2048, height: 1080 },
    { label: "Square (1080×1080)", width: 1080, height: 1080 },
  ];

  sizes.forEach((size) => {
    const option = document.createElement("option");
    option.value = `${size.width}x${size.height}`;
    option.textContent = size.label;
    sizeSelect.appendChild(option);
  });
  sizeSelect.value = "1280x720";

  // Breakout button
  const breakoutButton = document.createElement("button");
  breakoutButton.textContent = "Open";
  breakoutButton.style.fontSize = "11px";
  breakoutButton.style.padding = "2px 10px";
  breakoutButton.title = "Open the visuals in a new window at this size";

  breakoutRow.appendChild(sizeSelect);
  breakoutRow.appendChild(breakoutButton);

  // Add elements to display section
  displaySection.appendChild(displayTitle);
  displaySection.appendChild(breakoutRow);

  // Create the FPS metric
  const fpsMetric = document.createElement("div");
  fpsMetric.className = "stats-metric";
  fpsMetric.style.display = "flex";
  fpsMetric.style.justifyContent = "space-between";
  fpsMetric.style.gap = "12px";
  fpsMetric.style.alignItems = "center";

  // FPS Label
  const fpsLabel = document.createElement("span");
  fpsLabel.className = "stats-label";
  fpsLabel.style.fontSize = "11px";
  fpsLabel.style.fontWeight = "600";
  fpsLabel.style.color = "var(--color-text-secondary)";
  fpsLabel.style.whiteSpace = "nowrap";
  fpsLabel.textContent = "FPS:";

  // FPS Value
  const fpsValue = document.createElement("span");
  fpsValue.className = "stats-value";
  fpsValue.style.fontSize = "12px";
  fpsValue.style.fontWeight = "600";
  fpsValue.style.color = "var(--color-stat-value, white)";
  fpsValue.textContent = "0";

  // Detailed metrics
  const details = document.createElement("div");
  details.className = "stats-details";
  details.style.marginTop = "6px";
  details.style.paddingTop = "6px";
  details.style.borderTop = "1px solid var(--color-bg-tertiary)";
  details.style.display = "none";
  details.style.flexDirection = "column";
  details.style.gap = "2px";

  // Add metrics for avg FPS
  const avgFpsMetric = document.createElement("div");
  avgFpsMetric.className = "stats-metric";
  avgFpsMetric.style.display = "flex";
  avgFpsMetric.style.justifyContent = "space-between";
  avgFpsMetric.style.gap = "12px";
  avgFpsMetric.style.alignItems = "center";

  const avgFpsLabel = document.createElement("span");
  avgFpsLabel.className = "stats-label";
  avgFpsLabel.style.fontSize = "11px";
  avgFpsLabel.style.fontWeight = "600";
  avgFpsLabel.style.color = "var(--color-text-secondary)";
  avgFpsLabel.textContent = "AVG FPS:";

  const avgFpsValue = document.createElement("span");
  avgFpsValue.className = "stats-value";
  avgFpsValue.style.fontSize = "12px";
  avgFpsValue.style.fontWeight = "600";
  avgFpsValue.style.color = "var(--color-stat-value, white)";
  avgFpsValue.textContent = "0";

  // Add metrics for frame count
  const frameCountMetric = document.createElement("div");
  frameCountMetric.className = "stats-metric";
  frameCountMetric.style.display = "flex";
  frameCountMetric.style.justifyContent = "space-between";
  frameCountMetric.style.gap = "12px";
  frameCountMetric.style.alignItems = "center";

  const frameCountLabel = document.createElement("span");
  frameCountLabel.className = "stats-label";
  frameCountLabel.style.fontSize = "11px";
  frameCountLabel.style.fontWeight = "600";
  frameCountLabel.style.color = "var(--color-text-secondary)";
  frameCountLabel.textContent = "FRAMES:";

  const frameCountValue = document.createElement("span");
  frameCountValue.className = "stats-value";
  frameCountValue.style.fontSize = "12px";
  frameCountValue.style.fontWeight = "600";
  frameCountValue.style.color = "var(--color-stat-value, white)";
  frameCountValue.textContent = "0";

  // Assemble the panel
  fpsMetric.appendChild(fpsLabel);
  fpsMetric.appendChild(fpsValue);

  avgFpsMetric.appendChild(avgFpsLabel);
  avgFpsMetric.appendChild(avgFpsValue);

  frameCountMetric.appendChild(frameCountLabel);
  frameCountMetric.appendChild(frameCountValue);

  metrics.appendChild(fpsMetric);

  details.appendChild(avgFpsMetric);
  details.appendChild(frameCountMetric);

  // Create footer section with attribution
  const footerSection = document.createElement("div");
  footerSection.className = "stats-footer";
  footerSection.style.marginTop = "6px";
  footerSection.style.paddingTop = "6px";
  footerSection.style.borderTop = "1px solid var(--color-bg-tertiary)";
  footerSection.style.display = "flex";
  footerSection.style.justifyContent = "space-between";
  footerSection.style.alignItems = "center";
  footerSection.style.fontSize = "10px";
  footerSection.style.color = "var(--color-text-secondary)";

  // Attribution text with links
  const attributionText = document.createElement("div");
  attributionText.innerHTML =
    'made with <span style="color:var(--color-accent-primary);">♥</span> by <a href="https://d17e.dev" target="_blank" style="color:inherit;text-decoration:underline">D17E</a><br>based on <a href="https://hydra.ojack.xyz" target="_blank" style="color:inherit;text-decoration:underline">hydra</a> by <a href="https://www.ojack.xyz" target="_blank" style="color:inherit;text-decoration:underline">Olivia Jack</a>';
  attributionText.style.lineHeight = "1.5";

  // Info icon button
  const infoButton = document.createElement("button");
  infoButton.innerHTML =
    "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24'><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><g fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'><path d='M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z'/><path d='M12 16v-5h-.5m0 5h1M12 8.5V8'/></g></svg>";
  infoButton.style.background = "none";
  infoButton.style.width = "22px";
  infoButton.style.height = "22px";
  infoButton.style.border = "none";
  infoButton.style.cursor = "pointer";
  infoButton.style.fontSize = "12px";
  infoButton.style.padding = "0";
  infoButton.style.display = "flex";
  infoButton.style.alignItems = "center";
  infoButton.style.justifyContent = "center";
  infoButton.title = "Show application information and shortcuts";

  // Add click event to show info panel
  infoButton.addEventListener("click", (e) => {
    e.stopPropagation(); // Stop event from bubbling up to document

    // Check if info panel is already visible
    const existingPanel = document.getElementById("info-panel");
    if (existingPanel && existingPanel.style.display !== "none") {
      return; // Don't show panel if it's already visible
    }

    if (window.showInfoPanel) {
      window.showInfoPanel();
    } else {
      window.open("https://hydractrl.d17e.dev/", "_blank");
    }
  });

  // Also keep the press from reaching the info panel's outside-click handler
  infoButton.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });

  // Feedback button: opens the feedback panel (FeedbackPlugin), or the form
  // itself if that plugin isn't running
  const feedbackButton = document.createElement("button");
  feedbackButton.className = "feedback-button";
  feedbackButton.innerHTML =
    "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24'><g fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'><path d='M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H12l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4z'/><path d='M8 8.5h8M8 11.5h5'/></g></svg>";
  feedbackButton.style.background = "none";
  feedbackButton.style.width = "22px";
  feedbackButton.style.height = "22px";
  feedbackButton.style.border = "none";
  feedbackButton.style.padding = "0";
  feedbackButton.style.display = "flex";
  feedbackButton.style.alignItems = "center";
  feedbackButton.style.justifyContent = "center";
  feedbackButton.title = "Send feedback";
  feedbackButton.addEventListener("click", () => {
    if (window.showFeedbackPanel) window.showFeedbackPanel();
    else window.open(`https://tally.so/r/${FEEDBACK_FORM_ID}?source=app`, "_blank", "noopener");
  });

  const footerButtons = document.createElement("div");
  footerButtons.style.display = "flex";
  footerButtons.style.gap = "2px";
  footerButtons.appendChild(feedbackButton);
  footerButtons.appendChild(infoButton);

  // Add elements to footer
  footerSection.appendChild(attributionText);
  footerSection.appendChild(footerButtons);

  content.appendChild(metrics);
  content.appendChild(details);
  content.appendChild(themeSection);
  content.appendChild(midiSection);
  if (breakout) content.appendChild(displaySection);
  content.appendChild(slotsSection);
  content.appendChild(footerSection);

  // Add buttons to container
  buttonsContainer.appendChild(docsButton);
  buttonsContainer.appendChild(toggle);

  handle.appendChild(title);
  handle.appendChild(buttonsContainer);

  panel.appendChild(handle);
  panel.appendChild(content);

  // Add to document
  document.body.appendChild(panel);

  // Apply saved theme
  if (savedTheme !== "default") {
    const themeClassMap = {
      light: "theme-light",
      dark: "theme-dark",
      "neon-eighties": "theme-neon-eighties",
      "nineties-pop": "theme-nineties-pop",
    };
    document.body.className = themeClassMap[savedTheme] || "";

    // Update the visual selection for the theme swatches
    setTimeout(() => {
      document.querySelectorAll(".theme-swatch").forEach((swatch) => {
        if (swatch.dataset.theme === savedTheme) {
          swatch.style.border = "2px solid var(--color-text-primary)";
          swatch.style.boxShadow = "0 0 8px var(--color-text-primary)";
          swatch.style.transform = "scale(1.1)";
        } else {
          swatch.style.border = "none";
          swatch.style.boxShadow = "0 0 3px rgba(0, 0, 0, 0.2)";
          swatch.style.transform = "scale(1)";
        }
      });
    }, 100);
  }

  // Add window resize event listener to ensure panel stays on screen
  window.addEventListener("resize", () => {
    // Get current panel position
    const left = Number.parseInt(panel.style.left || "0");
    const top = Number.parseInt(panel.style.top || "0");

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

  // Set up toggle
  let isExpanded = false;
  toggle.addEventListener("click", () => {
    isExpanded = !isExpanded;
    details.style.display = isExpanded ? "flex" : "none";
    themeSection.style.display = isExpanded ? "flex" : "none";
    midiSection.style.display = isExpanded ? "flex" : "none";
    displaySection.style.display = isExpanded ? "flex" : "none";
    slotsSection.style.display = isExpanded ? "flex" : "none";
    toggle.textContent = isExpanded ? "▼" : "▲";
  });

  // Make draggable with position persistence
  makeDraggable(panel, handle, "stats-panel");

  // Set up performance monitoring
  let frameCount = 0;
  let fps = 0;
  let avgFps = 0;
  let totalFrameTime = 0;
  let lastTime = performance.now();
  let lastUpdateTime = 0;
  // Get update interval from performance settings or use default
  const updateInterval = window.hydraPerformanceSettings?.statsUpdateInterval || 500;
  let frameTimeSum = 0;
  let frameTimeSamples = 0;

  function updateStats(timestamp) {
    // Calculate frame time and FPS
    const now = performance.now();
    const frameTime = now - lastTime;
    const currentFps = frameTime > 0 ? 1000 / frameTime : 0;

    // Accumulate frame time data
    frameTimeSum += frameTime;
    frameTimeSamples++;

    // Only update display at the specified interval to reduce overhead
    if (now - lastUpdateTime >= updateInterval) {
      // Calculate average FPS since last update
      const avgCurrentFps = frameTimeSamples > 0 ? 1000 / (frameTimeSum / frameTimeSamples) : 0;

      // Update running total stats
      frameCount += frameTimeSamples;
      totalFrameTime += frameTimeSum;
      avgFps = totalFrameTime > 0 ? 1000 / (totalFrameTime / frameCount) : 0;

      // Update display with the average since last update
      fps = Math.round(avgCurrentFps);

      // Update UI
      fpsValue.textContent = fps.toString();
      // Whole numbers only, so the panel keeps its width as the rate wobbles
      avgFpsValue.textContent = Math.round(avgFps).toString();
      frameCountValue.textContent = frameCount.toString();

      // Update color based on FPS
      if (fps > 50) {
        fpsValue.style.color = "var(--color-perf-good)";
      } else if (fps > 30) {
        fpsValue.style.color = "var(--color-perf-medium)";
      } else {
        fpsValue.style.color = "var(--color-perf-poor)";
      }

      // Reset accumulators
      frameTimeSum = 0;
      frameTimeSamples = 0;
      lastUpdateTime = now;
    }

    // Save current time for next frame's calculation
    lastTime = now;

    // Request next frame
    requestAnimationFrame(updateStats);
  }

  // Start update loop
  lastUpdateTime = performance.now();
  requestAnimationFrame(updateStats);

  // Return the panel with additional API
  return {
    panel,
    theme: {
      section: themeSection,
      selector: themeSelector,
    },
    midi: midi
      ? {
          statusText: midiStatusText,
          deviceContainer: midiDeviceContainer,
          section: midiSection,
        }
      : undefined,
    display: breakout
      ? {
          section: displaySection,
          breakoutButton: breakoutButton,
          sizeSelect: sizeSelect,
        }
      : undefined,
    slots: {
      section: slotsSection,
      moveToNextSlotCheckbox: moveToNextSlotCheckbox,
    },
    docsButton, // Expose docs button for external access
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
      const rightOffset = Number.parseInt(element.style.right || "0");
      currentX = window.innerWidth - rect.width - rightOffset;
      currentY = Number.parseInt(element.style.top || "0");

      // Set explicit left position based on current right position
      element.style.left = currentX + "px";

      // Remove right positioning to prevent conflicts
      element.style.right = "";
    } else {
      // Already positioned by left/top (from saved position or default)
      currentX = Number.parseInt(element.style.left || "0");
      currentY = Number.parseInt(element.style.top || "0");
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

  // Pointer down handler (mouse, finger or pen)
  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();

    // Critical: Remove right positioning before starting drag
    if (element.style.right) {
      element.style.right = "";
    }

    // Calculate initial pointer position
    initialX = e.clientX;
    initialY = e.clientY;

    // Get current element position from inline style
    // This fixes the initial jump by using the stored position
    currentX = Number.parseInt(element.style.left || "0");
    currentY = Number.parseInt(element.style.top || "0");

    // Start dragging
    isDragging = true;
    element.classList.add("dragging");
  }

  // Pointer move handler
  function onPointerMove(e) {
    if (!isDragging) return;

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

  // Pointer up handler
  function onPointerUp() {
    if (!isDragging) return;

    // Update current position with final offsets
    currentX = Number.parseInt(element.style.left || "0");
    currentY = Number.parseInt(element.style.top || "0");

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
  }

  trackPointerDrag(handle, { start: onPointerDown, move: onPointerMove, end: onPointerUp });
}
