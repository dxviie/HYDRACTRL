/**
 * HYDRACTRL output page (/output): a chrome-less render head.
 *
 * Runs one full-window hydra instance and mirrors whatever the HYDRACTRL UI
 * plays, received over the server's output socket: the sketch on every run
 * and the XY-pad values. Meant to be captured by the companion output app
 * (Syphon/Spout/NDI), an OBS browser source, a TouchDesigner Web Render TOP,
 * or simply opened on a second screen.
 *
 * A `#sketch=` fragment (the Alt/Opt+U share-link format) runs immediately on
 * load, so the page also works standalone or on a static host.
 */
import { createReconnectingSocket } from "./core/ReconnectingSocket.js";
import { buildOutputSocketUrl, detectOutputServer } from "./core/outputProtocol.js";
import { executeSketch } from "./core/sketchRunner.js";
import { readSketchFromHash } from "./plugins/UrlSharePlugin.js";

// hydra-synth expects a Node-style global
if (typeof window.global === "undefined") {
  window.global = window;
}

// XY-pad values, mirrored from the UI (same globals sketches read there)
window.nanoX = 0.5;
window.nanoY = 0.5;

// Same instance options as the main page, so sketches behave identically
const HYDRA_OPTIONS = {
  detectAudio: true,
  enableStreamCapture: false,
  numBins: 6,
  numSources: 4,
  precision: "mediump",
};

const statusElement = () => document.getElementById("output-status");

function setStatus(text) {
  document.title = text ? `HYDRACTRL Output · ${text}` : "HYDRACTRL Output";
  const element = statusElement();
  if (element) element.textContent = `HYDRACTRL output · ${text}`;
}

/** The overlay is only for the black screen before the first sketch; gone for good after. */
function clearStatus() {
  document.title = "HYDRACTRL Output";
  statusElement()?.remove();
}

async function initHydra() {
  const container = document.getElementById("hydra-canvas");
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth || 1280;
  canvas.height = window.innerHeight || 720;
  container.innerHTML = "";
  container.appendChild(canvas);

  const hydraModule = await import("hydra-synth");
  const HydraSynth = hydraModule.default || hydraModule;
  const hydra = new HydraSynth({ canvas, ...HYDRA_OPTIONS });

  window.addEventListener("resize", () => {
    hydra.setResolution(window.innerWidth, window.innerHeight);
  });
  return hydra;
}

async function init() {
  try {
    const hydra = await initHydra();
    window.mainHydra = hydra;

    const { P5Wrapper } = await import("./p5-wrapper.ts");
    window.P5 = P5Wrapper;

    // Regular browsers keep an AudioContext suspended until a user gesture;
    // the companion app allows autoplay, so this only matters for plain tabs.
    const resumeAudio = () => {
      const context = window.a?.context;
      if (context && context.state === "suspended") context.resume().catch(() => {});
    };
    document.addEventListener("pointerdown", resumeAudio);
    document.addEventListener("keydown", resumeAudio);

    let socket = null;
    let hasRunSketch = false;

    async function run(sketch) {
      const result = await executeSketch(hydra, sketch);
      if (result.success) {
        hasRunSketch = true;
        clearStatus();
        console.log("[output] sketch running");
      } else {
        console.error("[output] sketch failed:", result.message);
        if (socket) socket.send({ type: "error", message: result.message });
      }
      return result;
    }

    const urlSketch = readSketchFromHash(window.location.hash);
    if (urlSketch !== null) {
      await run({ setup: "", main: urlSketch });
    }

    socket = createReconnectingSocket({
      url: buildOutputSocketUrl(window.location),
      onOpen: (link) => {
        link.send({ type: "hello", role: "output" });
        if (!hasRunSketch) setStatus("connected, waiting for a sketch");
      },
      onMessage: (message) => {
        if (message.type === "sketch") {
          run({ setup: message.setup, main: message.main });
        } else if (message.type === "state") {
          if (typeof message.nanoX === "number") window.nanoX = message.nanoX;
          if (typeof message.nanoY === "number") window.nanoY = message.nanoY;
        }
      },
      onClose: () => {
        if (!hasRunSketch) setStatus("waiting for HYDRACTRL");
      },
      log: (line) => console.warn(`[output] ${line}`),
    });

    window.hydractrlOutput = { hydra, socket, run };

    if (await detectOutputServer()) {
      if (!hasRunSketch) setStatus("waiting for HYDRACTRL");
      socket.connect();
    } else if (!hasRunSketch) {
      setStatus("no HYDRACTRL server on this host, open with a #sketch= link");
    }
  } catch (error) {
    console.error("[output] failed to start:", error);
    setStatus(`failed to start: ${error.message || error}`);
  }
}

document.addEventListener("DOMContentLoaded", init);
