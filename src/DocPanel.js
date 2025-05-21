/**
 * Documentation Panel Component
 * A draggable panel with Hydra function reference
 */
import { loadPanelPosition, savePanelPosition } from "./utils/PanelStorage.js";

// Hydra function categories with their color codes (matching hydra.ojack.xyz)
const FUNCTION_CATEGORIES = {
  sources: {
    title: "Sources",
    color: "#FF5500",
    functions: ["noise", "voronoi", "osc", "shape", "gradient", "solid", "src"]
  },
  color: {
    title: "Color",
    color: "#FFFF00",
    functions: ["brightness", "contrast", "color", "colorama", "invert", "luma", "posterize", "saturate", "thresh", "hue"]
  },
  geometry: {
    title: "Geometry",
    color: "#00FFFF",
    functions: ["kaleid", "pixelate", "repeat", "repeatX", "repeatY", "rotate", "scale", "scrollX", "scrollY", "stretch"]
  },
  blend: {
    title: "Blend",
    color: "#FF00FF",
    functions: ["add", "blend", "diff", "layer", "mask", "mult", "sub"]
  },
  modulate: {
    title: "Modulate",
    color: "#00FF00",
    functions: ["modulate", "modulateHue", "modulateKaleid", "modulatePixelate", "modulateRepeat", "modulateRepeatX", "modulateRepeatY", "modulateRotate", "modulateScale", "modulateScrollX", "modulateScrollY", "modulateStretch"]
  },
  settings: {
    title: "Settings",
    color: "#FFFFFF",
    functions: ["setResolution", "setClear", "setBins", "setSmooth", "setScale", "update", "render", "hush"]
  },
  array: {
    title: "Array",
    color: "#FF0000",
    functions: ["array"]
  },
  audio: {
    title: "Audio",
    color: "#0000FF",
    functions: ["a.fft", "a.setBins", "a.setCutoff", "a.setScale", "a.setSmooth", "a.show"]
  },
  external: {
    title: "External",
    color: "#FFAA00",
    functions: ["initCam", "initImage", "initVideo", "initStream", "initScreen", "s0", "s1", "s2", "s3"]
  }
};

// Hydra function documentation
const FUNCTION_DOCS = {
  // Sources
  noise: {
    description: "Generate Perlin noise",
    example: "noise(scale = 10, offset = 0.1).out()",
    params: [
      { name: "scale", default: "10", description: "Scale of noise" },
      { name: "offset", default: "0.1", description: "Time offset for animation" }
    ]
  },
  voronoi: {
    description: "Generate 2D voronoi cells",
    example: "voronoi(scale = 5, speed = 0.3, blending = 0.3).out()",
    params: [
      { name: "scale", default: "5", description: "Scale of voronoi cells" },
      { name: "speed", default: "0.3", description: "Speed of cell movement" },
      { name: "blending", default: "0.3", description: "Blending amount" }
    ]
  },
  osc: {
    description: "Sine wave oscillator",
    example: "osc(frequency = 60, sync = 0.1, offset = 0).out()",
    params: [
      { name: "frequency", default: "60", description: "Frequency of sine" },
      { name: "sync", default: "0.1", description: "Sync/speed of oscillation" },
      { name: "offset", default: "0", description: "Color offset" }
    ]
  },
  shape: {
    description: "Generate a 2D shape",
    example: "shape(sides = 3, radius = 0.3, smoothing = 0.01).out()",
    params: [
      { name: "sides", default: "3", description: "Number of sides" },
      { name: "radius", default: "0.3", description: "Size of shape" },
      { name: "smoothing", default: "0.01", description: "Amount of edge smoothing" }
    ]
  },
  gradient: {
    description: "Generate a color gradient",
    example: "gradient(speed = 0).out()",
    params: [
      { name: "speed", default: "0", description: "Speed of gradient animation" }
    ]
  },
  solid: {
    description: "Generate a solid color",
    example: "solid(r = 0, g = 0, b = 0, a = 1).out()",
    params: [
      { name: "r", default: "0", description: "Red component (0-1)" },
      { name: "g", default: "0", description: "Green component (0-1)" },
      { name: "b", default: "0", description: "Blue component (0-1)" },
      { name: "a", default: "1", description: "Alpha component (0-1)" }
    ]
  },
  src: {
    description: "Use an input source buffer",
    example: "src(s0).out()",
    params: [
      { name: "source", description: "Source buffer to use (s0, s1, s2, s3, o0, o1, o2, o3)" }
    ]
  },

  // Color
  brightness: {
    description: "Adjust brightness",
    example: "osc().brightness(amount = 0.4).out()",
    params: [
      { name: "amount", default: "0.4", description: "Amount of brightness adjustment" }
    ]
  },
  contrast: {
    description: "Adjust contrast",
    example: "osc().contrast(amount = 1.6).out()",
    params: [
      { name: "amount", default: "1.6", description: "Amount of contrast adjustment" }
    ]
  },
  color: {
    description: "Adjust RGB color channels",
    example: "osc().color(r = 1, g = 1, b = 1).out()",
    params: [
      { name: "r", default: "1", description: "Red adjustment (0-1)" },
      { name: "g", default: "1", description: "Green adjustment (0-1)" },
      { name: "b", default: "1", description: "Blue adjustment (0-1)" }
    ]
  },
  colorama: {
    description: "Shift HSV values",
    example: "osc().colorama(amount = 0.005).out()",
    params: [
      { name: "amount", default: "0.005", description: "Amount of color shift" }
    ]
  },
  invert: {
    description: "Invert colors",
    example: "osc().invert(amount = 1).out()",
    params: [
      { name: "amount", default: "1", description: "Amount of color inversion" }
    ]
  },
  hue: {
    description: "Adjust hue",
    example: "osc().hue(amount = 0.4).out()",
    params: [
      { name: "amount", default: "0.4", description: "Amount of hue adjustment" }
    ]
  },
  saturate: {
    description: "Adjust saturation",
    example: "osc().saturate(amount = 2).out()",
    params: [
      { name: "amount", default: "2", description: "Amount of saturation adjustment" }
    ]
  },

  // Geometry
  kaleid: {
    description: "Kaleidoscope effect",
    example: "osc().kaleid(nSides = 4).out()",
    params: [
      { name: "nSides", default: "4", description: "Number of sides/reflections" }
    ]
  },
  pixelate: {
    description: "Pixelate the image",
    example: "osc().pixelate(pixelX = 20, pixelY = 20).out()",
    params: [
      { name: "pixelX", default: "20", description: "Number of horizontal pixels" },
      { name: "pixelY", default: "20", description: "Number of vertical pixels" }
    ]
  },
  repeat: {
    description: "Repeat image in a grid",
    example: "osc().repeat(repeatX = 3, repeatY = 3, offsetX = 0, offsetY = 0).out()",
    params: [
      { name: "repeatX", default: "3", description: "Number of horizontal repetitions" },
      { name: "repeatY", default: "3", description: "Number of vertical repetitions" },
      { name: "offsetX", default: "0", description: "X offset for repetition" },
      { name: "offsetY", default: "0", description: "Y offset for repetition" }
    ]
  },
  rotate: {
    description: "Rotate image",
    example: "osc().rotate(angle = 10, speed = 0).out()",
    params: [
      { name: "angle", default: "10", description: "Angle of rotation" },
      { name: "speed", default: "0", description: "Speed of rotation" }
    ]
  },
  scale: {
    description: "Scale image",
    example: "osc().scale(amount = 1.5, xMult = 1, yMult = 1).out()",
    params: [
      { name: "amount", default: "1.5", description: "Scale amount" },
      { name: "xMult", default: "1", description: "X scale multiplier" },
      { name: "yMult", default: "1", description: "Y scale multiplier" }
    ]
  },

  // Blend
  add: {
    description: "Add textures",
    example: "osc().add(texture, amount = 1).out()",
    params: [
      { name: "texture", description: "Texture to add" },
      { name: "amount", default: "1", description: "Amount to add" }
    ]
  },
  blend: {
    description: "Blend textures",
    example: "osc().blend(texture, amount = 0.5).out()",
    params: [
      { name: "texture", description: "Texture to blend" },
      { name: "amount", default: "0.5", description: "Amount to blend" }
    ]
  },
  diff: {
    description: "Return absolute difference between textures",
    example: "osc().diff(texture).out()",
    params: [
      { name: "texture", description: "Texture to diff with" }
    ]
  },
  mask: {
    description: "Use one texture as alpha mask for another",
    example: "osc().mask(texture).out()",
    params: [
      { name: "texture", description: "Texture to use as mask" }
    ]
  },
  mult: {
    description: "Multiply textures",
    example: "osc().mult(texture, amount = 1).out()",
    params: [
      { name: "texture", description: "Texture to multiply with" },
      { name: "amount", default: "1", description: "Amount to multiply" }
    ]
  },

  // Modulate
  modulate: {
    description: "Modulate texture coordinates with another source",
    example: "osc().modulate(texture, amount = 0.1).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "amount", default: "0.1", description: "Amount to modulate" }
    ]
  },
  modulateScale: {
    description: "Modulate scale with another source",
    example: "osc().modulateScale(texture, multiple = 1, offset = 1).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "multiple", default: "1", description: "Scaling multiplier" },
      { name: "offset", default: "1", description: "Offset of scaling" }
    ]
  },
  modulatePixelate: {
    description: "Modulate pixelation with another source",
    example: "osc().modulatePixelate(texture, multiple = 10, offset = 3).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "multiple", default: "10", description: "Multiplier for pixelation" },
      { name: "offset", default: "3", description: "Offset for pixelation" }
    ]
  },
  modulateRotate: {
    description: "Modulate rotation with another source",
    example: "osc().modulateRotate(texture, multiple = 1, offset = 0).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "multiple", default: "1", description: "Multiplier for rotation" },
      { name: "offset", default: "0", description: "Offset for rotation" }
    ]
  },
  modulateKaleid: {
    description: "Modulate kaleidoscope effect with another source",
    example: "osc().modulateKaleid(texture, nSides = 4).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "nSides", default: "4", description: "Number of sides/reflections" }
    ]
  },

  // Settings
  out: {
    description: "Render to output buffer",
    example: "osc().out(buffer = o0)",
    params: [
      { name: "buffer", default: "o0", description: "Buffer to output to (o0, o1, o2, o3)" }
    ]
  },
  render: {
    description: "Render all output buffers",
    example: "render(buffer = o0)",
    params: [
      { name: "buffer", default: "o0", description: "Buffer to output to main display (o0, o1, o2, o3)" }
    ]
  },
  hush: {
    description: "Clear all output buffers",
    example: "hush()",
    params: []
  },
  setResolution: {
    description: "Set resolution of output",
    example: "setResolution(width, height)",
    params: [
      { name: "width", description: "Width of output" },
      { name: "height", description: "Height of output" }
    ]
  },
  setBins: {
    description: "Set number of FFT bins",
    example: "setBins(bins = 4)",
    params: [
      { name: "bins", default: "4", description: "Number of FFT bins" }
    ]
  }
};

export function createDocPanel() {
  // Load saved position or use defaults
  const savedPosition = loadPanelPosition("doc-panel");

  // Create the panel container
  const panel = document.createElement("div");
  panel.id = "doc-panel";
  panel.className = "doc-panel";
  panel.style.position = "absolute";
  panel.style.display = "none"; // Hidden by default

  if (savedPosition) {
    panel.style.left = savedPosition.left + "px";
    panel.style.top = savedPosition.top + "px";
    panel.style.width = savedPosition.width ? savedPosition.width + "px" : "350px";
    panel.style.height = savedPosition.height ? savedPosition.height + "px" : "500px";
  } else {
    panel.style.left = "60px";
    panel.style.top = "60px";
    panel.style.width = "350px";
    panel.style.height = "500px";
  }

  panel.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity)) !important";
  panel.style.borderRadius = "8px";
  panel.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
  panel.style.backdropFilter = "blur(var(--color-panel-blur))";
  panel.style.zIndex = "100";
  panel.style.overflow = "hidden";
  panel.style.fontFamily = "sans-serif";
  panel.style.fontSize = "14px";
  panel.style.color = "var(--color-text-primary)";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";

  // Create the handle
  const handle = document.createElement("div");
  handle.className = "doc-handle";
  handle.style.height = "28px";
  handle.style.backgroundColor = "rgba(var(--color-bg-tertiary-rgb), var(--panel-opacity))";
  handle.style.display = "flex";
  handle.style.justifyContent = "space-between";
  handle.style.alignItems = "center";
  handle.style.padding = "0 10px";
  handle.style.cursor = "move";
  handle.style.userSelect = "none";
  handle.style.borderTopLeftRadius = "8px";
  handle.style.borderTopRightRadius = "8px";

  // Create the title container
  const titleContainer = document.createElement("div");
  titleContainer.style.display = "flex";
  titleContainer.style.alignItems = "center";

  // Create the title
  const title = document.createElement("div");
  title.textContent = "Hydra Functions";
  title.style.fontWeight = "bold";
  title.style.fontSize = "14px";

  // Create the close button
  const closeButton = document.createElement("button");
  closeButton.innerHTML = "×";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "20px";
  closeButton.style.color = "var(--color-text-primary)";
  closeButton.style.cursor = "pointer";
  closeButton.style.padding = "0 5px";
  closeButton.title = "Close";
  closeButton.addEventListener("click", () => {
    panel.style.display = "none";
  });

  titleContainer.appendChild(title);
  handle.appendChild(titleContainer);
  handle.appendChild(closeButton);
  panel.appendChild(handle);

  // Create the content container (split into two columns)
  const contentContainer = document.createElement("div");
  contentContainer.style.display = "flex";
  contentContainer.style.flexDirection = "column";
  contentContainer.style.flex = "1";
  contentContainer.style.overflow = "hidden";

  // Create the left sidebar (categories and functions)
  const leftSidebar = document.createElement("div");
  leftSidebar.style.width = "100%"; // Take up more space for functions
  leftSidebar.style.borderRight = "1px solid rgba(var(--color-bg-tertiary-rgb), 0.5)";
  leftSidebar.style.overflow = "auto";
  leftSidebar.style.padding = "10px";

  // Create the right content area (function details)
  const rightContent = document.createElement("div");
  rightContent.style.flex = "1";
  rightContent.style.padding = "10px";
  rightContent.style.height = "20rem";
  rightContent.style.width = "100%";

  // Selected function indicator
  let selectedFunction = null;

  // Function to display simplified function details
  const showFunctionDetails = (funcName) => {
    const funcInfo = FUNCTION_DOCS[funcName];
    if (!funcInfo) {
      rightContent.innerHTML = `<div class="function-not-found">No documentation for '${funcName}'</div>`;
      return;
    }

    // Find the category for this function
    let category = null;
    for (const cat in FUNCTION_CATEGORIES) {
      if (FUNCTION_CATEGORIES[cat].functions.includes(funcName)) {
        category = FUNCTION_CATEGORIES[cat];
        break;
      }
    }

    const categoryColor = category ? category.color : "#FFFFFF";

    // Build the simplified content
    let content = `
      <div class="function-header" style="border-bottom: 1px solid ${categoryColor}4D; margin-bottom: 8px;">
        <h2 style="color: ${categoryColor}; font-size: 16px; margin: 0 0 5px 0">${funcName}()</h2>
      </div>
      <div class="function-description" style="margin-bottom: 10px; font-size: 13px;">
        ${funcInfo.description}
      </div>
    `;

    // Add example section
    if (funcInfo.example) {
      content += `
        <div class="function-example">
          <div style="font-size: 13px; font-weight: bold; margin-bottom: 4px;">Example</div>
          <pre style="background-color: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 0;">${funcInfo.example}</pre>
        </div>
      `;
    }

    rightContent.innerHTML = content;
  };

  // Create function list by categories
  Object.keys(FUNCTION_CATEGORIES).forEach(catKey => {
    const category = FUNCTION_CATEGORIES[catKey];

    // Create category heading
    const categoryHeading = document.createElement("div");
    categoryHeading.style.fontWeight = "bold";
    categoryHeading.style.marginTop = "10px";
    categoryHeading.style.marginBottom = "6px";
    categoryHeading.style.color = category.color;
    categoryHeading.style.borderBottom = `1px solid ${category.color}4D`; // Add 30% opacity border
    categoryHeading.style.paddingBottom = "3px";
    categoryHeading.textContent = category.title;

    leftSidebar.appendChild(categoryHeading);

    // Create function tags container (horizontal flow)
    const functionTagsContainer = document.createElement("div");
    functionTagsContainer.style.display = "flex";
    functionTagsContainer.style.flexWrap = "wrap";
    functionTagsContainer.style.gap = "4px";
    functionTagsContainer.style.padding = "4px 0";

    category.functions.forEach(funcName => {
      // Create tag-like container for each function
      const funcTag = document.createElement("div");
      funcTag.textContent = funcName;
      funcTag.style.backgroundColor = `${category.color}20`; // 12% opacity background
      funcTag.style.color = "var(--color-text-primary)";
      funcTag.style.padding = "3px 6px";
      funcTag.style.borderRadius = "3px";
      funcTag.style.fontSize = "12px";
      funcTag.style.cursor = "pointer";
      funcTag.style.transition = "all 0.15s ease";
      funcTag.style.border = `1px solid ${category.color}30`; // 19% opacity border

      // Hover effects
      funcTag.addEventListener("mouseenter", () => {
        funcTag.style.backgroundColor = `${category.color}40`; // 25% opacity on hover
        funcTag.style.transform = "translateY(-1px)";
        funcTag.style.boxShadow = `0 2px 4px rgba(0,0,0,0.1)`;
      });

      funcTag.addEventListener("mouseleave", () => {
        if (selectedFunction !== funcName) {
          funcTag.style.backgroundColor = `${category.color}20`; // Back to 12% opacity
          funcTag.style.transform = "translateY(0)";
          funcTag.style.boxShadow = "none";
        }
      });

      // Click event to show details
      funcTag.addEventListener("click", () => {
        // Clear previous selection styling
        if (selectedFunction) {
          const tags = functionTagsContainer.querySelectorAll("div");
          tags.forEach(tag => {
            if (tag.textContent === selectedFunction) {
              tag.style.backgroundColor = `${category.color}20`; // Reset background
              tag.style.transform = "translateY(0)";
              tag.style.boxShadow = "none";
              tag.style.fontWeight = "normal";
            }
          });
        }

        // Set new selection
        selectedFunction = funcName;
        funcTag.style.backgroundColor = `${category.color}40`; // 25% opacity for selected
        funcTag.style.fontWeight = "bold";
        funcTag.style.boxShadow = `0 2px 4px rgba(0,0,0,0.15)`;

        // Show function details
        showFunctionDetails(funcName);
      });

      functionTagsContainer.appendChild(funcTag);
    });

    leftSidebar.appendChild(functionTagsContainer);
  });

  // Add initial content to right panel
  rightContent.innerHTML = `
    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: var(--color-text-secondary);">
      <div style="font-size: 36px; margin-bottom: 10px;">📚</div>
      <div>Select a function from in the list below to view its documentation</div>
    </div>
  `;

  // Add columns to the content container
  contentContainer.appendChild(rightContent);
  contentContainer.appendChild(leftSidebar);


  // Add content container to panel
  panel.appendChild(contentContainer);

  // Make panel resizable
  const resizeHandle = document.createElement("div");
  resizeHandle.style.position = "absolute";
  resizeHandle.style.width = "10px";
  resizeHandle.style.height = "10px";
  resizeHandle.style.bottom = "0";
  resizeHandle.style.right = "0";
  resizeHandle.style.cursor = "nwse-resize";
  resizeHandle.style.zIndex = "5";
  panel.appendChild(resizeHandle);

  let isResizing = false;
  let initialX, initialY, initialWidth, initialHeight;

  resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    initialX = e.clientX;
    initialY = e.clientY;
    initialWidth = panel.offsetWidth;
    initialHeight = panel.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const width = initialWidth + (e.clientX - initialX);
    const height = initialHeight + (e.clientY - initialY);

    if (width > 300) panel.style.width = width + "px";
    if (height > 200) panel.style.height = height + "px";

    // Save the new dimensions
    savePanelPosition("doc-panel", {
      left: parseInt(panel.style.left),
      top: parseInt(panel.style.top),
      width: parseInt(panel.style.width),
      height: parseInt(panel.style.height)
    });
  });

  document.addEventListener("mouseup", () => {
    isResizing = false;
  });

  // Add the panel to the document
  document.body.appendChild(panel);

  // Make the panel draggable
  let isDragging = false;
  let offsetX, offsetY;

  handle.addEventListener("mousedown", (e) => {
    isDragging = true;
    panel.classList.add("dragging");
    offsetX = e.clientX - panel.getBoundingClientRect().left;
    offsetY = e.clientY - panel.getBoundingClientRect().top;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    panel.style.left = (e.clientX - offsetX) + "px";
    panel.style.top = (e.clientY - offsetY) + "px";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      panel.classList.remove("dragging");

      // Save the new position
      savePanelPosition("doc-panel", {
        left: parseInt(panel.style.left),
        top: parseInt(panel.style.top),
        width: parseInt(panel.style.width),
        height: parseInt(panel.style.height)
      });
    }
  });

  // Return an object with methods to control the panel
  return {
    panel,
    toggle: () => {
      if (panel.style.display === "none") {
        panel.style.display = "flex";
      } else {
        panel.style.display = "none";
      }
    },
    show: () => {
      panel.style.display = "flex";
    },
    hide: () => {
      panel.style.display = "none";
    },
    isVisible: () => panel.style.display !== "none"
  };
}