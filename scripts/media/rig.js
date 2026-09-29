/**
 * The capture rig behind the landing page media (see README.md): the real
 * interface in headless Chromium on a virtual clock (page/clock.js), recorded
 * frame by frame into H.264 with ffmpeg, plus stills and composed stills.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const PAGE_DIR = join(import.meta.dir, "page");
export const FFMPEG = process.env.FFMPEG || "ffmpeg";
const LAUNCH = {
  // The full Chromium, not the headless shell Playwright picks by default:
  // the shell sets text a little narrower, so lines wrap differently from
  // the media already on the site
  channel: "chromium",
  executablePath: process.env.CHROMIUM || undefined,
  // Software WebGL: slow, but it renders the same everywhere, and speed doesn't
  // matter on the virtual clock
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
};

const scratch = mkdtempSync(join(tmpdir(), "hydractrl-media-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

/** A path for an intermediate file that is cleaned up on exit. */
export const scratchFile = (name) => join(scratch, name);
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ffmpeg(args) {
  execFileSync(FFMPEG, ["-loglevel", "error", "-y", ...args]);
}

/** Scale a PNG down with a good filter and save it as a JPEG. */
function toJpeg(png, file, { width, height, quality = 3 }) {
  ffmpeg([
    "-i",
    png,
    "-vf",
    `scale=${width}:${height}:flags=lanczos`,
    "-q:v",
    String(quality),
    file,
  ]);
}

/**
 * The interface at `${base}/app` in a fresh profile, with the virtual clock
 * and a visible pointer. `storage` is written to localStorage before the app
 * starts; `midi` plugs in the fake nanoPAD2; `prepare(context)` runs before
 * the page loads (for routes).
 */
export async function openApp(
  base,
  { width = 1280, height = 720, scale = 2, storage = {}, midi = false, prepare } = {},
) {
  const browser = await chromium.launch(LAUNCH);
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  await context.addInitScript({ path: join(PAGE_DIR, "clock.js") });
  await context.addInitScript({ path: join(PAGE_DIR, "cursor.js") });
  if (midi) await context.addInitScript({ path: join(PAGE_DIR, "midi.js") });
  await context.addInitScript((seed) => {
    // Once per tab, so the app's own writes survive in-page navigation
    try {
      if (location.protocol.startsWith("http") && !sessionStorage.getItem("media-seeded")) {
        for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
        sessionStorage.setItem("media-seeded", "1");
      }
    } catch {
      // No storage: the app starts empty
    }
  }, storage);
  if (prepare) await prepare(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => console.warn(`\n  page error: ${error.message}`));
  await page.goto(`${base}/app`, { waitUntil: "load" });
  await page.addStyleTag({ path: join(PAGE_DIR, "still.css") });
  await page.waitForFunction(
    () => window.slotsPanel && document.querySelectorAll(".slot").length >= 16,
    null,
    { timeout: 30000 },
  );
  await sleep(800);
  return { browser, context, page };
}

/** Add one of the page/ helpers (nanopad.js, beat.js) to a running page. */
export async function addHelper(page, name) {
  await page.addScriptTag({ path: join(PAGE_DIR, name) });
}

/** Put a panel at an exact spot (and size). */
export async function place(page, selector, rect) {
  await page.evaluate(
    ({ selector, rect }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`no ${selector}`);
      el.style.right = "auto";
      el.style.bottom = "auto";
      for (const side of ["left", "top", "width", "height"]) {
        if (rect[side] !== undefined) el.style[side] = `${rect[side]}px`;
      }
    },
    { selector, rect },
  );
}

/** An element's box and centre. */
export async function box(page, selector) {
  return page.evaluate((selector) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      cx: r.x + r.width / 2,
      cy: r.y + r.height / 2,
    };
  }, selector);
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Record `clip` (CSS pixels; the output is clip × device scale) to an MP4,
 * plus `<name>-poster.jpg` from its first frame. Every frame steps the clock
 * by 1/fps; the returned helpers move the pointer, click and type between
 * frames. `warmup` seconds run first, unrecorded, so counters settle.
 */
export async function record(page, { clip, file, fps = 30, crf = 27, warmup = 0 }) {
  const dt = 1000 / fps;
  const step = () => page.evaluate((ms) => window.__clock.step(ms), dt);
  await page.evaluate(() => window.__clock.setManual(true));
  for (let i = 0; i < Math.round(warmup * fps); i++) await step();

  // Bun.spawn rather than node:child_process: under Bun the latter can miss
  // ffmpeg's exit and hang the run. Bun.spawn can too, next to Playwright's
  // browser in some Linux containers, so finish() also watches for ffmpeg's
  // stdout to close, which it does when it exits.
  const encoder = Bun.spawn(
    [
      FFMPEG,
      ...["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "-"],
      ...["-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf)],
      ...["-profile:v", "high", "-movflags", "+faststart", "-an", file],
    ],
    { stdin: "pipe", stdout: "pipe", stderr: "inherit" },
  );
  const stdoutClosed = new Response(encoder.stdout).arrayBuffer();
  let cursor = null;

  async function frame() {
    await step();
    const png = await page.screenshot({ clip, type: "png" });
    encoder.stdin.write(png);
    await encoder.stdin.flush();
  }

  async function pointAt(x, y) {
    cursor = { x, y };
    await page.mouse.move(x, y);
    await page.evaluate(({ x, y }) => window.__cursor.set(x, y), { x, y });
  }

  async function pressPointer(down) {
    await (down ? page.mouse.down() : page.mouse.up());
    await page.evaluate((down) => window.__cursor.press(down), down);
  }

  const recording = {
    frame,
    async hold(seconds) {
      for (let i = 0; i < Math.round(seconds * fps); i++) await frame();
    },
    /** Show the pointer at a spot without animating to it. */
    async cursorAt(x, y) {
      await pointAt(x, y);
    },
    /** Glide the pointer to a spot, on a slight arc like a hand would. */
    async move(x, y, seconds = 0.6) {
      const from = cursor || { x: x + 120, y: y + 60 };
      const count = Math.max(1, Math.round(seconds * fps));
      const lift = Math.min(24, Math.hypot(x - from.x, y - from.y) * 0.08);
      for (let i = 1; i <= count; i++) {
        const t = ease(i / count);
        const arc = Math.sin(Math.PI * (i / count)) * lift;
        await pointAt(from.x + (x - from.x) * t, from.y + (y - from.y) * t - arc);
        await frame();
      }
    },
    async down() {
      await pressPointer(true);
    },
    async up() {
      await pressPointer(false);
    },
    async click({ hold = 0.1 } = {}) {
      await pressPointer(true);
      await recording.hold(hold);
      await pressPointer(false);
    },
    async press(key, seconds = 0.1) {
      await page.keyboard.press(key);
      await recording.hold(seconds);
    },
    async type(text, { perChar = 0.09 } = {}) {
      for (const char of text) {
        await page.keyboard.type(char);
        await recording.hold(perChar);
      }
    },
    async hideCursor() {
      await page.evaluate(() => window.__cursor.hide());
    },
    async finish() {
      encoder.stdin.end();
      await Promise.race([encoder.exited, stdoutClosed]);
      const code = await Promise.race([encoder.exited, sleep(2000).then(() => null)]);
      if (code === null) {
        // Bun missed the exit: make sure the video decodes instead
        ffmpeg(["-i", file, "-f", "null", "-"]);
      } else if (code !== 0) {
        throw new Error(`ffmpeg exited ${code} while encoding ${file}`);
      }
      ffmpeg(["-i", file, "-frames:v", "1", "-q:v", "4", file.replace(/\.mp4$/, "-poster.jpg")]);
    },
  };
  return recording;
}

/**
 * Save `clip` as a JPEG at `width`×`height`, after running the clock for
 * `settle` seconds so the FPS counter reads the steady 30.
 */
export async function still(
  page,
  { clip, file, width = 1280, height = 720, quality = 3, settle = 4 },
) {
  await page.evaluate(() => window.__clock.setManual(true));
  for (let i = 0; i < settle * 30; i++) await page.evaluate(() => window.__clock.step(1000 / 30));
  const png = scratchFile("still.png");
  await page.screenshot({ path: png, clip });
  toJpeg(png, file, { width, height, quality });
}

export const dataUrl = (png) => `data:image/png;base64,${readFileSync(png).toString("base64")}`;

/** The landing page's fonts, for composed stills (served by the local server). */
export const FONTS = `
  @font-face { font-family: "IBM Plex Sans"; src: url(/site/fonts/ibm-plex-sans-latin-wght.woff2) format("woff2"); font-weight: 100 700; }
  @font-face { font-family: "IBM Plex Mono"; src: url(/site/fonts/ibm-plex-mono-latin-400.woff2) format("woff2"); font-weight: 400; }
  @font-face { font-family: "IBM Plex Mono"; src: url(/site/fonts/ibm-plex-mono-latin-500.woff2) format("woff2"); font-weight: 500 700; }
`;

export const WINDOW_CSS = `
  .win { position: absolute; border-radius: 10px; overflow: hidden; background: #111;
    box-shadow: 0 30px 70px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.09); }
  .win img { display: block; }
  .bar { display: flex; align-items: center; gap: 7px; padding: 0 12px; position: relative;
    background: linear-gradient(#2b2a31, #232229); border-bottom: 1px solid rgba(0,0,0,.6); }
  .bar i { width: 11px; height: 11px; border-radius: 50%; background: #4a4854; }
  .bar span { position: absolute; left: 0; right: 0; text-align: center; pointer-events: none;
    font: 500 13px "IBM Plex Sans", sans-serif; color: #b9b5c6; }
`;

/** A plain, OS-neutral window frame around a screenshot. */
export function windowFrame({ src, title, left, top, width, height, z = 1, bar = 30 }) {
  return `<div class="win" style="left:${left}px;top:${top}px;width:${width}px;z-index:${z}">
    <div class="bar" style="height:${bar}px"><i></i><i></i><i></i><span>${title}</span></div>
    <img src="${src}" style="width:${width}px;height:${height}px">
  </div>`;
}

/** Render an HTML composition at 2× and save it as a `width`×`height` JPEG. */
export async function compose(base, html, file, { width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    // Same origin as the server, so the composition can use the site's fonts
    await page.goto(`${base}/site/fonts/LICENSE.txt`);
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
      await document.fonts.ready;
    });
    const png = scratchFile("compose.png");
    await page.screenshot({ path: png });
    toJpeg(png, file, { width, height });
  } finally {
    await browser.close();
  }
}
