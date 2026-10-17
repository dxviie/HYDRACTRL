/**
 * The code overlay: the running sketch's code drawn over the visuals, the
 * way hydra's own editor shows it, with a blend mode and an opacity of its
 * own. Every output draws it (the /output page, so the desktop app's
 * Syphon/Spout output too, and the breakout window), and the interface
 * draws it while its UI is hidden (see plugins/CodeOverlayPlugin.js).
 *
 * The settings are pure data, `{ visible, blendMode, opacity }`, shared with
 * the outputs over the output socket (`overlay` in src/server/outputHub.ts);
 * the view is plain DOM, so the frames an output shares carry it.
 */

/** CSS mix-blend-mode values; the desktop app's settings keep the same list. */
export const BLEND_MODES = Object.freeze([
  "normal",
  "difference",
  "exclusion",
  "screen",
  "overlay",
  "multiply",
  "soft-light",
  "hard-light",
  "color-dodge",
  "color-burn",
  "lighten",
  "darken",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);

export const DEFAULT_CODE_OVERLAY = Object.freeze({
  visible: false,
  blendMode: "normal",
  opacity: 1,
});

/** "color-dodge" -> "Color dodge", for menus. */
export function blendModeLabel(mode) {
  const words = String(mode).replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Merge `input` over `base` into complete, valid settings: unknown blend
 * modes and unusable values keep the base value, opacity is clamped to 0..1.
 */
export function normalizeCodeOverlay(input, base = DEFAULT_CODE_OVERLAY) {
  const raw = input && typeof input === "object" ? input : {};
  const opacity = typeof raw.opacity === "number" ? raw.opacity : Number.NaN;
  return {
    visible: typeof raw.visible === "boolean" ? raw.visible : base.visible,
    blendMode: BLEND_MODES.includes(raw.blendMode) ? raw.blendMode : base.blendMode,
    opacity: Number.isFinite(opacity)
      ? Math.round(Math.min(1, Math.max(0, opacity)) * 100) / 100
      : base.opacity,
  };
}

export function sameCodeOverlay(a, b) {
  return a?.visible === b?.visible && a?.blendMode === b?.blendMode && a?.opacity === b?.opacity;
}

/** Line height, in ems. */
export const LINE_HEIGHT = 1.35;
/** Advance of one character of a monospace font, in ems, with a little to spare. */
const CHAR_WIDTH = 0.61;
/** The backdrop's padding on either side of a line, in ems. */
const LINE_PADDING = 0.2;
const TAB_WIDTH = 2;

/** The number of lines in the code and the length of its longest one. */
export function measureCode(code) {
  const lines = String(code ?? "")
    .replace(/\s+$/, "")
    .split("\n");
  let columns = 0;
  for (const line of lines) {
    columns = Math.max(columns, line.replace(/\t/g, " ".repeat(TAB_WIDTH)).length);
  }
  return { lines: lines.length, columns };
}

/**
 * The font size (px) and margin (px) that fit the code into a view of this
 * size: as large as reads well from across a room, smaller for long
 * sketches, and never so small it can't be read; lines too long even then
 * wrap. Sizes follow the view's height, so every output looks the same
 * whatever its resolution.
 */
export function fitCodeOverlay({ lines, columns }, width, height) {
  const margin = Math.round(Math.min(width, height) * 0.03);
  const max = height * 0.028;
  const min = height * 0.011;
  const byHeight = (height - 2 * margin) / (Math.max(1, lines) * LINE_HEIGHT);
  const byWidth = (width - 2 * margin) / (Math.max(1, columns) * CHAR_WIDTH + 2 * LINE_PADDING);
  const fontSize = Math.max(min, Math.min(max, byHeight, byWidth));
  // Rounded down, so the code still fits
  return { fontSize: Math.floor(fontSize * 10) / 10, margin };
}

const STYLE_ID = "hydractrl-code-overlay-style";
const FONT_URL = "/assets/fonts/fira-code-latin-wght.woff2";

function overlayCss(fontUrl) {
  return `
@font-face {
  font-family: "HYDRACTRL Overlay Code";
  src: url("${fontUrl}") format("woff2");
  font-weight: 300 700;
  font-display: swap;
}
.hydractrl-code-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  box-sizing: border-box;
  margin: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  color: #fff;
  font-family: "HYDRACTRL Overlay Code", "Fira Code", ui-monospace, "SF Mono", Menlo, Consolas,
    monospace;
  font-weight: 450;
  line-height: ${LINE_HEIGHT};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: ${TAB_WIDTH};
  font-variant-ligatures: none;
}
.hydractrl-code-overlay[hidden] {
  display: none;
}
.hydractrl-code-overlay > span {
  padding: 0 ${LINE_PADDING}em;
  background-color: rgba(0, 0, 0, 0.6);
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
`;
}

function installStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  // Absolute: the breakout window is an about:blank page
  let fontUrl = FONT_URL;
  try {
    fontUrl = new URL(FONT_URL, globalThis.location?.href).href;
  } catch (_error) {
    // keep the path
  }
  style.textContent = overlayCss(fontUrl);
  (doc.head || doc.documentElement).appendChild(style);
}

/**
 * The overlay's DOM, appended to `container`, which must hold the visuals'
 * canvas (the blend mode blends with what is under it in that container).
 * Hidden until `setShown(true)`, and while there is no code to show.
 */
export function createCodeOverlayView(container, { doc = container.ownerDocument } = {}) {
  installStyle(doc);
  const element = doc.createElement("pre");
  element.className = "hydractrl-code-overlay";
  element.setAttribute("aria-hidden", "true");
  element.hidden = true;
  container.appendChild(element);

  const view = doc.defaultView;
  let code = "";
  let shown = false;
  let size = { lines: 0, columns: 0 };

  function layout() {
    if (element.hidden) return;
    const width = view?.innerWidth || container.clientWidth || 1280;
    const height = view?.innerHeight || container.clientHeight || 720;
    const { fontSize, margin } = fitCodeOverlay(size, width, height);
    element.style.fontSize = `${fontSize}px`;
    element.style.padding = `${margin}px`;
  }

  function refresh() {
    element.hidden = !shown || code.trim() === "";
    layout();
  }

  view?.addEventListener("resize", layout);

  return {
    element,
    setCode(next) {
      const value = typeof next === "string" ? next.replace(/\s+$/, "") : "";
      if (value === code) return;
      code = value;
      // A backdrop behind each line with text in it, none behind blank ones
      element.replaceChildren();
      code.split("\n").forEach((line, index) => {
        if (index > 0) element.append("\n");
        if (line.trim() === "") return;
        const text = doc.createElement("span");
        text.textContent = line;
        element.appendChild(text);
      });
      size = measureCode(code);
      refresh();
    },
    /** Blend mode and opacity. */
    setStyle({ blendMode, opacity }) {
      element.style.mixBlendMode = blendMode;
      element.style.opacity = String(opacity);
    },
    setShown(next) {
      shown = Boolean(next);
      refresh();
    },
    isShown: () => !element.hidden,
    dispose() {
      view?.removeEventListener("resize", layout);
      element.remove();
    },
  };
}
