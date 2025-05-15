/**
 * Simple Stats Panel
 * A minimal, draggable FPS counter that doesn't rely on complex component architecture
 */
import { loadPanelPosition, savePanelPosition } from "./utils/PanelStorage.js";

export function createStatsPanel() {
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

  panel.style.backgroundColor = "var(--color-bg-secondary)";
  panel.style.borderRadius = "8px";
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
  handle.style.backgroundColor = "var(--color-bg-tertiary)";
  handle.style.display = "flex";
  handle.style.justifyContent = "space-between";
  handle.style.alignItems = "center";
  handle.style.padding = "0 8px";
  handle.style.cursor = "move";
  handle.style.userSelect = "none";

  // Create the title
  const title = document.createElement("div");
  title.className = "stats-title";
  title.style.fontSize = "12px";
  title.style.fontWeight = "bold";
  title.style.textTransform = "uppercase";
  title.style.color = "var(--color-text-secondary)";
  title.textContent = "SYSTEM";

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
  content.style.padding = "8px";

  // Create the metrics container
  const metrics = document.createElement("div");
  metrics.className = "stats-metrics";
  metrics.style.display = "flex";
  metrics.style.gap = "12px";

  // MIDI section for expanded view
  const midiSection = document.createElement("div");
  midiSection.className = "stats-midi";
  midiSection.style.marginTop = "8px";
  midiSection.style.paddingTop = "8px";
  midiSection.style.borderTop = "1px solid var(--color-bg-tertiary)";
  midiSection.style.display = "none"; // Initially hidden
  midiSection.style.flexDirection = "column";
  midiSection.style.gap = "6px";

  // MIDI status text
  const midiStatusText = document.createElement("div");
  midiStatusText.className = "midi-status-text";
  midiStatusText.style.fontSize = "12px";
  midiStatusText.style.color = "var(--color-text-secondary)";
  midiStatusText.style.fontWeight = "bold";
  midiStatusText.textContent = "MIDI: Not initialized";

  // MIDI device selection
  const midiDeviceContainer = document.createElement("div");
  midiDeviceContainer.style.display = "flex";
  midiDeviceContainer.style.flexDirection = "column";
  midiDeviceContainer.style.gap = "4px";

  // Add to MIDI section
  midiSection.appendChild(midiStatusText);
  midiSection.appendChild(midiDeviceContainer);

  // Create a theme settings section
  const themeSection = document.createElement("div");
  themeSection.className = "stats-theme";
  themeSection.style.marginTop = "8px";
  themeSection.style.paddingTop = "8px";
  themeSection.style.borderTop = "1px solid var(--color-bg-tertiary)";
  themeSection.style.display = "none"; // Initially hidden
  themeSection.style.flexDirection = "column";
  themeSection.style.gap = "6px";

  // Theme section title
  const themeTitle = document.createElement("div");
  themeTitle.className = "theme-title";
  themeTitle.style.fontSize = "12px";
  themeTitle.style.color = "var(--color-text-secondary)";
  themeTitle.style.fontWeight = "bold";
  themeTitle.textContent = "THEME";

  // Theme selector container
  const themeSelector = document.createElement("div");
  themeSelector.style.display = "flex";
  themeSelector.style.flexWrap = "wrap";
  themeSelector.style.gap = "8px";
  themeSelector.style.marginTop = "4px";

  // Define themes
  const themes = [
    { name: "default", label: "Default", color: "#1e1e1e", className: "" },
    { name: "light", label: "Light", color: "#f5f5f5", className: "theme-light" },
    { name: "dark", label: "Dark", color: "#121212", className: "theme-dark" },
    {
      name: "neon-eighties",
      label: "Neon 80s",
      color: "#0b0b2b",
      className: "theme-neon-eighties",
    },
    { name: "nineties-pop", label: "Pop 90s", color: "#ffc0cb", className: "theme-nineties-pop" },
  ];

  // Create theme swatches
  themes.forEach((theme) => {
    const swatch = document.createElement("div");
    swatch.className = "theme-swatch";
    swatch.title = theme.label;
    swatch.dataset.theme = theme.name;
    swatch.dataset.className = theme.className;
    swatch.style.width = "36px";
    swatch.style.height = "36px";
    swatch.style.backgroundColor = theme.color;
    swatch.style.border = "2px solid transparent";
    swatch.style.borderRadius = "4px";
    swatch.style.cursor = "pointer";
    swatch.style.transition = "all 0.2s";
    swatch.style.position = "relative";

    // Add label below swatch
    const label = document.createElement("div");
    label.textContent = theme.label;
    label.style.fontSize = "10px";
    label.style.color = "var(--color-text-secondary)";
    label.style.textAlign = "center";
    label.style.marginTop = "2px";
    label.style.whiteSpace = "nowrap";

    // Wrap swatch and label
    const swatchContainer = document.createElement("div");
    swatchContainer.style.display = "flex";
    swatchContainer.style.flexDirection = "column";
    swatchContainer.style.alignItems = "center";

    swatchContainer.appendChild(swatch);
    swatchContainer.appendChild(label);
    themeSelector.appendChild(swatchContainer);

    // Mark default theme as selected
    if (theme.name === "default") {
      swatch.style.border = "2px solid var(--color-text-primary)";
      swatch.style.boxShadow = "0 0 5px rgba(255, 255, 255, 0.5)";
    }

    // Theme selection
    swatch.addEventListener("click", () => {
      // Remove selection styling from all swatches
      document.querySelectorAll(".theme-swatch").forEach((s) => {
        s.style.border = "2px solid transparent";
        s.style.boxShadow = "none";
      });

      // Add selection styling to clicked swatch
      swatch.style.border = "2px solid var(--color-text-primary)";
      swatch.style.boxShadow = "0 0 5px rgba(255, 255, 255, 0.5)";

      // Apply the theme
      document.body.className = theme.className;

      // Store the selected theme in localStorage
      localStorage.setItem("hydractrl-theme", theme.name);
    });
  });

  // Add elements to theme section
  themeSection.appendChild(themeTitle);
  themeSection.appendChild(themeSelector);

  // Create a section for display settings
  const displaySection = document.createElement("div");
  displaySection.className = "stats-display";
  displaySection.style.marginTop = "8px";
  displaySection.style.paddingTop = "8px";
  displaySection.style.borderTop = "1px solid var(--color-bg-tertiary)";
  displaySection.style.display = "none"; // Initially hidden
  displaySection.style.flexDirection = "column";
  displaySection.style.gap = "6px";

  // Create export settings section
  const exportSection = document.createElement("div");
  exportSection.className = "stats-export";
  exportSection.style.marginTop = "8px";
  exportSection.style.paddingTop = "8px";
  exportSection.style.borderTop = "1px solid var(--color-bg-tertiary)";
  exportSection.style.display = "none"; // Initially hidden
  exportSection.style.flexDirection = "column";
  exportSection.style.gap = "6px";

  // Display section title
  const displayTitle = document.createElement("div");
  displayTitle.className = "display-title";
  displayTitle.style.fontSize = "12px";
  displayTitle.style.color = "var(--color-text-secondary)";
  displayTitle.style.fontWeight = "bold";
  displayTitle.textContent = "DISPLAY";

  // Breakout button
  const breakoutButton = document.createElement("button");
  breakoutButton.textContent = "Breakout View";
  breakoutButton.style.fontSize = "10px";
  breakoutButton.style.padding = "2px 4px";
  breakoutButton.style.margin = "4px 0";
  breakoutButton.style.width = "fit-content";
  breakoutButton.title = "Open visualization in a new window";

  // Size selection container
  const sizeSelectionContainer = document.createElement("div");
  sizeSelectionContainer.style.marginTop = "4px";
  sizeSelectionContainer.style.display = "flex";
  sizeSelectionContainer.style.flexDirection = "column";
  sizeSelectionContainer.style.gap = "4px";

  // Size options
  const sizeLabel = document.createElement("div");
  sizeLabel.style.fontSize = "10px";
  sizeLabel.style.color = "var(--color-text-secondary)";
  sizeLabel.textContent = "Select Size:";

  // Size buttons container
  const sizeButtonsContainer = document.createElement("div");
  sizeButtonsContainer.style.display = "flex";
  sizeButtonsContainer.style.flexDirection = "column";
  sizeButtonsContainer.style.flexWrap = "wrap";
  sizeButtonsContainer.style.gap = "4px";

  // Common sizes
  const sizes = [
    { label: "nHD (640×360)", width: 640, height: 360 },
    { label: "qHD (960×540)", width: 960, height: 540 },
    { label: "HD (1280×720)", width: 1280, height: 720 },
    { label: "FHD (1920×1080)", width: 1920, height: 1080 },
    { label: "2K (2048×1080)", width: 2048, height: 1080 },
    { label: "Square (1080×1080)", width: 1080, height: 1080 },
  ];

  // Selected size indicator and variable to track selection
  const selectedSizeIndicator = document.createElement("div");
  selectedSizeIndicator.style.fontSize = "10px";
  selectedSizeIndicator.style.color = "var(--color-perf-good)";
  selectedSizeIndicator.style.marginTop = "2px";
  selectedSizeIndicator.style.fontWeight = "bold";
  selectedSizeIndicator.textContent = "No size selected";

  // Create a variable to track the selected size
  let selectedSize = null;

  sizes.forEach((size) => {
    const sizeButton = document.createElement("button");
    sizeButton.textContent = size.label;
    sizeButton.style.fontSize = "10px";
    sizeButton.style.padding = "1px 3px";
    sizeButton.style.margin = "2px";
    sizeButton.dataset.width = size.width;
    sizeButton.dataset.height = size.height;
    sizeButton.dataset.label = size.label;

    sizeButtonsContainer.appendChild(sizeButton);
  });

  // Initially disable breakout button until size is selected
  breakoutButton.disabled = true;
  breakoutButton.style.opacity = "0.5";
  breakoutButton.title = "Select a size first";

  // Add elements to size selection container
  sizeSelectionContainer.appendChild(sizeLabel);
  sizeSelectionContainer.appendChild(sizeButtonsContainer);
  sizeSelectionContainer.appendChild(selectedSizeIndicator);

  // Add elements to display section
  displaySection.appendChild(displayTitle);
  displaySection.appendChild(sizeSelectionContainer);
  displaySection.appendChild(breakoutButton);

  // Export section title
  const exportTitle = document.createElement("div");
  exportTitle.className = "export-title";
  exportTitle.style.fontSize = "12px";
  exportTitle.style.color = "var(--color-text-secondary)";
  exportTitle.style.fontWeight = "bold";
  exportTitle.textContent = "EXPORT";

  // Create thumbnail export option
  const thumbnailOption = document.createElement("div");
  thumbnailOption.style.display = "flex";
  thumbnailOption.style.alignItems = "center";
  thumbnailOption.style.gap = "8px";
  thumbnailOption.style.marginTop = "4px";

  // Checkbox for thumbnail inclusion
  const thumbnailCheckbox = document.createElement("input");
  thumbnailCheckbox.type = "checkbox";
  thumbnailCheckbox.id = "include-thumbnails";
  thumbnailCheckbox.checked = true; // Default to including thumbnails
  thumbnailCheckbox.style.cursor = "pointer";

  // Label for thumbnail checkbox
  const thumbnailLabel = document.createElement("label");
  thumbnailLabel.htmlFor = "include-thumbnails";
  thumbnailLabel.textContent = "Include thumbnails in exports";
  thumbnailLabel.style.fontSize = "11px";
  thumbnailLabel.style.color = "var(--color-text-primary)";
  thumbnailLabel.style.cursor = "pointer";

  // Add checkbox and label to option container
  thumbnailOption.appendChild(thumbnailCheckbox);
  thumbnailOption.appendChild(thumbnailLabel);

  // Add elements to export section
  exportSection.appendChild(exportTitle);
  exportSection.appendChild(thumbnailOption);

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
  fpsLabel.style.fontSize = "12px";
  fpsLabel.style.fontWeight = "bold";
  fpsLabel.style.color = "var(--color-text-secondary)";
  fpsLabel.style.whiteSpace = "nowrap";
  fpsLabel.textContent = "FPS:";

  // FPS Value
  const fpsValue = document.createElement("span");
  fpsValue.className = "stats-value";
  fpsValue.style.fontFamily = "monospace";
  fpsValue.style.fontSize = "12px";
  fpsValue.style.fontWeight = "bold";
  fpsValue.style.color = "white";
  fpsValue.textContent = "0";

  // Detailed metrics
  const details = document.createElement("div");
  details.className = "stats-details";
  details.style.marginTop = "8px";
  details.style.paddingTop = "8px";
  details.style.borderTop = "1px solid var(--color-bg-tertiary)";
  details.style.display = "none";
  details.style.flexDirection = "column";
  details.style.gap = "6px";

  // Add metrics for avg FPS
  const avgFpsMetric = document.createElement("div");
  avgFpsMetric.className = "stats-metric";
  avgFpsMetric.style.display = "flex";
  avgFpsMetric.style.justifyContent = "space-between";
  avgFpsMetric.style.gap = "12px";
  avgFpsMetric.style.alignItems = "center";

  const avgFpsLabel = document.createElement("span");
  avgFpsLabel.className = "stats-label";
  avgFpsLabel.style.fontSize = "12px";
  avgFpsLabel.style.fontWeight = "bold";
  avgFpsLabel.style.color = "var(--color-text-secondary)";
  avgFpsLabel.textContent = "AVG FPS:";

  const avgFpsValue = document.createElement("span");
  avgFpsValue.className = "stats-value";
  avgFpsValue.style.fontFamily = "monospace";
  avgFpsValue.style.fontSize = "12px";
  avgFpsValue.style.fontWeight = "bold";
  avgFpsValue.style.color = "white";
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
  frameCountLabel.style.fontSize = "12px";
  frameCountLabel.style.fontWeight = "bold";
  frameCountLabel.style.color = "var(--color-text-secondary)";
  frameCountLabel.textContent = "FRAMES:";

  const frameCountValue = document.createElement("span");
  frameCountValue.className = "stats-value";
  frameCountValue.style.fontFamily = "monospace";
  frameCountValue.style.fontSize = "12px";
  frameCountValue.style.fontWeight = "bold";
  frameCountValue.style.color = "white";
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

  content.appendChild(metrics);
  content.appendChild(details);
  content.appendChild(themeSection);
  content.appendChild(midiSection);
  content.appendChild(displaySection);
  content.appendChild(exportSection);

  handle.appendChild(title);
  handle.appendChild(toggle);

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
          swatch.style.boxShadow = "0 0 5px rgba(255, 255, 255, 0.5)";
        } else {
          swatch.style.border = "2px solid transparent";
          swatch.style.boxShadow = "none";
        }
      });
    }, 100);
  }

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

  // Set up toggle
  let isExpanded = false;
  toggle.addEventListener("click", () => {
    isExpanded = !isExpanded;
    details.style.display = isExpanded ? "flex" : "none";
    themeSection.style.display = isExpanded ? "flex" : "none";
    midiSection.style.display = isExpanded ? "flex" : "none";
    displaySection.style.display = isExpanded ? "flex" : "none";
    exportSection.style.display = isExpanded ? "flex" : "none";
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

  function updateStats() {
    const now = performance.now();
    const frameTime = now - lastTime;
    const currentFps = frameTime > 0 ? 1000 / frameTime : 0;

    // Update running average
    frameCount++;
    totalFrameTime += frameTime;
    avgFps = totalFrameTime > 0 ? 1000 / (totalFrameTime / frameCount) : 0;

    // Update display
    fps = Math.round(currentFps);
    lastTime = now;

    // Update UI
    fpsValue.textContent = fps.toString();
    avgFpsValue.textContent = Math.round(avgFps * 10) / 10;
    frameCountValue.textContent = frameCount.toString();

    // Update color based on FPS
    if (fps > 50) {
      fpsValue.style.color = "var(--color-perf-good)";
    } else if (fps > 30) {
      fpsValue.style.color = "var(--color-perf-medium)";
    } else {
      fpsValue.style.color = "var(--color-perf-poor)";
    }

    // Request next frame
    requestAnimationFrame(updateStats);
  }

  // Start update loop
  requestAnimationFrame(updateStats);

  // Return the panel with additional API
  return {
    panel,
    theme: {
      section: themeSection,
      selector: themeSelector,
    },
    midi: {
      statusText: midiStatusText,
      deviceContainer: midiDeviceContainer,
      section: midiSection,
    },
    display: {
      section: displaySection,
      breakoutButton: breakoutButton,
      sizeSelectionContainer: sizeSelectionContainer,
      sizeButtons: Array.from(sizeButtonsContainer.querySelectorAll("button")),
      selectedSizeIndicator: selectedSizeIndicator,
      selectedSize: selectedSize,
    },
    export: {
      section: exportSection,
      thumbnailCheckbox: thumbnailCheckbox,
    },
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
      currentY = parseInt(element.style.top || "0");

      // Set explicit left position based on current right position
      element.style.left = currentX + "px";

      // Remove right positioning to prevent conflicts
      element.style.right = "";
    } else {
      // Already positioned by left/top (from saved position or default)
      currentX = parseInt(element.style.left || "0");
      currentY = parseInt(element.style.top || "0");
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
    // This fixes the initial jump by using the stored position
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
