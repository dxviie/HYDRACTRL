/**
 * Desktop settings: defaults, validation and a small atomic JSON store.
 *
 * Validation is pure and total: whatever comes in (a partial update from the
 * settings window, a hand-edited or corrupt file) comes out as a complete,
 * in-range settings object. The store takes its `fs` so it can be tested on a
 * temp directory without Electron.
 */
import { dirname } from "node:path";

export const RESOLUTION_PRESETS = Object.freeze([
  Object.freeze({ label: "720p", width: 1280, height: 720 }),
  Object.freeze({ label: "1080p", width: 1920, height: 1080 }),
  Object.freeze({ label: "1440p", width: 2560, height: 1440 }),
  Object.freeze({ label: "4K", width: 3840, height: 2160 }),
]);

export const FRAME_RATES = Object.freeze([24, 25, 30, 50, 60, 120]);

export const LIMITS = Object.freeze({
  minSize: 16,
  maxSize: 8192,
  minFrameRate: 1,
  maxFrameRate: 240,
  minPort: 1024,
  maxPort: 65535,
  maxNameLength: 64,
});

export const DEFAULT_SETTINGS = Object.freeze({
  output: Object.freeze({
    autoStart: true,
    name: "HYDRACTRL",
    width: 1920,
    height: 1080,
    frameRate: 60,
    includeAlpha: false,
    preview: false,
  }),
  server: Object.freeze({
    port: 3000,
    allowNetwork: false,
  }),
});

function clampInt(value, min, max, fallback) {
  const number = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function toBool(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function toName(value, fallback) {
  if (typeof value !== "string") return fallback;
  // Control characters have no place in a sender name shown by other apps
  const cleaned = Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, LIMITS.maxNameLength);
}

/**
 * Merge `input` over `base` and return a complete, valid settings object.
 * Unknown keys are dropped, missing keys keep the base value, out-of-range
 * values are clamped, and anything unusable falls back to the base value.
 */
export function validateSettings(input, base = DEFAULT_SETTINGS) {
  const raw = input && typeof input === "object" ? input : {};
  const output = raw.output && typeof raw.output === "object" ? raw.output : {};
  const server = raw.server && typeof raw.server === "object" ? raw.server : {};
  return {
    output: {
      autoStart: toBool(output.autoStart, base.output.autoStart),
      name: toName(output.name, base.output.name),
      width: clampInt(output.width, LIMITS.minSize, LIMITS.maxSize, base.output.width),
      height: clampInt(output.height, LIMITS.minSize, LIMITS.maxSize, base.output.height),
      frameRate: clampInt(
        output.frameRate,
        LIMITS.minFrameRate,
        LIMITS.maxFrameRate,
        base.output.frameRate,
      ),
      includeAlpha: toBool(output.includeAlpha, base.output.includeAlpha),
      preview: toBool(output.preview, base.output.preview),
    },
    server: {
      port: clampInt(server.port, LIMITS.minPort, LIMITS.maxPort, base.server.port),
      allowNetwork: toBool(server.allowNetwork, base.server.allowNetwork),
    },
  };
}

/** Dotted paths of the leaf values that differ between two settings objects. */
export function changedKeys(previous, next) {
  const changed = [];
  for (const section of Object.keys(next)) {
    for (const key of Object.keys(next[section])) {
      if (!previous?.[section] || previous[section][key] !== next[section][key]) {
        changed.push(`${section}.${key}`);
      }
    }
  }
  return changed;
}

/** The preset label matching a size, or "Custom". */
export function presetLabel(width, height) {
  const preset = RESOLUTION_PRESETS.find((p) => p.width === width && p.height === height);
  return preset ? preset.label : "Custom";
}

const silentLog = { info() {}, warn() {}, error() {} };

/**
 * JSON-file settings store with atomic writes (temp file + rename), so a crash
 * mid-write can never leave a half-written settings file behind.
 */
export function createSettingsStore({ filePath, fs, log = silentLog }) {
  let current = validateSettings({}, DEFAULT_SETTINGS);

  function load() {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        current = validateSettings(parsed, DEFAULT_SETTINGS);
      }
    } catch (error) {
      log.warn(`settings: could not read ${filePath} (${error.message}); using defaults`);
      current = validateSettings({}, DEFAULT_SETTINGS);
    }
    return current;
  }

  function save() {
    try {
      fs.mkdirSync(dirname(filePath), { recursive: true });
      const tmpPath = `${filePath}.tmp`;
      fs.writeFileSync(tmpPath, `${JSON.stringify(current, null, 2)}\n`);
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch (error) {
      log.warn(`settings: could not write ${filePath} (${error.message})`);
      return false;
    }
  }

  /** Apply a partial update. Returns the new settings and what changed. */
  function update(partial) {
    const previous = current;
    const next = validateSettings(partial, previous);
    const changed = changedKeys(previous, next);
    current = next;
    if (changed.length > 0) save();
    return { settings: current, previous, changed };
  }

  return {
    filePath,
    load,
    save,
    update,
    get: () => current,
  };
}
