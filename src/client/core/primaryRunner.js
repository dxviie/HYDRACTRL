/**
 * How the desktop app's own output runs sketches. That output (the /output
 * page loaded with `?primary`) is what the interface shows in the desktop
 * app instead of rendering every sketch a second time, so it runs the
 * interface's sketches itself and answers with the result (see `run` in
 * src/server/outputHub.ts).
 *
 * - Sketches run one at a time, in the order they arrive, so an `await` in
 *   one can't interleave with the next.
 * - A sketch that fails leaves the last one that worked on screen: a syntax
 *   error is turned down before anything is hushed, and after a runtime error
 *   the last working sketch runs again. A typo never reaches the screen or
 *   the VJ software.
 * - Every output gets each sketch the interface ran as a broadcast too,
 *   tagged with the id of the run that produced it; a sketch this output
 *   already ran as that run is not run twice.
 */
import { checkSketchSyntax, executeSketch } from "./sketchRunner.js";

/** How many run ids to remember for skipping their broadcasts. */
export const REMEMBERED_RUNS = 32;

function normalize(sketch) {
  return {
    setup: typeof sketch?.setup === "string" ? sketch.setup : "",
    main: typeof sketch?.main === "string" ? sketch.main : "",
  };
}

export function createPrimaryRunner({
  hydra,
  execute = executeSketch,
  checkSyntax = checkSketchSyntax,
}) {
  let lastGood = null;
  const recentRuns = [];
  let queue = Promise.resolve();

  function enqueue(task) {
    const next = queue.then(task);
    queue = next.catch(() => {});
    return next;
  }

  function remember(id) {
    recentRuns.push(id);
    if (recentRuns.length > REMEMBERED_RUNS) recentRuns.shift();
  }

  async function runGuarded(sketch) {
    const syntaxError = checkSyntax(sketch);
    if (syntaxError) return { success: false, message: syntaxError };
    const result = await execute(hydra, sketch);
    if (result.success) {
      lastGood = sketch;
      return { success: true };
    }
    // The failed run hushed the outputs: bring back what was playing
    if (lastGood) await execute(hydra, lastGood);
    return { success: false, message: result.message || "Unknown error" };
  }

  /** A sketch sent to every output; `runId` names the run it came from, if any. */
  function runSketch(sketch, { runId } = {}) {
    return enqueue(async () => {
      if (runId && recentRuns.includes(runId)) return { success: true, skipped: true };
      return runGuarded(normalize(sketch));
    });
  }

  /** A run sent to this output alone, whose result the interface waits for. */
  function run(id, sketch) {
    return enqueue(async () => {
      if (id) remember(id);
      return runGuarded(normalize(sketch));
    });
  }

  return { runSketch, run, getLastGood: () => lastGood };
}
