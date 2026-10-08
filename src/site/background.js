/**
 * The landing page backdrop: hydra sketches rendered at reduced resolution
 * behind the hero, crossfading from one to the next. The hero's code panel
 * can take over: `hold()` stops the rotation on the current sketch,
 * `perform(code)` runs the visitor's own program, and `resume()` puts the
 * rotation back the way it was.
 *
 * Kept deliberately cheap: at most ~960 px on the long side (the canvas is
 * stretched by CSS), 30 fps, and no rendering at all while paused or while
 * the tab is hidden. Everything browser- and hydra-specific is injected so
 * the scheduling logic can be tested without WebGL.
 */

export const DEFAULTS = Object.freeze({
  holdMs: 22000,
  fadeMs: 4000,
  fps: 30,
  speed: 0.6,
  maxSize: 960,
});

/** Canvas size for a viewport: half resolution, capped on the long side. */
export function backdropResolution(width, height, maxSize = DEFAULTS.maxSize) {
  const w = Math.max(1, width || 1);
  const h = Math.max(1, height || 1);
  const scale = Math.min(0.5, maxSize / Math.max(w, h));
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
}

/**
 * Where the backdrop's imaginary XY pad is at hydra time `time`: a slow drift
 * around the centre, for sketches that read nanoX and nanoY.
 */
export function padPosition(time) {
  return [0.5 + 0.28 * Math.sin(time * 0.17), 0.5 + 0.28 * Math.sin(time * 0.13 + 1.7)];
}

/** Smooth start and end for crossfades (0..1 in, 0..1 out). */
export function easeInOut(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Pure rotation state machine: which sketch is showing and how far a
 * crossfade has progressed. `advance(dt)` returns the events the renderer
 * has to act on.
 */
export function createRotation({ count, holdMs = DEFAULTS.holdMs, fadeMs = DEFAULTS.fadeMs }) {
  let index = 0;
  let next = null;
  let elapsed = 0;
  let held = false;

  return {
    get index() {
      return index;
    },
    get next() {
      return next;
    },
    get held() {
      return held;
    },
    /** Crossfade amount, 0 (all current) to 1 (all next). */
    get mix() {
      return next === null ? 0 : easeInOut(elapsed / fadeMs);
    },
    advance(dt) {
      const events = [];
      if (next === null) {
        // Held: the current sketch stays, however long
        if (held) return events;
        elapsed += dt;
        if (count > 1 && elapsed >= holdMs) {
          next = (index + 1) % count;
          elapsed = 0;
          events.push({ type: "fade", from: index, to: next });
        }
      } else {
        elapsed += dt;
        if (elapsed >= fadeMs) {
          index = next;
          next = null;
          elapsed = 0;
          events.push({ type: "show", index });
        }
      }
      return events;
    },
    /** Abandon a crossfade and hold the current sketch again. */
    cancel() {
      next = null;
      elapsed = 0;
    },
    /** Jump to the end of a running crossfade. Returns whether there was one. */
    finish() {
      if (next === null) return false;
      index = next;
      next = null;
      elapsed = 0;
      return true;
    },
    /** Start no new crossfades; one already running still completes. */
    hold() {
      held = true;
    },
    /** Rotate again, after a full hold on the current sketch. */
    release() {
      held = false;
      elapsed = 0;
    },
  };
}

/** Stop a camera, screen or video source the visitor's code started. */
function stopMedia(media) {
  try {
    for (const track of media?.srcObject?.getTracks?.() || []) track.stop();
    if (typeof media?.pause === "function") media.pause();
  } catch (_error) {
    // Already gone
  }
}

/**
 * Wires a rotation to a hydra instance and a canvas. `loadHydra` resolves to
 * the hydra-synth constructor; sketches that fail to compile are dropped.
 */
export function createBackground({
  canvas,
  sketches,
  loadHydra,
  win = window,
  options = {},
  onSketch = () => {},
  onReady = () => {},
  onError = () => {},
  onCodeError = () => {},
}) {
  const settings = { ...DEFAULTS, ...options };
  const frameInterval = 1000 / settings.fps;
  let usable = [];
  let rotation = null;
  let hydra = null;
  let playing = false;
  let frame = 0;
  let last = 0;
  let pending = 0;
  let resizeTimer = null;
  let dead = false;
  /** hydra's user settings as the backdrop set them, restored by resume() */
  let globals = null;
  /** hydra's sources as they were when the rotation was held */
  let sources = [];
  /** The visitor's program while it runs (it has drawn a frame), else null */
  let program = null;

  function run(code) {
    hydra.eval(code);
  }

  function movePad() {
    const [x, y] = padPosition(hydra.synth.time);
    win.nanoX = x;
    win.nanoY = y;
  }

  /** Draw one frame. Throws when a shader fails to compile. */
  function render(dt) {
    movePad();
    hydra.tick(dt);
  }

  /**
   * Draw a frame of the visitor's program. hydra catches an error thrown by
   * a uniform's function, osc(() => oops), and only warns "ERROR" with it,
   * every frame; here that warning fails the frame like a shader would.
   */
  function renderChecked(dt) {
    const log = win.console;
    if (!log) {
      render(dt);
      return;
    }
    const warn = log.warn;
    let caught = null;
    log.warn = (...args) => {
      if (args[0] === "ERROR" && caught === null) caught = args[1];
      else warn.apply(log, args);
    };
    try {
      render(dt);
    } finally {
      log.warn = warn;
    }
    if (caught !== null) throw caught instanceof Error ? caught : new Error(String(caught));
  }

  /** The frame the loop draws: checked while the visitor's program plays. */
  function draw(dt) {
    if (program === null) render(dt);
    else renderChecked(dt);
  }

  /** Render a sketch straight to the screen; `announce` tells the page it changed. */
  function show(index, announce = true) {
    run(`${usable[index].code}\n.out(o0)`);
    if (announce) onSketch(usable[index], index, usable.length);
  }

  function clearSpareOutputs() {
    // Idle outputs still render every frame; keep them trivial
    const { synth } = hydra;
    for (const output of [synth.o1, synth.o2, synth.o3]) synth.solid(0, 0, 0, 0).out(output);
  }

  /** Show o0 alone again, with nothing left running on the other outputs. */
  function resetOutputs() {
    hydra.synth.render(hydra.synth.o0);
    clearSpareOutputs();
  }

  function startFade(from, to) {
    const { synth } = hydra;
    run(`${usable[from].code}\n.out(o1)`);
    run(`${usable[to].code}\n.out(o2)`);
    synth
      .src(synth.o1)
      .blend(synth.src(synth.o2), () => rotation.mix)
      .out(synth.o0);
    onSketch(usable[to], to, usable.length);
  }

  function apply(events) {
    for (const event of events) {
      try {
        if (event.type === "fade") {
          startFade(event.from, event.to);
        } else {
          // Already announced when the fade started
          show(event.index, false);
          clearSpareOutputs();
        }
      } catch (error) {
        console.warn("[backdrop] sketch failed:", error);
        rotation.cancel();
        show(rotation.index);
      }
    }
  }

  /** Put the rotation's current sketch back on screen. False if even that fails. */
  function restoreSketch() {
    try {
      resetOutputs();
      show(rotation.index, false);
      render(1);
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  /** Back to the last program that drew: the visitor's previous one, or the sketch. */
  function revert() {
    if (program !== null) {
      try {
        resetOutputs();
        run(program);
        render(1);
        return;
      } catch (_error) {
        program = null;
      }
    }
    restoreSketch();
  }

  /**
   * A frame failed to draw. The visitor's program gives way to the sketch
   * and the page hears why; a sketch of our own that fails stops the backdrop.
   */
  function recover(error) {
    if (program === null) {
      fail(error);
      return;
    }
    program = null;
    if (restoreSketch()) onCodeError(error);
  }

  function tick(now) {
    frame = win.requestAnimationFrame(tick);
    if (!last) {
      last = now;
      return;
    }
    // Clamp long gaps (a background tab, a debugger pause) to keep motion smooth
    pending += Math.min(now - last, 250);
    last = now;
    if (pending < frameInterval - 2) return;
    const dt = pending;
    pending = 0;
    apply(rotation.advance(dt));
    try {
      draw(dt);
    } catch (error) {
      // A shader that only fails at draw time: never throw every frame
      recover(error);
    }
  }

  /** Render a single frame, for a paused or reduced-motion backdrop. */
  function still() {
    if (!hydra || dead) return;
    try {
      draw(1);
    } catch (error) {
      recover(error);
    }
  }

  function play() {
    if (!hydra || dead || playing) return;
    playing = true;
    last = 0;
    pending = 0;
    frame = win.requestAnimationFrame(tick);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    win.cancelAnimationFrame(frame);
  }

  /** Match the canvas to the window. Returns whether its size changed. */
  function fit() {
    const [width, height] = backdropResolution(win.innerWidth, win.innerHeight, settings.maxSize);
    if (width === canvas.width && height === canvas.height) return false;
    hydra.setResolution(width, height);
    return true;
  }

  function onResize() {
    win.clearTimeout(resizeTimer);
    resizeTimer = win.setTimeout(() => {
      if (!hydra || dead) return;
      if (fit() && !playing) still();
    }, 200);
  }

  function fail(error) {
    dead = true;
    pause();
    onError(error);
  }

  /** Stop rotating: the current sketch stays until resume(). */
  function hold() {
    if (!rotation || dead || rotation.held) return;
    rotation.hold();
    sources = (hydra.s || []).map((source) => ({
      source,
      src: source.src,
      tex: source.tex,
      dynamic: source.dynamic,
    }));
  }

  /**
   * Run the visitor's program: a full hydra sketch ending in `.out()`. It
   * holds the rotation and has to draw a frame before it counts; until it
   * does, the previous visuals stay. Returns `{ ok }` or `{ ok: false, error }`.
   */
  function perform(code) {
    if (!hydra || dead || !rotation) {
      return { ok: false, error: new Error("The backdrop is not running") };
    }
    hold();
    // Mid-crossfade, land on the incoming sketch first: its code is the one on show
    if (rotation.finish()) {
      show(rotation.index, false);
      clearSpareOutputs();
    }
    try {
      run(code);
    } catch (error) {
      // Lines before the error did run; make sure what they left still draws
      try {
        renderChecked(1);
      } catch (_drawError) {
        revert();
      }
      return { ok: false, error };
    }
    try {
      renderChecked(1);
    } catch (error) {
      revert();
      return { ok: false, error };
    }
    program = code;
    return { ok: true };
  }

  /** Back to the rotation, undoing what the visitor's code changed in hydra. */
  function resume() {
    if (!rotation || dead || !rotation.held) return;
    program = null;
    Object.assign(win, globals, { speed: settings.speed });
    for (const { source, src, tex, dynamic } of sources) {
      if (source.src === src) continue;
      stopMedia(source.src);
      Object.assign(source, { src, tex, dynamic });
    }
    sources = [];
    fit();
    // A crossfade still running lands on its sketch, the one the panel shows
    rotation.finish();
    rotation.release();
    restoreSketch();
  }

  /** Drop sketches that do not compile, by rendering each once into o3. */
  function compiles(sketch) {
    try {
      run(`${sketch.code}\n.out(o3)`);
      return true;
    } catch (error) {
      console.warn(`[backdrop] "${sketch.name}" does not compile, leaving it out:`, error);
      return false;
    }
  }

  async function start() {
    try {
      // hydra-synth expects a Node-style global
      if (typeof win.global === "undefined") win.global = win;
      const Hydra = await loadHydra();
      const [width, height] = backdropResolution(win.innerWidth, win.innerHeight, settings.maxSize);
      canvas.width = width;
      canvas.height = height;
      hydra = new Hydra({
        canvas,
        width,
        height,
        autoLoop: false,
        detectAudio: false,
        enableStreamCapture: false,
        makeGlobal: true,
      });
      // With makeGlobal, hydra reads user settings back from window every tick
      win.speed = settings.speed;
      globals = { fps: win.fps, bpm: win.bpm, update: win.update };
      // Start somewhere into the sketches, so a still frame is not frame zero
      hydra.synth.time = settings.startTime ?? 6 + Math.random() * 30;
      movePad();
      for (const sketch of sketches) {
        if (!sketch.setup) continue;
        try {
          run(sketch.setup);
        } catch (error) {
          console.warn(`[backdrop] setup of "${sketch.name}" failed:`, error);
        }
      }
      usable = sketches.filter(compiles);
      if (usable.length === 0) throw new Error("no backdrop sketch compiles");
      rotation = createRotation({
        count: usable.length,
        holdMs: settings.holdMs,
        fadeMs: settings.fadeMs,
      });
      clearSpareOutputs();
      show(rotation.index);
      canvas.addEventListener("webglcontextlost", () => fail(new Error("WebGL context lost")));
      win.addEventListener("resize", onResize);
      still();
      // The first frame can still fail (a shader the GPU rejects)
      if (dead) return false;
      onReady();
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  return {
    start,
    play,
    pause,
    still,
    hold,
    perform,
    resume,
    isPlaying: () => playing,
    isHeld: () => Boolean(rotation?.held),
    current: () => (rotation ? usable[rotation.next ?? rotation.index] : null),
  };
}
