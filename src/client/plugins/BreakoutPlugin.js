/**
 * BreakoutPlugin - full-size output in a separate window.
 *
 * Wires the size dropdown + Open/Close button in the stats panel, opens a
 * popup with its own hydra-synth instance and mirrors the sketch into it.
 * The core run path keeps mirroring code into the breakout via the
 * `window.breakoutHydra` / `window.breakoutWindow` globals this plugin sets.
 */

const SIZE_KEY = "hydractrl-breakout-size";

/** Pure helper: window.open feature string for a breakout window. */
export function buildWindowFeatures(width = 1280, height = 720) {
  return `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes`;
}

/** Pure helper: the width and height in a size value such as "1280x720". */
export function parseSize(value) {
  const match = /^(\d+)x(\d+)$/.exec(String(value ?? ""));
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

const BREAKOUT_HTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HYDRACTRL Breakout</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          overflow: hidden;
          width: 100%;
          height: 100%;
          background-color: #000;
        }

        #hydra-canvas-breakout {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 0;
          left: 0;
        }
      </style>
    </head>
    <body>
      <div id="hydra-canvas-breakout"></div>
    </body>
    </html>
  `;

export function createBreakoutPlugin() {
  return {
    id: "breakout-view",
    name: "Breakout View",
    description: "Opens the visualization in a separate window at a chosen resolution",

    setup(ctx) {
      const display = ctx.getPanels().stats?.display;
      if (ctx.isMobile || !display || !display.sizeSelect) return;
      const select = display.sizeSelect;

      // Offer the size used last time
      const savedSize = ctx.storage.get(SIZE_KEY);
      if ([...select.options].some((option) => option.value === savedSize)) {
        select.value = savedSize;
      }

      function selectedSize() {
        const size = parseSize(select.value);
        if (!size) return null;
        const label = select.selectedOptions[0]?.textContent || `${size.width}×${size.height}`;
        return { ...size, label };
      }

      function openBreakoutWindow(width, height) {
        const breakoutWindow = window.open("", "HydraBreakout", buildWindowFeatures(width, height));

        if (!breakoutWindow) {
          ctx.notify("Could not open breakout window. Please check your popup blocker settings.", {
            type: "error",
          });
          return null;
        }

        breakoutWindow.document.write(BREAKOUT_HTML);
        breakoutWindow.document.close();

        return breakoutWindow;
      }

      async function initBreakoutHydra(breakoutWindow) {
        if (!breakoutWindow || !breakoutWindow.document) {
          throw new Error("Invalid breakout window");
        }

        // Get or create the canvas element in the breakout window
        const canvasContainer = breakoutWindow.document.getElementById("hydra-canvas-breakout");
        const canvas = breakoutWindow.document.createElement("canvas");
        canvas.width = breakoutWindow.innerWidth || 500;
        canvas.height = breakoutWindow.innerHeight || 400;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvasContainer.innerHTML = "";
        canvasContainer.appendChild(canvas);

        // Ensure we have the buffer ready for WebGL to use
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Dynamically import hydra-synth in the main window
        const hydraModule = await import("hydra-synth");
        const HydraSynth = hydraModule.default || hydraModule;

        const breakoutHydra = new HydraSynth({
          canvas: canvas,
          detectAudio: true, // Enable audio reactivity for a.fft[]
          enableStreamCapture: false,
          numBins: 6, // Set bins for a.fft[0], a.fft[1], etc.
          numSources: 4, // Limit sources for better performance
          precision: "mediump", // Better performance
        });

        // Define loadScript function in breakout window
        breakoutWindow.loadScript = (url) =>
          new Promise((resolve, reject) => {
            const script = breakoutWindow.document.createElement("script");
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            breakoutWindow.document.head.appendChild(script);
          });

        // Copy existing global variables and functions to breakout window
        if (window.hydraText) {
          breakoutWindow.hydraText = window.hydraText;
        }

        // Adjust canvas size (and the size in the title) when the window is resized
        breakoutWindow.addEventListener("resize", () => {
          canvas.width = breakoutWindow.innerWidth;
          canvas.height = breakoutWindow.innerHeight;
          breakoutWindow.document.title = `HYDRACTRL Breakout - ${canvas.width}×${canvas.height}`;
        });

        return breakoutHydra;
      }

      function resetButton() {
        display.breakoutButton.textContent = "Open";
        display.breakoutButton.style.backgroundColor = "";
      }

      function close() {
        if (window.breakoutWindow && !window.breakoutWindow.closed) {
          window.breakoutWindow.close();
        }
        window.breakoutHydra = null;
        window.breakoutWindow = null;
        resetButton();
        ctx.events.emit("breakout:closed", {});
      }

      async function open(width, height, label) {
        const breakoutWindow = openBreakoutWindow(width, height);
        if (!breakoutWindow) {
          return false; // Error already shown by openBreakoutWindow
        }

        window.breakoutWindow = breakoutWindow;

        try {
          window.breakoutHydra = await initBreakoutHydra(breakoutWindow);

          breakoutWindow.document.title = `HYDRACTRL Breakout - ${label || `${width}×${height}`}`;

          // Run the current code in the breakout window
          await ctx.runCodeOn(window.breakoutHydra);

          display.breakoutButton.textContent = "Close";
          display.breakoutButton.style.backgroundColor = "rgba(255, 120, 120, 0.3)";

          breakoutWindow.addEventListener("beforeunload", () => {
            resetButton();
            window.breakoutHydra = null;
            window.breakoutWindow = null;
            ctx.events.emit("breakout:closed", {});
          });

          ctx.events.emit("breakout:opened", { width, height });
          return true;
        } catch (error) {
          console.error("Error initializing breakout view:", error);
          ctx.notify(`Failed to initialize breakout view: ${error.message}`, { type: "error" });

          // Clean up on failure
          if (window.breakoutWindow) {
            window.breakoutWindow.close();
            window.breakoutWindow = null;
          }
          window.breakoutHydra = null;
          resetButton();
          return false;
        }
      }

      // Picking a size remembers it, and resizes a breakout window that is open
      const onSizeChange = () => {
        ctx.storage.set(SIZE_KEY, select.value);
        const breakoutWindow = window.breakoutWindow;
        const size = selectedSize();
        if (!breakoutWindow || breakoutWindow.closed || !size) return;
        try {
          // resizeTo takes the outer size; the dropdown gives the inner (canvas) size
          breakoutWindow.resizeTo(
            size.width + breakoutWindow.outerWidth - breakoutWindow.innerWidth,
            size.height + breakoutWindow.outerHeight - breakoutWindow.innerHeight,
          );
        } catch (error) {
          console.warn("Could not resize the breakout window:", error);
        }
      };
      select.addEventListener("change", onSizeChange);

      const onBreakoutClick = async () => {
        // If a window is already open, close it
        if (window.breakoutWindow && !window.breakoutWindow.closed) {
          close();
          return;
        }

        const size = selectedSize();
        if (!size) {
          ctx.notify("Please select a window size first", { type: "error" });
          return;
        }

        await open(size.width, size.height, size.label);
      };
      display.breakoutButton.addEventListener("click", onBreakoutClick);

      return {
        api: { open, close },
        dispose() {
          display.breakoutButton.removeEventListener("click", onBreakoutClick);
          select.removeEventListener("change", onSizeChange);
          close();
        },
      };
    },
  };
}
