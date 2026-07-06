/**
 * BreakoutPlugin - full-size output in a separate window.
 *
 * Wires the size selection + "Breakout View" button in the stats panel,
 * opens a popup with its own hydra-synth instance and mirrors the sketch
 * into it. The core run path keeps mirroring code into the breakout via the
 * `window.breakoutHydra` / `window.breakoutWindow` globals this plugin sets.
 */

/** Pure helper: window.open feature string for a breakout window. */
export function buildWindowFeatures(width = 1280, height = 720) {
  return `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes`;
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
      if (ctx.isMobile || !display || !display.sizeButtons) return;

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

        // Adjust canvas size when the window is resized
        breakoutWindow.addEventListener("resize", () => {
          canvas.width = breakoutWindow.innerWidth;
          canvas.height = breakoutWindow.innerHeight;
        });

        // Update UI when the breakout window is closed
        breakoutWindow.addEventListener("beforeunload", () => {
          display.sizeSelectionContainer.style.display = "none";
          window.breakoutHydra = null;
          window.breakoutWindow = null;
        });

        return breakoutHydra;
      }

      function resetButton() {
        display.breakoutButton.textContent = "Breakout View";
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

          display.breakoutButton.textContent = "Close Breakout";
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

      // Size selection buttons: pick a resolution and arm the breakout button
      const sizeHandlers = new Map();
      display.sizeButtons.forEach((button) => {
        const onSizeClick = () => {
          const width = Number.parseInt(button.dataset.width);
          const height = Number.parseInt(button.dataset.height);
          const label = button.dataset.label;

          if (Number.isNaN(width) || Number.isNaN(height)) {
            return;
          }

          display.selectedSize = { width, height, label };
          display.selectedSizeIndicator.textContent = `Selected: ${label}`;

          display.breakoutButton.disabled = false;
          display.breakoutButton.style.opacity = "1";
          display.breakoutButton.title = `Open breakout window at ${width}×${height}`;

          // Highlight the selected button and unhighlight others
          display.sizeButtons.forEach((btn) => {
            btn.style.backgroundColor = btn === button ? "rgba(80, 250, 123, 0.3)" : "";
          });
        };
        sizeHandlers.set(button, onSizeClick);
        button.addEventListener("click", onSizeClick);
      });

      const onBreakoutClick = async () => {
        // If a window is already open, close it
        if (window.breakoutWindow && !window.breakoutWindow.closed) {
          close();
          return;
        }

        if (!display.selectedSize) {
          ctx.notify("Please select a window size first", { type: "error" });
          return;
        }

        const { width, height, label } = display.selectedSize;
        await open(width, height, label);
      };
      display.breakoutButton.addEventListener("click", onBreakoutClick);

      return {
        api: { open, close },
        dispose() {
          display.breakoutButton.removeEventListener("click", onBreakoutClick);
          for (const [button, handler] of sizeHandlers) {
            button.removeEventListener("click", handler);
          }
          close();
        },
      };
    },
  };
}
