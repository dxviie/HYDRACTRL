/**
 * OutputSyncPlugin - keeps external render heads in step with the UI.
 *
 * Every successful run on the main instance (the core emits `sketch:run`) is
 * published to the server's output socket, together with the XY-pad values
 * (`nanoX`/`nanoY`) whenever they change, and what the code overlay plugin
 * has for the outputs: its settings (`overlay:changed`), the editor as you
 * type (`overlay:editor`), the scenes and slots (`overlay:slots`) and the
 * flash of a run (`overlay:flash`). Render heads load `/output` and
 * mirror whatever is played here: the companion output app (Syphon/Spout/NDI),
 * an OBS browser source, a TouchDesigner Web Render TOP, another browser...
 *
 * The plugin stays dormant when the page is not served by the HYDRACTRL server
 * (for example on the static demo site), detected via `/api/capabilities`.
 *
 * In the desktop app, while the interface shows the Syphon/Spout output's own
 * frames (`mirror:changed`), the XY pad's moves are what you see there, so they
 * are sent every frame instead of every other one.
 */
import { createReconnectingSocket } from "../core/ReconnectingSocket.js";
import { buildOutputSocketUrl, detectOutputServer } from "../core/outputProtocol.js";

/** How often the XY-pad values are sampled for changes (ms). */
export const STATE_POLL_MS = 33;
/** The same while the desktop app shows the output's own frames (ms). */
export const MIRROR_STATE_POLL_MS = 16;
/** Minimum change on either axis before a new state message is sent. */
export const STATE_EPSILON = 1e-4;

/** True when the XY state moved enough (or there is no previous state) to be worth sending. */
export function stateChanged(previous, next, epsilon = STATE_EPSILON) {
  if (!previous) return true;
  return (
    Math.abs(previous.nanoX - next.nanoX) > epsilon ||
    Math.abs(previous.nanoY - next.nanoY) > epsilon
  );
}

/** Read the XY-pad globals the UI exposes to sketches; null when they are absent or invalid. */
export function readXyState(target = globalThis) {
  const { nanoX, nanoY } = target;
  if (!Number.isFinite(nanoX) || !Number.isFinite(nanoY)) return null;
  return { nanoX, nanoY };
}

export function createOutputSyncPlugin(options = {}) {
  return {
    id: "output-sync",
    name: "Output Sync",
    description: "Mirrors the running sketch and XY-pad values to external outputs over WebSocket",

    setup(ctx) {
      const detect = options.detect || detectOutputServer;
      const socketFactory = options.socketFactory || createReconnectingSocket;
      const url = options.url || buildOutputSocketUrl(window.location);

      let socket = null;
      let pollTimer = null;
      let outputCount = 0;
      let lastSentState = null;
      let overlay = null;
      let editorSnapshot = null;
      let slots = null;
      let pollMs = STATE_POLL_MS;
      let disposed = false;

      function currentSketch() {
        const editor = ctx.editor?._editor;
        if (editor && typeof editor.getAllCode === "function") {
          const { setup, main } = editor.getAllCode();
          return { setup: setup || "", main: main || "" };
        }
        const main = ctx.editor?.state?.doc?.toString?.();
        return typeof main === "string" ? { setup: "", main } : null;
      }

      function pushSketch(sketch) {
        if (!socket || !sketch || typeof sketch.main !== "string") return false;
        const message = { type: "sketch", setup: sketch.setup || "", main: sketch.main };
        // Ran on the desktop app's own output first, which then skips it
        if (sketch.runId) message.runId = sketch.runId;
        return socket.send(message);
      }

      function pushState(force = false) {
        if (!socket || !socket.isOpen()) return;
        const state = readXyState();
        if (!state) return;
        if (force || stateChanged(lastSentState, state)) {
          lastSentState = state;
          socket.send({ type: "state", ...state });
        }
      }

      function pushOverlay() {
        if (!socket || !overlay) return false;
        return socket.send({ type: "overlay", ...overlay });
      }

      function pushEditor() {
        if (!socket || !editorSnapshot) return false;
        return socket.send({ type: "editor", ...editorSnapshot });
      }

      function pushSlots() {
        if (!socket || !slots) return false;
        return socket.send({ type: "slots", ...slots });
      }

      function handleMessage(message) {
        if (message.type === "outputs") {
          const count = Number(message.count) || 0;
          if (count !== outputCount) {
            ctx.notify(
              count > outputCount
                ? `Output connected (${count})`
                : `Output disconnected (${count})`,
            );
            ctx.events.emit("output:count", { count });
          }
          outputCount = count;
        } else if (message.type === "output-error") {
          ctx.notify(`Output error: ${message.message}`, { type: "error" });
        }
      }

      const offRun = ctx.events.on("sketch:run", (sketch) => {
        pushSketch(sketch);
      });

      const offOverlay = ctx.events.on("overlay:changed", (settings) => {
        if (!settings || typeof settings.visible !== "boolean") return;
        const { visible, slots: showSlots, blendMode, opacity } = settings;
        overlay = { visible, slots: showSlots, blendMode, opacity };
        pushOverlay();
      });

      const offEditor = ctx.events.on("overlay:editor", (snapshot) => {
        if (!snapshot || typeof snapshot.code !== "string") return;
        editorSnapshot = snapshot;
        pushEditor();
      });

      const offSlots = ctx.events.on("overlay:slots", (state) => {
        if (!state) return;
        slots = state;
        pushSlots();
      });

      const offFlash = ctx.events.on("overlay:flash", () => {
        socket?.send({ type: "flash" });
      });

      function schedulePoll() {
        if (pollTimer !== null) clearInterval(pollTimer);
        pollTimer = setInterval(() => pushState(false), pollMs);
      }

      const offMirror = ctx.events.on("mirror:changed", ({ active } = {}) => {
        pollMs = active ? MIRROR_STATE_POLL_MS : STATE_POLL_MS;
        if (pollTimer !== null) schedulePoll();
      });

      function start() {
        if (disposed) return;
        socket = socketFactory({
          url,
          onOpen: (link) => {
            link.send({ type: "hello", role: "controller" });
            pushSketch(currentSketch());
            pushState(true);
            pushOverlay();
            pushEditor();
            pushSlots();
          },
          onMessage: handleMessage,
          onClose: () => {
            lastSentState = null;
          },
          log: (line) => console.warn(`[output-sync] ${line}`),
        });
        socket.connect();
        schedulePoll();
      }

      Promise.resolve(detect())
        .then((available) => {
          if (available) start();
          else console.info("[output-sync] no output server on this host, plugin idle");
        })
        .catch((error) => console.warn("[output-sync] detection failed:", error));

      return {
        api: {
          isConnected: () => socket !== null && socket.isOpen(),
          outputCount: () => outputCount,
          pushSketch: () => pushSketch(currentSketch()),
        },
        dispose() {
          disposed = true;
          offRun();
          offOverlay();
          offEditor();
          offSlots();
          offFlash();
          offMirror();
          if (pollTimer !== null) clearInterval(pollTimer);
          pollTimer = null;
          if (socket) socket.dispose();
          socket = null;
        },
      };
    },
  };
}
