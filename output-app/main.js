/**
 * HYDRACTRL output spike (phase 0).
 *
 * Renders a HYDRACTRL page offscreen using Electron's GPU shared-texture mode and
 * publishes every frame as a Syphon server (macOS) or Spout sender (Windows) via
 * @napolab/texture-bridge. No HYDRACTRL changes are needed: the page is loaded
 * from the running Bun server and the sketch travels in the URL fragment, the
 * same way Alt/Opt+U share links work.
 *
 * Configuration is read from environment variables, see README.md.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createTextureBridge } from "@napolab/texture-bridge-renderer";
import { app } from "electron";

const here = path.dirname(fileURLToPath(import.meta.url));

const config = {
  baseUrl: process.env.HYDRACTRL_URL || "http://localhost:3000/",
  sketchFile: process.env.SKETCH_FILE || "",
  name: process.env.OUTPUT_NAME || "HYDRACTRL",
  width: Number.parseInt(process.env.OUTPUT_WIDTH || "1920", 10),
  height: Number.parseInt(process.env.OUTPUT_HEIGHT || "1080", 10),
  fps: Number.parseInt(process.env.OUTPUT_FPS || "60", 10),
  preview: process.env.PREVIEW !== "0",
  hideUi: process.env.HIDE_UI !== "0",
  includeAlpha: process.env.INCLUDE_ALPHA === "1",
};

/**
 * Same encoding as HYDRACTRL's UrlSharePlugin.encodeSketch:
 * base64url of encodeURIComponent(code).
 */
export function encodeSketch(code) {
  const base64 = btoa(encodeURIComponent(code));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build the page URL, adding a #sketch= fragment when a sketch is given. */
export function buildPageUrl(baseUrl, sketchCode) {
  const url = new URL(baseUrl);
  if (sketchCode) url.hash = `sketch=${encodeSketch(sketchCode)}`;
  return url.toString();
}

async function start() {
  const sketch = config.sketchFile ? readFileSync(path.resolve(config.sketchFile), "utf8") : "";
  const rendererUrl = buildPageUrl(config.baseUrl, sketch);

  console.log(`[output] page: ${config.baseUrl}`);
  console.log(
    `[output] sketch: ${config.sketchFile ? config.sketchFile : "none (page loads its own state)"}`,
  );
  console.log(
    `[output] publishing "${config.name}" at ${config.width}x${config.height}, ${config.fps} fps`,
  );

  const webPreferences = { backgroundThrottling: false };
  if (config.hideUi) webPreferences.preload = path.join(here, "preload.cjs");

  const bridge = await createTextureBridge({
    name: config.name,
    width: config.width,
    height: config.height,
    frameRate: config.fps,
    rendererUrl,
    includeAlpha: config.includeAlpha,
    preview: { enabled: config.preview },
    webPreferences,
  });

  bridge.on("ready", () => console.log("[output] page loaded, frames should be flowing"));
  bridge.on("fps", (fps) => console.log(`[output] fps ${fps.toFixed(1)}`));
  bridge.on("frameDropped", (defect) => console.warn(`[output] frame dropped: ${defect.reason}`));
  bridge.on("error", (error) => console.error("[output] error:", error));
  bridge.on("disposed", () => app.quit());

  const shutdown = () => {
    if (!bridge.isDisposed) bridge.dispose();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

app.on("window-all-closed", () => app.quit());

app
  .whenReady()
  .then(start)
  .catch((error) => {
    console.error("[output] failed to start:", error);
    app.exit(1);
  });
