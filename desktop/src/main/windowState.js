/**
 * Main window bounds persistence, with sanity checks so a window never comes
 * back off-screen after a monitor was unplugged or a projector rearranged.
 */
import { dirname } from "node:path";

export const DEFAULT_WINDOW_STATE = Object.freeze({
  width: 1440,
  height: 900,
  x: undefined,
  y: undefined,
  maximized: false,
});

export const MIN_WINDOW_SIZE = Object.freeze({ width: 960, height: 600 });

/** How much of the window must remain on a display for its position to count. */
const VISIBLE_MARGIN = 120;

function intersects(bounds, display) {
  return (
    bounds.x + VISIBLE_MARGIN <= display.x + display.width &&
    bounds.x + bounds.width - VISIBLE_MARGIN >= display.x &&
    bounds.y + VISIBLE_MARGIN <= display.y + display.height &&
    bounds.y + bounds.height - VISIBLE_MARGIN >= display.y
  );
}

/**
 * @param {object} state - Stored state (may be partial or garbage).
 * @param {Array<{x:number,y:number,width:number,height:number}>} displays - Work areas.
 */
export function sanitizeBounds(state, displays) {
  const source = state && typeof state === "object" ? state : {};
  const largest = displays.reduce(
    (best, d) => (d.width * d.height > best.width * best.height ? d : best),
    { width: 0, height: 0 },
  );
  const maxWidth = largest.width > 0 ? largest.width : Number.POSITIVE_INFINITY;
  const maxHeight = largest.height > 0 ? largest.height : Number.POSITIVE_INFINITY;

  const width = Math.min(
    maxWidth,
    Math.max(MIN_WINDOW_SIZE.width, Number(source.width) || DEFAULT_WINDOW_STATE.width),
  );
  const height = Math.min(
    maxHeight,
    Math.max(MIN_WINDOW_SIZE.height, Number(source.height) || DEFAULT_WINDOW_STATE.height),
  );

  const result = { width, height, maximized: source.maximized === true };
  const x = Number(source.x);
  const y = Number(source.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    const candidate = { x, y, width, height };
    if (displays.some((display) => intersects(candidate, display))) {
      result.x = x;
      result.y = y;
    }
  }
  return result;
}

const silentLog = { info() {}, warn() {}, error() {} };

export function createWindowStateStore({ filePath, fs, log = silentLog }) {
  function load() {
    try {
      if (!fs.existsSync(filePath)) return { ...DEFAULT_WINDOW_STATE };
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      log.warn(`window state: could not read ${filePath} (${error.message})`);
      return { ...DEFAULT_WINDOW_STATE };
    }
  }

  function save(state) {
    try {
      fs.mkdirSync(dirname(filePath), { recursive: true });
      const tmpPath = `${filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(state));
      fs.renameSync(tmpPath, filePath);
    } catch (error) {
      log.warn(`window state: could not write ${filePath} (${error.message})`);
    }
  }

  return { load, save };
}
