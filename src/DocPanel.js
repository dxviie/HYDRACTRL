/**
 * Documentation Panel Component
 * A draggable panel with Hydra function reference
 */
import { loadPanelPosition, savePanelPosition } from "./utils/PanelStorage.js";

// Hydra function categories with their color codes (matching hydra.ojack.xyz)
const FUNCTION_CATEGORIES = {
  sources: {
    title: "Sources",
    color: "#FFAA99",
    functions: ["noise", "voronoi", "osc", "shape", "gradient", "solid", "src", "out"]
  },
  color: {
    title: "Color",
    color: "#CCFF99",
    functions: ["brightness", "contrast", "color", "colorama", "invert", "luma", "posterize", "saturate", "thresh", "hue", "r", "g", "b"]
  },
  geometry: {
    title: "Geometry",
    color: "#FFEE99",
    functions: ["kaleid", "pixelate", "repeat", "repeatX", "repeatY", "rotate", "scale", "scroll", "scrollX", "scrollY"]
  },
  blend: {
    title: "Blend",
    color: "#99FFAA",
    functions: ["add", "blend", "diff", "layer", "mask", "mult", "sub"]
  },
  modulate: {
    title: "Modulate",
    color: "#99ffee",
    functions: ["modulate", "modulateHue", "modulateKaleid", "modulatePixelate", "modulateRepeat", "modulateRepeatX", "modulateRepeatY", "modulateRotate", "modulateScale", "modulateScrollX", "modulateScrollY"]
  },
  external: {
    title: "External",
    color: "#99ccff",
    functions: ["initCam", "initImage", "initVideo", "init", "initStream", "initScreen"]
  },
  settings: {
    title: "Settings",
    color: "#aa99ff",
    functions: ["render", "update", "setResolution", "hush", "setFunction", "speed", "bpm", "width", "height", "time", "mouse"]
  },
  array: {
    title: "Array",
    color: "#ee99ff",
    functions: ["fast", "smooth", "ease", "offset", "fit"]
  },
  audio: {
    title: "Audio",
    color: "#ff99cc",
    functions: ["fft", "setBins", "setCutoff", "setScale", "setSmooth", "show"]
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
    example: "osc().color(r = 1, g = 1, b = 1, a = 1).out()",
    params: [
      { name: "r", default: "1", description: "Red adjustment (0-1)" },
      { name: "g", default: "1", description: "Green adjustment (0-1)" },
      { name: "b", default: "1", description: "Blue adjustment (0-1)" },
      { name: "a", default: "1", description: "Alpha adjustment (0-1)" }
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
  luma: {
    description: "Adjust luma",
    example: "osc().luma( threshold = 0.5, tolerance = 0.1 ).out()",
    params: [
      { name: "threshold", default: "0.5", description: "Threshold for luma adjustment" },
      { name: "tolerance", default: "0.1", description: "Tolerance for luma adjustment" }
    ]
  },
  posterize: {
    description: "Posterize colors",
    example: "osc().posterize(bins = 3, gamma = 0.6).out()",
    params: [
      { name: "bins", default: "3", description: "Number of bins for posterization" },
      { name: "gamma", default: "0.6", description: "Gamma correction for posterization" }
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
  thresh: {
    description: "Threshold colors",
    example: "osc().thresh(threshold = 0.5, tolerance = 0.04).out()",
    params: [
      { name: "threshold", default: "0.5", description: "Threshold for thresholding" },
      { name: "tolerance", default: "0.04", description: "Tolerance for thresholding" }
    ]
  },
  r: {
    description: "Redden colors",
    example: "osc().r(scale = 1, offset = 0).out()",
    params: [
      { name: "scale", default: "1", description: "Scale of red adjustment" },
      { name: "offset", default: "0", description: "Offset of red adjustment" }
    ]
  },
  g: {
    description: "Green colors",
    example: "osc().g(scale = 1, offset = 0).out()",
    params: [
      { name: "scale", default: "1", description: "Scale of green adjustment" },
      { name: "offset", default: "0", description: "Offset of green adjustment" }
    ]
  },
  b: {
    description: "Blue colors",
    example: "osc().b(scale = 1, offset = 0).out()",
    params: [
      { name: "scale", default: "1", description: "Scale of blue adjustment" },
      { name: "offset", default: "0", description: "Offset of blue adjustment" }
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
  repeatX: {
    description: "Repeat image horizontally",
    example: "osc().repeatX(repeatX = 3, offsetX = 0).out()",
    params: [
      { name: "repeatX", default: "3", description: "Number of horizontal repetitions" },
      { name: "offsetX", default: "0", description: "X offset for repetition" }
    ]
  },
  repeatY: {
    description: "Repeat image vertically",
    example: "osc().repeatY(repeatY = 3, offsetY = 0).out()",
    params: [
      { name: "repeatY", default: "3", description: "Number of vertical repetitions" },
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
    example: "osc().scale( amount = 1.5, xMult = 1, yMult = 1, offsetX = 0.5, offsetY = 0.5 ).out()",
    params: [
      { name: "amount", default: "1.5", description: "Scale amount" },
      { name: "xMult", default: "1", description: "X scale multiplier" },
      { name: "yMult", default: "1", description: "Y scale multiplier" },
      { name: "offsetX", default: "0.5", description: "X offset for scaling" },
      { name: "offsetY", default: "0.5", description: "Y offset for scaling" }
    ]
  },
  scroll: {
    description: "Scroll image",
    example: "osc().scroll( scrollX = 0.5, scrollY = 0.5, speedX = 0, speedY = 0 ).out()",
    params: [
      { name: "scrollX", default: "0.5", description: "X scroll amount" },
      { name: "scrollY", default: "0.5", description: "Y scroll amount" },
      { name: "speedX", default: "0", description: "X scroll speed" },
      { name: "speedY", default: "0", description: "Y scroll speed" }
    ]
  },
  scrollX: {
    description: "Scroll image horizontally",
    example: "osc().scrollX( scrollX = 0.5, speedX = 0 ).out()",
    params: [
      { name: "scrollX", default: "0.5", description: "X scroll amount" },
      { name: "speedX", default: "0", description: "X scroll speed" }
    ]
  },
  scrollY: {
    description: "Scroll image vertically",
    example: "osc().scrollY( scrollY = 0.5, speedY = 0 ).out()",
    params: [
      { name: "scrollY", default: "0.5", description: "Y scroll amount" },
      { name: "speedY", default: "0", description: "Y scroll speed" }
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
  layer: {
    description: "Layer textures",
    example: "osc().layer( texture ).out()",
    params: [
      { name: "texture", description: "Texture to layer" }
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
  sub: {
    description: "Subtract textures",
    example: "osc().sub(texture, amount = 1).out()",
    params: [
      { name: "texture", description: "Texture to subtract" },
      { name: "amount", default: "1", description: "Amount to subtract" }
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
  modulateHue: {
    description: "Modulate hue with another source",
    example: "osc().modulateHue( texture, amount = 1 ).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "amount", default: "1", description: "Amount to modulate" }
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
  modulateRepeat: {
    description: "Modulate repeat with another source",
    example: "osc().modulateRepeat( texture, repeatX = 3, repeatY = 3, offsetX = 0.5, offsetY = 0.5 ).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "repeatX", default: "3", description: "Number of horizontal repetitions" },
      { name: "repeatY", default: "3", description: "Number of vertical repetitions" },
      { name: "offsetX", default: "0.5", description: "X offset for repetition" },
      { name: "offsetY", default: "0.5", description: "Y offset for repetition" }
    ]
  },
  modulateRepeatX: {
    description: "Modulate repeatX with another source",
    example: "osc().modulateRepeatX( texture, reps = 3, offset = 0.5 ).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "reps", default: "3", description: "Number of horizontal repetitions" },
      { name: "offset", default: "0.5", description: "X offset for repetition" }
    ]
  },
  modulateRepeatY: {
    description: "Modulate repeatY with another source",
    example: "osc().modulateRepeatY( texture, reps = 3, offset = 0.5 ).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "reps", default: "3", description: "Number of vertical repetitions" },
      { name: "offset", default: "0.5", description: "Y offset for repetition" }
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
  modulateScrollX: {
    description: "Modulate scrollX with another source",
    example: "osc().modulateScrollX( texture, scrollX = 0.5, speedX = 0 ).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "scrollX", default: "0.5", description: "X scroll amount" },
      { name: "speedX", default: "0", description: "X scroll speed" }
    ]
  },
  modulateScrollY: {
    description: "Modulate scrollY with another source",
    example: "osc().modulateScrollY( texture, scrollY = 0.5, speedY = 0 ).out()",
    params: [
      { name: "texture", description: "Texture to modulate with" },
      { name: "scrollY", default: "0.5", description: "Y scroll amount" },
      { name: "speedY", default: "0", description: "Y scroll speed" }
    ]
  },

  // External
  initCam: {
    description: "Initialize webcam as an input source (s0, s1, etc.).",
    params: ["index = 0"],
    example: "initCam()"
  },
  initScreen: {
    description: "Initialize screen capture as an input source.",
    params: [],
    example: "initScreen()"
  },
  initVideo: {
    description: "Initialize video from URL as an input source.",
    params: ["url"],
    example: "initVideo(url)"
  },
  init: {
    description: "Initialize video from URL as an input source.",
    params: ["options"],
    example: "init({ src: canvas })"
  },
  initImage: {
    description: "Initialize image from URL as an input source.",
    params: ["url"],
    example: "initImage(url)"
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
  update: {
    description: "update is called every frame",
    example: "update = () => b += 0.01 * Math.sin(time)",
    params: []
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
  setFunction: {
    description: "Register a function in hydra",
    example: "setFunction(options) - https://hydra.ojack.xyz/api/#functions/setFunction/0",
    params: [
      { name: "options", description: "Options object" }
    ]
  },
  speed: {
    description: "Set speed of time",
    example: "speed = 1",
    params: [
      { name: "speed", description: "Speed of time" }
    ]
  },
  bpm: {
    description: "Set BPM of time",
    example: "bpm = 120",
    params: [
      { name: "bpm", description: "BPM of time" }
    ]
  },
  width: {
    description: "width of output",
    example: "width",
    params: [
      { name: "width", description: "Width of output" }
    ]
  },
  height: {
    description: "height of output",
    example: "height",
    params: [
      { name: "height", description: "Height of output" }
    ]
  },
  time: {
    description: "time",
    example: "time",
    params: [
      { name: "time", description: "Time of time" }
    ]
  },
  mouse: {
    description: "mouse position",
    example: "mouse.x; mouse.y;",
    params: [
      { name: "mouse", description: "Mouse position" }
    ]
  },

  // Array
  fast: {
    description: "Fast array",
    example: "fast( speed = 1 )",
    params: [
      { name: "speed", default: "1", description: "Speed of array" }
    ]
  },
  smooth: {
    description: "Smooth array",
    example: "smooth( speed = 1 )",
    params: [
      { name: "speed", default: "1", description: "Speed of array" }
    ]
  },
  ease: {
    description: "Ease array",
    example: "ease( ease = 'linear' )",
    params: [
      { name: "ease", default: "linear", description: "Easing function" }
    ]
  },
  offset: {
    description: "Offset array",
    example: "offset( offset = 0.5 )",
    params: [
      { name: "offset", default: "0.5", description: "Offset of array" }
    ]
  },
  fit: {
    description: "Fit array",
    example: "fit( low = 0, high = 1 )",
    params: [
      { name: "low", default: "0", description: "Low value of array" },
      { name: "high", default: "1", description: "High value of array" }
    ]
  },

  // Audio
  fft: {
    description: "FFT",
    example: "a.fft = Array(4)",
    params: []
  },
  setSmooth: {
    description: "Set smoothness of FFT",
    example: "a.setSmooth( smooth = 0.4 )",
    params: [
      { name: "smooth", default: "0.4", description: "Smoothness of FFT" }
    ]
  },
  setCutoff: {
    description: "Set cutoff of FFT",
    example: "a.setCutoff(cutoff = 2)",
    params: [
      { name: "cutoff", default: "2", description: "Cutoff of FFT" }
    ]
  },
  setScale: {
    description: "Set scale of FFT",
    example: "a.setScale(scale = 10)",
    params: [
      { name: "scale", default: "10", description: "Scale of FFT" }
    ]
  },
  show: {
    description: "Show FFT",
    example: "a.show()",
    params: []
  },
  setBins: {
    description: "Set number of FFT bins",
    example: "a.setBins(bins = 4)",
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
    panel.style.width = savedPosition.width ? savedPosition.width + "px" : "500px";
    panel.style.height = savedPosition.height ? savedPosition.height + "px" : "900px";
  } else {
    panel.style.left = "60px";
    panel.style.top = "60px";
    panel.style.width = "500px";
    panel.style.height = "900px";
  }

  panel.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), var(--panel-opacity)) !important";
  panel.style.borderRadius = "8px";
  panel.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
  panel.style.backdropFilter = "blur(var(--color-panel-blur))";
  panel.style.zIndex = "999";
  panel.style.overflow = "hidden";
  panel.style.fontFamily = "sans-serif";
  panel.style.fontSize = "14px";
  panel.style.color = "var(--color-text-primary)";
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
  rightContent.style.backgroundColor = "rgba(255, 255, 255, 0.1)";

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
      const exampleButtonId = `copy-example-btn-${funcName.replace(/\s+/g, '-')}`;
      content += `
        <div class="function-example">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="font-size: 13px; font-weight: bold;">Example</div>
            <button id="${exampleButtonId}" title="Copy example" class="copy-example-button" style="background: none; border: none; cursor: pointer; color: var(--color-text-secondary); padding: 2px 4px; line-height: 1;">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.829 12.861c.171-.413.171-.938.171-1.986s0-1.573-.171-1.986a2.25 2.25 0 0 0-1.218-1.218c-.413-.171-.938-.171-1.986-.171H11.1c-1.26 0-1.89 0-2.371.245a2.25 2.25 0 0 0-.984.984C7.5 9.209 7.5 9.839 7.5 11.1v6.525c0 1.048 0 1.573.171 1.986c.229.551.667.99 1.218 1.218c.413.171.938.171 1.986.171s1.573 0 1.986-.171m7.968-7.968a2.25 2.25 0 0 1-1.218 1.218c-.413.171-.938.171-1.986.171s-1.573 0-1.986.171a2.25 2.25 0 0 0-1.218 1.218c-.171.413-.171.938-.171 1.986s0 1.573-.171 1.986a2.25 2.25 0 0 1-1.218 1.218m7.968-7.968a11.68 11.68 0 0 1-7.75 7.9l-.218.068M16.5 7.5v-.9c0-1.26 0-1.89-.245-2.371a2.25 2.25 0 0 0-.983-.984C14.79 3 14.16 3 12.9 3H6.6c-1.26 0-1.89 0-2.371.245a2.25 2.25 0 0 0-.984.984C3 4.709 3 5.339 3 6.6v6.3c0 1.26 0 1.89.245 2.371c.216.424.56.768.984.984c.48.245 1.111.245 2.372.245H7.5"/></svg>
            </button>
          </div>
          <pre style="background-color: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 0;">${funcInfo.example}</pre>
        </div>
      `;
    }

    rightContent.innerHTML = content;

    // Add event listener for the copy button if it exists
    if (funcInfo.example) {
      const exampleButtonId = `copy-example-btn-${funcName.replace(/\s+/g, '-')}`;
      const copyButton = rightContent.querySelector(`#${exampleButtonId}`);
      if (copyButton) {
        copyButton.addEventListener('click', (event) => {
          event.stopPropagation(); // Prevent any other click listeners on parent elements
          navigator.clipboard.writeText(funcInfo.example)
            .then(() => {
              const originalIconHTML = copyButton.innerHTML;
              copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><path fill="none" stroke="var(--color-success, green)" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.829 12.861c.171-.413.171-.938.171-1.986s0-1.573-.171-1.986a2.25 2.25 0 0 0-1.218-1.218c-.413-.171-.938-.171-1.986-.171H11.1c-1.26 0-1.89 0-2.371.245a2.25 2.25 0 0 0-.984.984C7.5 9.209 7.5 9.839 7.5 11.1v6.525c0 1.048 0 1.573.171 1.986c.229.551.667.99 1.218 1.218c.413.171.938.171 1.986.171s1.573 0 1.986-.171m7.968-7.968a2.25 2.25 0 0 1-1.218 1.218c-.413.171-.938.171-1.986.171s-1.573 0-1.986.171a2.25 2.25 0 0 0-1.218 1.218c-.171.413-.171.938-.171 1.986s0 1.573-.171 1.986a2.25 2.25 0 0 1-1.218 1.218m7.968-7.968a11.68 11.68 0 0 1-7.75 7.9l-.218.068M16.5 7.5v-.9c0-1.26 0-1.89-.245-2.371a2.25 2.25 0 0 0-.983-.984C14.79 3 14.16 3 12.9 3H6.6c-1.26 0-1.89 0-2.371.245a2.25 2.25 0 0 0-.984.984C3 4.709 3 5.339 3 6.6v6.3c0 1.26 0 1.89.245 2.371c.216.424.56.768.984.984c.48.245 1.111.245 2.372.245H7.5"/></svg>';

              setTimeout(() => {
                copyButton.innerHTML = originalIconHTML;
              }, 2000);
            })
            .catch(err => {
              console.error('Failed to copy example to clipboard:', err);
              alert('Failed to copy example. See console for details.');
            });
        });
      }
    }
  };

  // Create function list by categories
  Object.keys(FUNCTION_CATEGORIES).forEach(catKey => {
    const category = FUNCTION_CATEGORIES[catKey];

    // Create category heading
    const categoryHeading = document.createElement("div");
    categoryHeading.style.fontWeight = "bold";
    categoryHeading.style.marginTop = "10px";
    categoryHeading.style.marginBottom = "6px";
    categoryHeading.style.backgroundColor = category.color;
    categoryHeading.style.color = "black";
    categoryHeading.style.borderBottom = `1px solid ${category.color}4D`; // Add 30% opacity border
    categoryHeading.style.padding = ".5rem 1rem";
    categoryHeading.style.borderRadius = "4px";
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
      <div style="font-size: 36px; margin-bottom: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Myna UI Icons by Praveen Juge - https://github.com/praveenjuge/mynaui-icons/blob/main/LICENSE --><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9.8V20m0-10.2c0-1.704.107-3.584-1.638-4.473C9.72 5 8.88 5 7.2 5H4.6C3.364 5 3 5.437 3 6.6v8.8c0 .568-.036 1.195.546 1.491c.214.109.493.109 1.052.109H7.43c2.377 0 3.26 1.036 4.569 3m0-10.2c0-1.704-.108-3.584 1.638-4.473C14.279 5 15.12 5 16.8 5h2.6c1.235 0 1.6.436 1.6 1.6v8.8c0 .567.035 1.195-.546 1.491c-.213.109-.493.109-1.052.109h-2.833c-2.377 0-3.26 1.036-4.57 3"/></svg>
      </div>
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