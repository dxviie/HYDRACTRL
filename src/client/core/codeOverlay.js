/**
 * The code overlay: the editor's code drawn over the visuals as you type, the
 * way hydra's own editor shows it, in Fira Code with its ligatures, its
 * comments, strings and numbers set apart, and with a blend mode and an
 * opacity of its own. No words, only marks: a square above the code is
 * filled while that code runs and hollow once it is edited since, a bar in
 * the margin shows each line that differs, a block cursor and the selection
 * show where you are, and the code flashes when it runs. A small indicator
 * in the top right corner (hydra's audio bins take the bottom right) shows
 * the scenes and slots: which hold a saved sketch, and which is active.
 * Every output draws it (the /output page, so the desktop app's Syphon/Spout
 * output too, and the breakout window), and the interface draws it while its
 * UI is hidden (plugins/CodeOverlayPlugin.js).
 *
 * The settings are pure data, `{ visible, slots, blendMode, opacity }`, and
 * so is what the overlay shows (core/editorSnapshot.js); both go to the
 * outputs over the output socket (src/server/outputHub.ts). The view is
 * plain DOM, so the frames an output shares carry it.
 */
import { codeTokens, lineSegments } from "./editorSnapshot.js";

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
  // The scenes and slots indicator, while the overlay is on
  slots: true,
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
    slots: typeof raw.slots === "boolean" ? raw.slots : base.slots,
    blendMode: BLEND_MODES.includes(raw.blendMode) ? raw.blendMode : base.blendMode,
    opacity: Number.isFinite(opacity)
      ? Math.round(Math.min(1, Math.max(0, opacity)) * 100) / 100
      : base.opacity,
  };
}

export function sameCodeOverlay(a, b) {
  return (
    a?.visible === b?.visible &&
    a?.slots === b?.slots &&
    a?.blendMode === b?.blendMode &&
    a?.opacity === b?.opacity
  );
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

/** How long the code stays lit when it runs, before it fades back (ms). */
export const FLASH_MS = 160;
/** Lines kept free above and below the code: the status tag and a new line. */
const EXTRA_LINES = 2;

const STYLE_ID = "hydractrl-code-overlay-style";
const FONT_URL = "/assets/fonts/fira-code-latin-wght.woff2";
const EDITED = "#ffc94d";
const RUNNING = "#7dffb3";
const FLASH = "rgba(144, 0, 255, 0.85)";
/** The slabs behind the code, the marks and the scenes and slots */
const SLAB = "rgba(0, 0, 0, 0.7)";

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
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  contain: strict;
  color: #fff;
  font-family: "HYDRACTRL Overlay Code", "Fira Code", ui-monospace, "SF Mono", Menlo, Consolas,
    monospace;
  font-weight: 500;
  font-variant-ligatures: contextual;
}
.hydractrl-code-overlay[hidden],
.hydractrl-code-overlay [hidden] {
  display: none;
}
.hco-code {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: var(--hco-margin);
  font-size: var(--hco-size);
  line-height: ${LINE_HEIGHT};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: ${TAB_WIDTH};
}
.hco-clear { float: right; }
.hco-tag {
  margin-bottom: 0.25em;
  font-size: 0.72em;
  line-height: 1;
}
.hco-marks {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.3em;
  background-color: ${SLAB};
  transition: background-color 0.35s ease-out;
}
.hco-state {
  width: 0.7em;
  height: 0.7em;
  box-sizing: border-box;
}
.hco-running .hco-state { background-color: ${RUNNING}; }
.hco-edited .hco-state { border: 0.14em solid ${EDITED}; }
.hco-tabs {
  display: flex;
  gap: 0.14em;
}
.hco-tabs span {
  width: 0.5em;
  height: 0.7em;
  box-sizing: border-box;
  border: 0.1em solid rgba(255, 255, 255, 0.6);
}
.hco-tabs span + span {
  border-color: #fff;
  background-color: #fff;
}
.hco-line {
  position: relative;
  min-height: ${LINE_HEIGHT}em;
}
.hco-ink {
  padding: 0 ${LINE_PADDING}em;
  background-color: ${SLAB};
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  transition: background-color 0.35s ease-out;
}
.hco-flash .hco-ink,
.hco-flash .hco-marks {
  background-color: ${FLASH};
  transition: none;
}
.hco-comment { color: #8f8f8f; }
.hco-string { color: #bfe3ff; }
.hco-number { color: #ffd8a8; }
.hco-keyword { color: #dcc6ff; }
.hco-punctuation { color: #c4c4c4; }
.hco-selected {
  background-color: rgba(110, 150, 255, 0.6);
}
/* A block that turns the character under it inside out, as tall as the
   backdrop: Fira Code rises 1em above the baseline and drops 0.31em below */
.hco-caret {
  position: relative;
  display: inline-block;
  width: 0;
  height: 1.31em;
  vertical-align: -0.31em;
}
.hco-caret::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 1ch;
  background-color: #fff;
  mix-blend-mode: difference;
}
.hco-changed::before {
  content: "";
  position: absolute;
  left: -0.55em;
  top: 0.1em;
  bottom: 0.1em;
  width: 0.25em;
  background-color: ${EDITED};
}
.hco-removed::after {
  content: "";
  position: absolute;
  left: -0.7em;
  top: -0.22em;
  border-top: 0.22em solid transparent;
  border-bottom: 0.22em solid transparent;
  border-left: 0.36em solid ${EDITED};
}
.hco-slots {
  position: absolute;
  top: var(--hco-margin);
  right: var(--hco-margin);
  display: flex;
  flex-direction: column;
  gap: 0.45em;
  padding: 0.5em;
  background-color: ${SLAB};
  font-size: 1.9vh;
}
.hco-scenes {
  display: flex;
  gap: 0.3em;
}
.hco-scene {
  width: 0.55em;
  height: 0.55em;
  box-sizing: border-box;
  border: 0.1em solid rgba(255, 255, 255, 0.5);
}
.hco-scene.hco-filled {
  border-color: transparent;
  background-color: rgba(255, 255, 255, 0.45);
}
.hco-scene.hco-current {
  border-color: #fff;
  background-color: #fff;
}
.hco-grid {
  display: grid;
  grid-template-columns: repeat(8, 1.1em);
  grid-auto-rows: 1.1em;
  gap: 0.25em;
}
.hco-cell {
  box-sizing: border-box;
  border: 0.1em solid rgba(255, 255, 255, 0.4);
}
.hco-cell.hco-saved {
  border-color: transparent;
  background-color: rgba(255, 255, 255, 0.75);
}
.hco-cell.hco-active {
  border: 0.18em solid #fff;
}
.hco-cell.hco-active.hco-saved {
  background-color: #a64dff;
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
 * Hidden until `setShown(true)`. It draws an editor snapshot and a slots
 * state (core/editorSnapshot.js), and only does that work while it shows.
 */
export function createCodeOverlayView(container, { doc = container.ownerDocument } = {}) {
  installStyle(doc);
  const create = (tag, className) => {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    return element;
  };

  const root = create("div", "hydractrl-code-overlay");
  root.setAttribute("aria-hidden", "true");
  root.hidden = true;
  const code = create("div", "hco-code");
  // Room for the scenes and slots: lines beside them wrap short of them
  const clear = create("div", "hco-clear");
  const tag = create("div", "hco-tag");
  const marks = create("span", "hco-marks");
  // Shown while the Setup tab is: the second of two tabs
  const tabs = create("span", "hco-tabs");
  tabs.append(create("span"), create("span"));
  marks.append(tabs, create("span", "hco-state"));
  tag.append(marks);
  const lines = create("div", "hco-lines");
  code.append(clear, tag, lines);

  const slotsBlock = create("div", "hco-slots");
  const scenes = create("div", "hco-scenes");
  const dots = Array.from({ length: 4 }, () => create("span", "hco-scene"));
  scenes.append(...dots);
  const grid = create("div", "hco-grid");
  const cells = Array.from({ length: 16 }, () => create("span", "hco-cell"));
  grid.append(...cells);
  slotsBlock.append(scenes, grid);

  root.append(code, slotsBlock);
  container.appendChild(root);

  const view = doc.defaultView;
  let snapshot = null;
  let slots = null;
  let shown = false;
  let slotsShown = true;
  let codeStale = false;
  let slotsStale = false;
  let flashTimer = null;
  // Between the code and the scenes and slots (px)
  let gap = 0;

  function layout() {
    const width = view?.innerWidth || container.clientWidth || 1280;
    const height = view?.innerHeight || container.clientHeight || 720;
    const size = measureCode(snapshot?.code ?? "");
    const { fontSize, margin } = fitCodeOverlay(
      { lines: size.lines + EXTRA_LINES, columns: size.columns },
      width,
      height,
    );
    root.style.setProperty("--hco-size", `${fontSize}px`);
    root.style.setProperty("--hco-margin", `${margin}px`);
    gap = margin / 2;
    clearSlots();
  }

  function clearSlots() {
    clear.hidden = slotsBlock.hidden;
    if (clear.hidden) return;
    clear.style.width = `${slotsBlock.offsetWidth + gap}px`;
    clear.style.height = `${slotsBlock.offsetHeight}px`;
  }

  function renderCode() {
    codeStale = false;
    code.hidden = snapshot === null;
    if (!snapshot) return;
    // Running or edited since, and which tab
    tag.className = `hco-tag ${snapshot.dirty ? "hco-edited" : "hco-running"}`;
    tabs.hidden = snapshot.tab !== "setup";
    const changed = new Set(snapshot.changed);
    const removed = new Set(snapshot.removed);
    const tokens = codeTokens(snapshot.code);
    const texts = snapshot.code.split("\n");
    const fragment = doc.createDocumentFragment();
    let from = 0;
    let first = 0;
    texts.forEach((text, index) => {
      const line = create("div", "hco-line");
      if (changed.has(index)) line.classList.add("hco-changed");
      if (removed.has(index)) line.classList.add("hco-removed");
      // The tokens on this line
      const to = from + text.length;
      while (first < tokens.length && tokens[first].to <= from) first++;
      let last = first;
      while (last < tokens.length && tokens[last].from < to) last++;
      const segments = lineSegments(text, from, snapshot, tokens.slice(first, last));
      if (segments.length > 0) {
        // A backdrop behind each line with text in it, none behind blank ones
        const ink = create("span", text.trim() === "" ? "hco-blank" : "hco-ink");
        for (const segment of segments) {
          if (segment.caret) {
            ink.append(create("span", "hco-caret"));
          } else if (segment.selected || segment.kind) {
            const span = create("span", segment.kind ? `hco-${segment.kind}` : "");
            if (segment.selected) span.classList.add("hco-selected");
            span.textContent = segment.text;
            ink.append(span);
          } else {
            ink.append(segment.text);
          }
        }
        line.append(ink);
      }
      fragment.append(line);
      from += text.length + 1;
    });
    if (removed.has(texts.length)) fragment.append(create("div", "hco-line hco-removed"));
    lines.replaceChildren(fragment);
    layout();
  }

  function renderSlots() {
    slotsStale = false;
    slotsBlock.hidden = !slotsShown || slots === null;
    clearSlots();
    if (slotsBlock.hidden) return;
    dots.forEach((dot, index) => {
      dot.classList.toggle("hco-filled", slots.scenes[index]);
      dot.classList.toggle("hco-current", index === slots.scene);
    });
    cells.forEach((cell, index) => {
      cell.classList.toggle("hco-saved", slots.slots[index]);
      cell.classList.toggle("hco-active", index === slots.slot);
    });
  }

  function refresh() {
    root.hidden = !shown;
    if (!shown) return;
    if (codeStale) renderCode();
    if (slotsStale) renderSlots();
    layout();
  }

  view?.addEventListener("resize", layout);

  return {
    element: root,
    /** What to show of the editor (core/editorSnapshot.js), or null for no code. */
    setEditor(next) {
      snapshot = next ?? null;
      codeStale = true;
      if (shown) renderCode();
    },
    /** The scenes and slots (normalizeSlotsState), or null for no indicator. */
    setSlots(next) {
      slots = next ?? null;
      slotsStale = true;
      if (shown) renderSlots();
    },
    /** Light the code up for a moment: it just ran. */
    flash() {
      if (!shown) return;
      root.classList.add("hco-flash");
      if (flashTimer !== null) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flashTimer = null;
        root.classList.remove("hco-flash");
      }, FLASH_MS);
    },
    /** Blend mode and opacity. */
    setStyle({ blendMode, opacity }) {
      root.style.mixBlendMode = blendMode;
      root.style.opacity = String(opacity);
    },
    setShown(next) {
      shown = Boolean(next);
      refresh();
    },
    setSlotsShown(next) {
      slotsShown = Boolean(next);
      slotsStale = true;
      if (shown) renderSlots();
    },
    /** Whether the code shows. */
    isShown: () => !root.hidden && !code.hidden,
    dispose() {
      view?.removeEventListener("resize", layout);
      if (flashTimer !== null) clearTimeout(flashTimer);
      root.remove();
    },
  };
}
