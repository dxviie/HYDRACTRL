/**
 * Output manager: owns the texture-sharing bridge (Syphon on macOS, Spout on
 * Windows) that renders the /output page offscreen and publishes every frame.
 *
 * It turns the bridge's events into one status object for the UI and the
 * menu, applies settings changes with the least disruption (resize in place,
 * restart only when the sender must be recreated), recovers from a crashed
 * render process, and keeps the display awake while output is running.
 *
 * The bridge factory is injected: the real one loads the native module, the
 * tests pass a fake.
 */
import { describeError } from "./log.js";

export const OUTPUT_STATE = Object.freeze({
  stopped: "stopped",
  starting: "starting",
  running: "running",
  error: "error",
});

/** Settings that require recreating the sender when they change. */
const RESTART_KEYS = ["name", "frameRate", "includeAlpha"];

/** Make bridge errors readable for non-developers. */
export function friendlyOutputError(error) {
  const message = typeof error === "string" ? error : error?.message || String(error);
  if (/ERR_CONNECTION_REFUSED|ERR_FAILED|ERR_CONNECTION_RESET/.test(message)) {
    return "The output page could not be loaded from the HYDRACTRL server.";
  }
  if (
    /name|already|exists|collision/i.test(message) &&
    /sender|server|syphon|spout/i.test(message)
  ) {
    return `Another sender already uses this name (${message}).`;
  }
  return message;
}

const defaultTimers = { setTimeout, clearTimeout };

export function createOutputManager({
  createBridge,
  availability,
  getRendererUrl,
  getSettings,
  onStatus = () => {},
  onPreviewClosed = () => {},
  log,
  powerSaveBlocker = null,
  timers = defaultTimers,
  now = () => Date.now(),
  crashRestartLimit = 3,
  crashWindowMs = 60000,
}) {
  const status = {
    available: availability.available,
    protocol: availability.protocol,
    unavailableReason: availability.reason,
    state: OUTPUT_STATE.stopped,
    name: null,
    width: null,
    height: null,
    frameRate: null,
    includeAlpha: false,
    fps: null,
    droppedFrames: 0,
    lastDropReason: null,
    error: null,
    previewOpen: false,
    since: null,
  };

  let bridge = null;
  let generation = 0;
  let blockerId = null;
  let dropEmitTimer = null;
  let crashTimes = [];
  let disposed = false;

  function getStatus() {
    return { ...status };
  }

  function emit() {
    onStatus(getStatus());
  }

  function set(patch) {
    Object.assign(status, patch);
    emit();
  }

  function keepAwake() {
    if (!powerSaveBlocker || blockerId !== null) return;
    try {
      blockerId = powerSaveBlocker.start("prevent-display-sleep");
    } catch (error) {
      log.warn(`could not block display sleep: ${describeError(error)}`);
    }
  }

  function allowSleep() {
    if (!powerSaveBlocker || blockerId === null) return;
    try {
      powerSaveBlocker.stop(blockerId);
    } catch (_error) {
      // nothing to do
    }
    blockerId = null;
  }

  function isPreviewOpen(current = bridge) {
    const preview = current?.previewWindow;
    return Boolean(
      preview && !(typeof preview.isDestroyed === "function" && preview.isDestroyed()),
    );
  }

  function watchPreview(current) {
    const preview = current.previewWindow;
    if (!preview || typeof preview.once !== "function") return;
    preview.once("closed", () => {
      if (bridge !== current) return;
      set({ previewOpen: false });
      onPreviewClosed();
    });
  }

  function scheduleDropEmit() {
    if (dropEmitTimer !== null) return;
    dropEmitTimer = timers.setTimeout(() => {
      dropEmitTimer = null;
      emit();
    }, 500);
  }

  function handleCrash(current, reason) {
    if (bridge !== current) return;
    const time = now();
    crashTimes = crashTimes.filter((t) => time - t < crashWindowMs);
    crashTimes.push(time);
    if (crashTimes.length > crashRestartLimit) {
      log.error(`output ${reason}; it keeps crashing, stopping it`);
      stop();
      set({ state: OUTPUT_STATE.error, error: `The output ${reason} repeatedly. Stopped.` });
      return;
    }
    log.warn(`output ${reason}; restarting`);
    restart();
  }

  function hook(current) {
    current.on("fps", (fps) => {
      if (bridge !== current) return;
      set({ fps: Math.round(fps * 10) / 10 });
    });
    current.on("frameDropped", (defect) => {
      if (bridge !== current) return;
      status.droppedFrames += 1;
      status.lastDropReason = defect?.reason || "unknown";
      scheduleDropEmit();
    });
    current.on("error", (error) => {
      if (bridge !== current) return;
      log.warn(`output error: ${describeError(error)}`);
      set({ error: friendlyOutputError(error) });
    });
    const contents = current.renderWindow?.webContents;
    if (contents && typeof contents.on === "function") {
      contents.on("render-process-gone", (_event, details) => {
        handleCrash(current, `render process gone (${details?.reason || "unknown"})`);
      });
      contents.on("unresponsive", () => {
        log.warn("output render process is unresponsive");
      });
    }
    watchPreview(current);
  }

  async function start() {
    if (disposed) return false;
    if (!status.available) {
      set({ state: OUTPUT_STATE.error, error: status.unavailableReason });
      return false;
    }
    if (status.state === OUTPUT_STATE.running || status.state === OUTPUT_STATE.starting)
      return true;

    const url = getRendererUrl();
    if (!url) {
      set({ state: OUTPUT_STATE.error, error: "The HYDRACTRL server is not running yet." });
      return false;
    }

    const settings = getSettings();
    const token = ++generation;
    set({
      state: OUTPUT_STATE.starting,
      error: null,
      fps: null,
      droppedFrames: 0,
      lastDropReason: null,
      name: settings.name,
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      includeAlpha: settings.includeAlpha,
      previewOpen: false,
      since: null,
    });
    log.info(
      `starting ${status.protocol} output "${settings.name}" ${settings.width}x${settings.height} @ ${settings.frameRate} fps`,
    );

    let created;
    try {
      created = await createBridge({
        name: settings.name,
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        includeAlpha: settings.includeAlpha,
        rendererUrl: `${url}/output`,
        preview: { enabled: settings.preview, title: "HYDRACTRL Output Preview" },
        webPreferences: { backgroundThrottling: false },
      });
    } catch (error) {
      log.error(`output failed to start: ${describeError(error)}`);
      if (token === generation)
        set({ state: OUTPUT_STATE.error, error: friendlyOutputError(error) });
      return false;
    }

    if (token !== generation || disposed) {
      // stop() or a newer start() won the race while we were loading
      try {
        created.dispose();
      } catch (_error) {
        // ignore
      }
      return false;
    }

    bridge = created;
    hook(created);
    keepAwake();
    set({ state: OUTPUT_STATE.running, since: now(), previewOpen: isPreviewOpen(created) });
    log.info("output running");
    return true;
  }

  function stop() {
    generation += 1;
    const current = bridge;
    bridge = null;
    if (dropEmitTimer !== null) {
      timers.clearTimeout(dropEmitTimer);
      dropEmitTimer = null;
    }
    if (current) {
      try {
        current.dispose();
      } catch (error) {
        log.warn(`output dispose failed: ${describeError(error)}`);
      }
      log.info("output stopped");
    }
    allowSleep();
    set({ state: OUTPUT_STATE.stopped, fps: null, since: null, previewOpen: false, error: null });
  }

  async function restart() {
    stop();
    return start();
  }

  async function toggle() {
    if (status.state === OUTPUT_STATE.running || status.state === OUTPUT_STATE.starting) {
      stop();
      return false;
    }
    return start();
  }

  /**
   * React to changed output settings. `changed` holds dotted keys such as
   * "output.width" (see settings.changedKeys); only the output section matters.
   */
  async function applySettings(next, changed) {
    const keys = changed
      .filter((k) => k.startsWith("output."))
      .map((k) => k.slice("output.".length));
    if (keys.length === 0) return;

    if (status.state !== OUTPUT_STATE.running) {
      if (status.state === OUTPUT_STATE.stopped || status.state === OUTPUT_STATE.error) {
        set({
          name: next.name,
          width: next.width,
          height: next.height,
          frameRate: next.frameRate,
          includeAlpha: next.includeAlpha,
        });
      }
      return;
    }

    if (keys.some((k) => RESTART_KEYS.includes(k))) {
      log.info(`output settings changed (${keys.join(", ")}); restarting output`);
      await restart();
      return;
    }

    if (keys.includes("width") || keys.includes("height")) {
      try {
        bridge.resize(next.width, next.height);
        set({ width: next.width, height: next.height, droppedFrames: 0, lastDropReason: null });
        log.info(`output resized to ${next.width}x${next.height}`);
      } catch (error) {
        log.warn(`output resize failed (${describeError(error)}); restarting output`);
        await restart();
        return;
      }
    }

    if (keys.includes("preview")) {
      try {
        if (next.preview) {
          bridge.openPreview();
          watchPreview(bridge);
        } else {
          bridge.closePreview();
        }
        set({ previewOpen: isPreviewOpen() });
      } catch (error) {
        log.warn(`preview toggle failed: ${describeError(error)}`);
      }
    }
  }

  function dispose() {
    disposed = true;
    stop();
  }

  return { start, stop, restart, toggle, applySettings, getStatus, dispose };
}
