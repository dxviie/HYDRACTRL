/**
 * Shared sketch execution, used by the main page (for the main and breakout
 * instances) and by the chrome-less output page, so every render head runs a
 * sketch exactly the same way.
 *
 * The sketch is wrapped in an async function (top-level await works) with the
 * hydra instance's functions exposed as globals, the way hydra's own editor
 * does. Errors are returned, never thrown; how they are shown is up to the
 * caller (toast on the UI, console + relay on an output).
 */

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

/** Join setup and main code the way the editor tabs expect: setup first, then main. */
export function combineSketchCode(setup = "", main = "") {
  const setupCode = typeof setup === "string" ? setup.trim() : "";
  const mainCode = typeof main === "string" ? main.trim() : "";
  return setupCode ? `${setupCode}\n\n${mainCode}` : mainCode;
}

/** The video elements a hydra instance's sources show (initVideo, initCam...). */
function sourceVideos(hydra) {
  const videos = new Set();
  for (const source of Array.isArray(hydra?.s) ? hydra.s : []) {
    const media = source?.src;
    if (media && typeof media.pause === "function") videos.add(media);
  }
  return videos;
}

/**
 * hush() drops the sources of the previous run without stopping them, and a
 * video that nothing shows keeps playing, and decoding, in the background:
 * one more for every run of a sketch that calls s0.initVideo(). Pause the
 * videos the new run doesn't show.
 */
function pauseDroppedVideos(previous, hydra) {
  const current = sourceVideos(hydra);
  for (const video of previous) {
    if (current.has(video)) continue;
    try {
      video.pause();
    } catch (_error) {
      // not a media element after all
    }
  }
}

/**
 * Wrap a sketch in an async function (top-level await works) that exposes the
 * hydra instance's functions as globals, the way hydra's own editor does.
 * Throws when the code has a syntax error; runs nothing.
 */
function buildSketchFunction(code) {
  return new AsyncFunction(
    "hydra",
    `
      // Set global h variable to hydra for convenience
      globalThis.h = hydra;
      // Make hydra functions available in global scope
      Object.keys(hydra).forEach((key) => {
        if (typeof hydra[key] === "function" && key !== "eval") {
          globalThis[key] = hydra[key].bind(hydra);
        }
      });

      // Execute the user's code
      try {
        ${code}
        return { success: true };
      } catch (e) {
        console.error("Error in Hydra code:", e);
        return {
          success: false,
          error: e,
          message: e.message || "Unknown error",
        };
      }
    `,
  );
}

/**
 * Check a sketch for syntax errors without running it or touching any hydra
 * instance, so a typo can be turned down before anything is hushed.
 * @param {{setup?: string, main?: string}} sketch
 * @returns {string | null} The error message, or null when the code parses.
 */
export function checkSketchSyntax({ setup = "", main = "" } = {}) {
  try {
    buildSketchFunction(combineSketchCode(setup, main));
    return null;
  } catch (error) {
    return (error && error.message) || "Syntax error";
  }
}

/**
 * Run a sketch on a hydra instance.
 * @param {object} hydra - A hydra-synth instance (needs `hush()` and its generator functions).
 * @param {{setup?: string, main?: string}} sketch
 * @returns {Promise<{success: true} | {success: false, message: string, error?: unknown}>}
 */
export async function executeSketch(hydra, { setup = "", main = "" } = {}) {
  const previousVideos = sourceVideos(hydra);
  try {
    // Reset all outputs so leftovers from the previous sketch don't linger
    hydra.hush();

    const code = combineSketchCode(setup, main);

    // A syntax error in the sketch throws here, at construction time
    const fn = buildSketchFunction(code);

    const result = await fn(hydra);
    if (result && result.success) return { success: true };
    return {
      success: false,
      error: result?.error,
      message: result?.message || "Unknown error",
    };
  } catch (error) {
    console.error("Error running Hydra code:", error);
    return {
      success: false,
      error,
      message: (error && error.message) || "Failed to execute Hydra code",
    };
  } finally {
    pauseDroppedVideos(previousVideos, hydra);
  }
}
