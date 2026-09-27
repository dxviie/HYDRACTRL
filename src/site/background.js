/**
 * The landing page backdrop: hydra sketches rendered at reduced resolution
 * behind the page, crossfading from one to the next.
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

  return {
    get index() {
      return index;
    },
    get next() {
      return next;
    },
    /** Crossfade amount, 0 (all current) to 1 (all next). */
    get mix() {
      return next === null ? 0 : easeInOut(elapsed / fadeMs);
    },
    advance(dt) {
      const events = [];
      elapsed += dt;
      if (next === null) {
        if (count > 1 && elapsed >= holdMs) {
          next = (index + 1) % count;
          elapsed = 0;
          events.push({ type: "fade", from: index, to: next });
        }
      } else if (elapsed >= fadeMs) {
        index = next;
        next = null;
        elapsed = 0;
        events.push({ type: "show", index });
      }
      return events;
    },
    /** Abandon a crossfade and hold the current sketch again. */
    cancel() {
      next = null;
      elapsed = 0;
    },
  };
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

  function run(code) {
    hydra.eval(code);
  }

  function movePad() {
    const [x, y] = padPosition(hydra.synth.time);
    win.nanoX = x;
    win.nanoY = y;
  }

  /** Render a sketch straight to the screen; `announce` tells the page it changed. */
  function show(index, announce = true) {
    run(`${usable[index].code}\n.out(o0)`);
    if (announce) onSketch(usable[index], index);
  }

  function clearSpareOutputs() {
    // Idle outputs still render every frame; keep them trivial
    const { synth } = hydra;
    for (const output of [synth.o1, synth.o2, synth.o3]) synth.solid(0, 0, 0, 0).out(output);
  }

  function startFade(from, to) {
    const { synth } = hydra;
    run(`${usable[from].code}\n.out(o1)`);
    run(`${usable[to].code}\n.out(o2)`);
    synth
      .src(synth.o1)
      .blend(synth.src(synth.o2), () => rotation.mix)
      .out(synth.o0);
    onSketch(usable[to], to);
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
    movePad();
    try {
      hydra.tick(dt);
    } catch (error) {
      // A shader that only fails at draw time: stop rather than throw every frame
      fail(error);
    }
  }

  /** Render a single frame, for a paused or reduced-motion backdrop. */
  function still() {
    if (!hydra || dead) return;
    movePad();
    try {
      hydra.tick(1);
    } catch (error) {
      fail(error);
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

  function onResize() {
    win.clearTimeout(resizeTimer);
    resizeTimer = win.setTimeout(() => {
      if (!hydra || dead) return;
      const [width, height] = backdropResolution(win.innerWidth, win.innerHeight, settings.maxSize);
      if (width === canvas.width && height === canvas.height) return;
      hydra.setResolution(width, height);
      if (!playing) still();
    }, 200);
  }

  function fail(error) {
    dead = true;
    pause();
    onError(error);
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
    isPlaying: () => playing,
    current: () => (rotation ? usable[rotation.next ?? rotation.index] : null),
  };
}
