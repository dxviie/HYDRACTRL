/**
 * DesktopMirrorPlugin - in the desktop app, show the Syphon/Spout output's
 * own frames instead of rendering every sketch a second time.
 *
 * While the output runs, the app forwards every frame it shares to this
 * window as a GPU texture, and the plugin draws it where the main hydra
 * canvas was, letterboxed to the output's shape: what you see is exactly what
 * Resolume or MadMapper get. The main hydra instance stops rendering, and
 * sketches run on the output itself (a `run` on the output socket, see
 * src/server/outputHub.ts), which answers with the result, so errors still
 * show in the editor. A sketch that fails leaves the last one that worked on
 * the output.
 *
 * The interface renders on its own again, with the last sketch that worked,
 * whenever the output can't be shown: it is stopped or restarting, its page
 * isn't connected, or its frames stop coming. In a browser there is no
 * bridge and the plugin does nothing.
 */
import { createReconnectingSocket } from "../core/ReconnectingSocket.js";
import { buildOutputSocketUrl } from "../core/outputProtocol.js";
import { executeSketch } from "../core/sketchRunner.js";

/** Frames to wait for once the output is ready, so the switch never shows a stale one. */
export const SETTLE_FRAMES = 3;
/** Without a frame for this long, the interface renders on its own again. */
export const STALL_MS = 5000;
/** How long a run may take on the output before it counts as failed. */
export const RUN_TIMEOUT_MS = 10000;

/**
 * Can the output be shown in place of the main instance? It must be running,
 * this window connected to its page through the server, and that page
 * showing a sketch.
 */
export function outputReady({ outputRunning, connected, primaries }) {
  return Boolean(outputRunning && connected && primaries > 0);
}

/** Ids for runs: unique per page load, short enough for the hub. */
export function createRunIds(prefix = Math.random().toString(36).slice(2, 8)) {
  let count = 0;
  return () => `${prefix}-${++count}`;
}

/**
 * The canvas the output's frames are drawn on, in place of the main hydra
 * canvas (`localCanvas`). It takes each frame's size, so the picture is pixel
 * for pixel the one being shared, and CSS letterboxes it into the window.
 */
export function createMirrorView(localCanvas, doc = document) {
  const container = doc.getElementById("hydra-canvas");
  if (!container) return null;
  const canvas = doc.createElement("canvas");
  canvas.className = "desktop-mirror";
  canvas.hidden = true;
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    backgroundColor: "#000",
  });
  container.appendChild(canvas);
  let context = null;

  return {
    canvas,
    draw(frame) {
      const width = frame.displayWidth;
      const height = frame.displayHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context = null;
      }
      if (!context) {
        context = canvas.getContext("2d");
        // Replace the pixels, alpha included, rather than blend over the last frame
        context.globalCompositeOperation = "copy";
      }
      context.drawImage(frame, 0, 0, width, height);
    },
    /** Show the output's frames (true) or the main hydra canvas (false). */
    show(mirrored) {
      canvas.hidden = !mirrored;
      if (localCanvas) localCanvas.hidden = mirrored;
    },
    dispose() {
      if (localCanvas) localCanvas.hidden = false;
      canvas.remove();
    },
  };
}

/** The editor's code, for when no sketch has run since the page loaded. */
function editorSketch(editor) {
  const tabs = editor?._editor;
  if (tabs && typeof tabs.getAllCode === "function") {
    const { setup, main } = tabs.getAllCode();
    return { setup: setup || "", main: main || "" };
  }
  const main = editor?.state?.doc?.toString?.();
  return { setup: "", main: typeof main === "string" ? main : "" };
}

export function createDesktopMirrorPlugin(options = {}) {
  return {
    id: "desktop-mirror",
    name: "Desktop Mirror",
    description:
      "Shows the Syphon/Spout output's own frames in the desktop app instead of rendering twice",

    setup(ctx) {
      const bridge =
        options.bridge !== undefined
          ? options.bridge
          : typeof window !== "undefined"
            ? window.hydractrlDesktop
            : undefined;
      if (!bridge?.mirror || ctx.isMobile) return;
      if (!ctx.renderLoop || typeof ctx.setSketchRunner !== "function") return;
      const view = options.view !== undefined ? options.view : createMirrorView(ctx.hydra?.canvas);
      if (!view) return;

      const socketFactory = options.socketFactory || createReconnectingSocket;
      const url = options.url || buildOutputSocketUrl(window.location);
      const execute = options.execute || executeSketch;
      const now = options.now || (() => Date.now());
      // Wrapped: the browser's timer functions refuse to be called as methods of another object
      const timers = options.timers || {
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearInterval: (id) => clearInterval(id),
      };
      const nextRunId = options.runIds || createRunIds();

      let outputRunning = false;
      let connected = false;
      let primaries = 0;
      let active = false;
      let framesSinceReady = 0;
      let framesDrawn = 0;
      let frameSize = null;
      let lastFrameAt = 0;
      let lastGood = null;
      let drawErrorLogged = false;
      let disposed = false;
      const pending = new Map();

      function ready() {
        return outputReady({ outputRunning, connected, primaries });
      }

      function activate() {
        if (active || disposed) return;
        active = true;
        ctx.setSketchRunner(runOnOutput);
        ctx.renderLoop.stop();
        view.show(true);
        // Let go of what the main instance was showing: cameras, playing videos
        execute(ctx.hydra, { setup: "", main: "" });
        console.info("[desktop-mirror] showing the output's frames");
        ctx.events.emit("mirror:changed", { active: true });
      }

      /** Render on the main instance again, with the last sketch that worked unless told otherwise. */
      function deactivate(reason, { restore = true } = {}) {
        if (!active) return;
        active = false;
        framesSinceReady = 0;
        ctx.setSketchRunner(null);
        view.show(false);
        if (restore) execute(ctx.hydra, lastGood ?? editorSketch(ctx.editor));
        ctx.renderLoop.start();
        console.info(`[desktop-mirror] rendering here again: ${reason}`);
        ctx.events.emit("mirror:changed", { active: false });
      }

      function update(reason) {
        if (ready()) return;
        framesSinceReady = 0;
        deactivate(reason);
      }

      function onFrame(frame) {
        if (disposed) {
          frame?.close?.();
          return;
        }
        try {
          view.draw(frame);
          framesDrawn += 1;
          frameSize = { width: frame.displayWidth, height: frame.displayHeight };
          lastFrameAt = now();
        } catch (error) {
          if (!drawErrorLogged) {
            drawErrorLogged = true;
            console.warn("[desktop-mirror] could not draw the output's frame:", error);
          }
          return;
        } finally {
          frame?.close?.();
        }
        if (!ready()) return;
        framesSinceReady += 1;
        if (!active && framesSinceReady >= SETTLE_FRAMES) activate();
      }

      function settle(id, result) {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        timers.clearTimeout(entry.timer);
        entry.resolve(result);
      }

      function failPending(message) {
        for (const id of [...pending.keys()]) {
          settle(id, { success: false, message, reason: "no-output" });
        }
      }

      /** The main instance's sketch runner while the output is shown. */
      async function runOnOutput(sketch) {
        const id = nextRunId();
        const result = await new Promise((resolve) => {
          const timer = timers.setTimeout(
            () =>
              settle(id, {
                success: false,
                message: "The output didn't answer in time",
                reason: "timeout",
              }),
            RUN_TIMEOUT_MS,
          );
          pending.set(id, { resolve, timer });
          const sent =
            socket?.send({ type: "run", id, setup: sketch.setup, main: sketch.main }) ?? false;
          if (!sent) {
            settle(id, { success: false, message: "Not connected", reason: "no-output" });
          }
        });
        if (result.reason === "no-output") {
          // The output is gone: render here again and run the sketch here
          deactivate("the output went away", { restore: false });
          return execute(ctx.hydra, sketch);
        }
        if (result.success) return { success: true, runId: id };
        return { success: false, message: result.message || "The output couldn't run the sketch" };
      }

      function handleMessage(message) {
        if (message.type === "outputs") {
          primaries = Number(message.primaries) || 0;
          update("the output's page isn't connected");
        } else if (message.type === "result" && typeof message.id === "string") {
          settle(message.id, message);
        }
      }

      const socket = socketFactory({
        url,
        onOpen: (link) => {
          link.send({ type: "hello", role: "controller" });
          connected = true;
        },
        onMessage: handleMessage,
        onClose: () => {
          connected = false;
          primaries = 0;
          failPending("Lost the connection to the output");
          update("lost the connection to the server");
        },
        log: (line) => console.warn(`[desktop-mirror] ${line}`),
      });
      socket.connect();

      function applyState(state) {
        outputRunning = state?.output?.state === "running";
        update("the output stopped");
      }
      const unsubscribe = bridge.onState(applyState);
      bridge
        .getState()
        .then(applyState)
        .catch((error) => console.warn("[desktop-mirror] could not read state:", error));

      const offRun = ctx.events.on("sketch:run", (sketch) => {
        lastGood = { setup: sketch?.setup || "", main: sketch?.main || "" };
      });

      const stallTimer = timers.setInterval(() => {
        if (active && now() - lastFrameAt > STALL_MS) deactivate("the output's frames stopped");
      }, 1000);

      Promise.resolve()
        .then(() => bridge.mirror.start(onFrame))
        .catch((error) => console.warn("[desktop-mirror] could not receive the output:", error));

      return {
        api: {
          isActive: () => active,
          getStatus: () => ({
            active,
            outputRunning,
            connected,
            primaries,
            framesDrawn,
            frameSize,
          }),
        },
        dispose() {
          disposed = true;
          Promise.resolve()
            .then(() => bridge.mirror.stop())
            .catch(() => {});
          unsubscribe?.();
          offRun();
          timers.clearInterval(stallTimer);
          failPending("Stopped");
          deactivate("the mirror was turned off");
          socket.dispose();
          view.dispose();
        },
      };
    },
  };
}
