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

/**
 * Run a sketch on a hydra instance.
 * @param {object} hydra - A hydra-synth instance (needs `hush()` and its generator functions).
 * @param {{setup?: string, main?: string}} sketch
 * @returns {Promise<{success: true} | {success: false, message: string, error?: unknown}>}
 */
export async function executeSketch(hydra, { setup = "", main = "" } = {}) {
  try {
    // Reset all outputs so leftovers from the previous sketch don't linger
    hydra.hush();

    const code = combineSketchCode(setup, main);

    // A syntax error in the sketch throws here, at construction time
    const fn = new AsyncFunction(
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
  }
}
