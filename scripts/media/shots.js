/**
 * One shot per landing page screenshot or video (public/site/<name>.mp4 with a
 * -poster.jpg, or <name>.jpg), plus the starter bank. Each shot sets the
 * interface up the way a person would have it and records or grabs a 16:9
 * frame of it. Sizes: videos 960×540, stills 1280×720, the hero 1920×1080.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SKETCHES, sketchSource } from "../../src/sketches.js";
import {
  FONTS,
  WINDOW_CSS,
  addHelper,
  box,
  compose,
  dataUrl,
  openApp,
  place,
  record,
  scratchFile,
  sleep,
  still,
  windowFrame,
} from "./rig.js";
import {
  VARIANTS,
  clearToasts,
  fillSlots,
  selectSlot,
  slotKey,
  starterCode,
  starterStorage,
} from "./scenes.js";

const hide = (page, selector) =>
  page.evaluate((selector) => {
    for (const el of document.querySelectorAll(selector)) el.style.display = "none";
  }, selector);

/** Open the interface, run `shot` with it, and always close the browser. */
async function withApp(base, options, shot) {
  const app = await openApp(base, options);
  try {
    return await shot(app);
  } finally {
    await app.browser.close();
  }
}

// ── Videos ─────────────────────────────────────────────────────────────────

/** Clicking through scenes in the slot grid. */
async function sceneManagement({ base, out }) {
  await withApp(base, { scale: 2, storage: starterStorage() }, async ({ page }) => {
    await fillSlots(page, VARIANTS);
    await place(page, ".slots-panel", { left: 454, top: 496 });
    await hide(page, "#editor-container");
    await selectSlot(page, 0);
    await clearToasts(page);
    const clip = { x: 400, y: 386, width: 480, height: 270 };
    const rec = await record(page, { clip, file: join(out, "scene-management.mp4") });
    await rec.cursorAt(clip.x + clip.width + 40, clip.y + 60);
    await rec.hold(0.5);
    for (const slot of [1, 2, 5, 3, 7, 0]) {
      const target = await box(page, `.slots-grid .slot:nth-child(${slot + 1})`);
      await rec.move(target.cx + 4, target.cy + 6, 0.55);
      await rec.click();
      await rec.hold(0.95);
    }
    await rec.move(clip.x + clip.width + 40, clip.y + 60, 0.6);
    await rec.hold(0.2);
    await rec.finish();
  });
}

/** Pads on a (drawn, simulated) nanoPAD2 switching scenes; its touchpad moving the XY pad. */
async function midiIntegration({ base, out }) {
  const options = {
    scale: 1.2,
    midi: true,
    storage: starterStorage({ "hydractrl-xy-pad-visible": "true" }),
  };
  await withApp(base, options, async ({ page }) => {
    await fillSlots(page, VARIANTS);
    await selectSlot(page, 0, 2000);
    await clearToasts(page);
    await hide(page, "#editor-container, .midi-status");
    await place(page, ".slots-panel", { left: 258, top: 152 });
    await place(page, ".xy-pad-panel", { left: 766, top: 152 });
    await addHelper(page, "nanopad.js");
    await page.evaluate(() => window.__installNanoPad({ left: 258, top: 418, width: 486 }));
    const clip = { x: 240, y: 135, width: 800, height: 450 };
    const rec = await record(page, { clip, file: join(out, "midi-integration.mp4") });
    const hit = async (pad, after) => {
      await page.evaluate((pad) => window.__pad.hit(pad, true), pad);
      await rec.hold(0.22);
      await page.evaluate((pad) => window.__pad.hit(pad, false), pad);
      await rec.hold(after);
    };
    await rec.hold(0.5);
    await hit(1, 1.1);
    await hit(2, 0.4);
    // A slow figure eight on the touchpad
    const frames = 90;
    for (let f = 0; f <= frames; f++) {
      const t = f / frames;
      const x = 0.5 + 0.36 * Math.sin(2 * Math.PI * t);
      const y = 0.5 + 0.32 * Math.sin(4 * Math.PI * t);
      await page.evaluate(({ x, y }) => window.__pad.touch(x, y), { x, y });
      await rec.frame();
    }
    await page.evaluate(() => window.__pad.touch(null));
    await rec.hold(0.4);
    await hit(4, 1.0);
    await hit(3, 1.0);
    await hit(0, 0.9);
    await rec.finish();
  });
}

/** Flicking the XY pad with Pulse running, then adding friction. */
async function xyPadPhysics({ base, out }) {
  const options = { scale: 1.5, storage: starterStorage({ "hydractrl-xy-pad-visible": "true" }) };
  await withApp(base, options, async ({ page }) => {
    await hide(page, "#editor-container");
    await selectSlot(page, 2);
    await place(page, ".xy-pad-panel", { left: 356, top: 196 });
    await clearToasts(page);
    const clip = { x: 320, y: 180, width: 640, height: 360 };
    const puck = await box(page, ".xy-pad-indicator");
    const friction = await box(page, ".xy-pad-panel input[type=range]");
    const rest = { x: clip.x + clip.width - 60, y: clip.y + clip.height - 40 };
    const rec = await record(page, { clip, file: join(out, "xy-pad-physics.mp4") });
    await rec.cursorAt(rest.x, rest.y);
    await rec.hold(0.4);
    await rec.move(puck.cx, puck.cy, 0.7);
    await rec.hold(0.15);
    // Grab the puck, pull it back like a slingshot, let go
    await rec.down();
    await rec.hold(0.1);
    await rec.move(puck.cx - 58, puck.cy + 44, 0.7);
    await rec.hold(0.25);
    await rec.up();
    await rec.move(puck.cx + 150, puck.cy + 150, 0.6);
    await rec.hold(2.2);
    // More friction: the puck slows down and settles
    await rec.move(friction.x + 4, friction.cy, 0.6);
    await rec.down();
    await rec.move(friction.x + friction.width * 0.85, friction.cy, 0.6);
    await rec.up();
    await rec.move(rest.x, rest.y, 0.8);
    await rec.hold(2.2);
    await rec.finish();
  });
}

/** Adding a line with completions and running it. */
async function codeEditor({ base, out }) {
  // Chained without its header comments, so the whole chain fits the editor:
  // it doesn't scroll to follow the cursor below its fold
  const demo = starterCode(1).split("\n").slice(3).join("\n");
  const storage = starterStorage({ "hydractrl-panel-opacity": "68", [slotKey(9)]: demo });
  await withApp(base, { scale: 1.5, storage }, async ({ page }) => {
    await selectSlot(page, 9);
    await clearToasts(page);
    await place(page, "#editor-container", { left: 40, top: 30, width: 540, height: 340 });
    const color = await page.evaluate(() => {
      const line = [...document.querySelectorAll(".cm-line")].find((l) =>
        l.textContent.includes(".color("),
      );
      const r = line.getBoundingClientRect();
      return { y: r.y + r.height / 2 };
    });
    const clip = { x: 20, y: 14, width: 640, height: 360 };
    const rec = await record(page, { clip, file: join(out, "code-editor.mp4") });
    await rec.cursorAt(600, 360);
    await rec.hold(0.5);
    await rec.move(300, color.y, 0.6);
    await rec.click();
    await rec.hold(0.2);
    await rec.hideCursor();
    await rec.press("End", 0.15);
    await rec.press("Enter", 0.2);
    await rec.type(".modulateR");
    await rec.hold(0.8);
    await rec.type("o");
    await rec.hold(0.4);
    await rec.press("Enter", 0.2);
    await rec.type("osc(2, 0.05), 1.2)");
    await rec.hold(0.5);
    await rec.press("Control+Enter", 2.6);
    await rec.finish();
  });
}

/** A sketch flashing on the beat through a.fft, with hydra's meter (synthetic beat). */
async function audioReactivity({ base, out }) {
  const code = `s0.initImage("/assets/img/hydractrl-logo-bw.png")
a.show()

src(s0)
  .invert()
  .scale(0.14, 1, () => innerWidth / innerHeight)
  .modulateScrollY(osc(4, 0.03), () => a.fft[1] * 0.2)
  .mult(noise(1.2, 0.04).add(solid(0.35, 0.35, 0.35)))
  .color(() => 0.56 + a.fft[0] * 0.8, 0.1, 1)
  .out()
`;
  const storage = starterStorage({ [slotKey(9)]: code, "hydractrl-panel-opacity": "78" });
  await withApp(base, { scale: 4 / 3, storage }, async ({ page }) => {
    await addHelper(page, "beat.js");
    await page.evaluate(() => window.__installBeat());
    await page.evaluate(() => window.slotsPanel.setActiveSlot(9));
    await sleep(2000);
    await clearToasts(page);
    await place(page, "#editor-container", { left: 574, top: 329, width: 560, height: 336 });
    await hide(page, ".slots-panel");
    const clip = { x: 560, y: 315, width: 720, height: 405 };
    const rec = await record(page, { clip, file: join(out, "audio-reactivity.mp4") });
    // Four bars at 120 BPM, so the loop comes round on the beat
    await rec.hold(8);
    await rec.finish();
  });
}

/** Clicking through the five themes, then dialing panel opacity down and up. */
async function multipleThemes({ base, out }) {
  await withApp(base, { scale: 4 / 3, storage: starterStorage() }, async ({ page }) => {
    await fillSlots(page, VARIANTS);
    await selectSlot(page, 3);
    await page.click(".stats-toggle");
    await clearToasts(page);
    await place(page, "#editor-container", { left: 292, top: 162, width: 500, height: 250 });
    await place(page, ".slots-panel", { left: 292, top: 420 });
    await place(page, ".stats-panel", { left: 804, top: 162 });
    await page.evaluate(() => {
      document.querySelector("#editor-content").scrollTop = 5 * 21;
    });
    const swatches = await page.evaluate(() =>
      [...document.querySelectorAll(".theme-swatch")].map((swatch) => {
        const r = swatch.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }),
    );
    const slider = await box(page, ".stats-panel input[type=range]");
    // The opacity slider runs from 30 to 100 percent
    const at = (percent) => slider.x + 8 + ((slider.width - 16) * (percent - 30)) / 70;
    const clip = { x: 280, y: 150, width: 720, height: 405 };
    const rest = { x: clip.x + clip.width - 30, y: clip.y + clip.height - 30 };
    const file = join(out, "multiple-themes.mp4");
    const rec = await record(page, { clip, file, warmup: 4 });
    await rec.cursorAt(rest.x, rest.y);
    await rec.hold(0.5);
    for (const theme of [1, 2, 3, 4, 0]) {
      await rec.move(swatches[theme].x + 2, swatches[theme].y + 3, 0.5);
      await rec.click();
      await rec.hold(1.0);
    }
    await rec.move(at(90), slider.cy, 0.5);
    await rec.down();
    await rec.move(at(35), slider.cy, 0.8);
    await rec.hold(1.0);
    await rec.move(at(90), slider.cy, 0.8);
    await rec.up();
    await rec.move(rest.x, rest.y, 0.6);
    await rec.hold(0.3);
    await rec.finish();
  });
}

// ── Stills ─────────────────────────────────────────────────────────────────

/** The interface next to a breakout window at 1280×720. */
async function breakoutView({ base, out }) {
  const main = scratchFile("breakout-main.png");
  const popup = scratchFile("breakout-popup.png");
  const options = { scale: 1, storage: starterStorage({ "hydractrl-xy-pad-visible": "false" }) };
  await withApp(base, options, async ({ context, page }) => {
    await fillSlots(page, VARIANTS);
    await selectSlot(page, 3);
    await page.click(".stats-toggle");
    await clearToasts(page);
    await place(page, "#editor-container", { left: 24, top: 24, width: 600, height: 420 });
    await place(page, ".slots-panel", { left: 24, top: 560 });
    await place(page, ".stats-panel", { left: 644, top: 24 });
    await page.getByText("HD (1280×720)", { exact: true }).click();
    const opened = context.waitForEvent("page");
    await page.getByText("Open Breakout View").click();
    const breakout = await opened;
    await breakout.setViewportSize({ width: 1280, height: 720 });
    await sleep(3000);
    await clearToasts(page);
    await page.evaluate(() => window.__clock.setManual(true));
    await page.screenshot({ path: main });
    await breakout.screenshot({ path: popup });
  });
  const html = `<!doctype html><html><head><style>${FONTS}${WINDOW_CSS}
    html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden; }
    body { background: radial-gradient(ellipse at 20% 10%, #2a1150 0%, transparent 55%),
      radial-gradient(ellipse at 90% 100%, #0b3a2a 0%, transparent 50%), #0b0a10; }
  </style></head><body>
  ${windowFrame({ src: dataUrl(main), title: "HYDRACTRL", left: 44, top: 44, width: 800, height: 450 })}
  ${windowFrame({ src: dataUrl(popup), title: "HYDRACTRL Breakout · 1280×720", left: 640, top: 300, width: 600, height: 338, z: 2 })}
  </body></html>`;
  await compose(base, html, join(out, "breakout-view.jpg"));
}

const SETUP_CODE = `// Setup code runs once before main code
// Use this for audio settings, global variables, etc.
// This only persists in your browser and will not be exported to JSON.

// Smoother audio and a calmer clock, for every sketch
a.setSmooth(0.8)
speed = 0.8

// Colors to reuse in any scene: .color(...mint)
purple = [0.56, 0.1, 1]
mint = [0.04, 0.7, 0.42]
`;

/** The Setup tab with audio settings and shared colors. */
async function setupCode({ base, out }) {
  const storage = starterStorage({ "hydractrl-setup-code": SETUP_CODE });
  await withApp(base, { scale: 16 / 9, storage }, async ({ page }) => {
    await selectSlot(page, 0);
    await clearToasts(page);
    await place(page, "#editor-container", { left: 36, top: 36, width: 560, height: 382 });
    await page.getByText("Setup", { exact: true }).click();
    await sleep(500);
    await page.evaluate(() => document.activeElement?.blur());
    const clip = { x: 16, y: 16, width: 720, height: 405 };
    await still(page, { clip, file: join(out, "setup-code.jpg") });
  });
}

/** The built-in hydra docs, open at modulateRotate. */
async function builtinDocs({ base, out }) {
  await withApp(base, { scale: 16 / 9, storage: starterStorage() }, async ({ page }) => {
    await selectSlot(page, 2);
    await clearToasts(page);
    await hide(page, "#editor-container");
    await page.click(".docs-button");
    await sleep(500);
    await place(page, ".doc-panel", { left: 36, top: 36 });
    await page.locator(".doc-panel").getByText("modulateRotate", { exact: true }).click();
    await sleep(500);
    const clip = { x: 16, y: 16, width: 720, height: 405 };
    await still(page, { clip, file: join(out, "builtin-docs.jpg") });
  });
}

/** The export button on the slots panel, next to the file it writes. */
async function importExport({ base, out }) {
  const panel = scratchFile("import-panel.png");
  const exported = await withApp(
    base,
    { scale: 2, storage: starterStorage() },
    async ({ page }) => {
      await fillSlots(page, VARIANTS);
      await selectSlot(page, 1);
      await clearToasts(page);
      await hide(page, "#editor-container");
      await place(page, ".slots-panel", { left: 454, top: 470 });
      const button = await box(page, ".slots-export");
      await page.mouse.move(button.cx + 2, button.cy + 4);
      await page.evaluate(({ x, y }) => window.__cursor.set(x, y), {
        x: button.cx + 2,
        y: button.cy + 4,
      });
      await page.evaluate(() => window.__clock.setManual(true));
      for (let i = 0; i < 60; i++) await page.evaluate(() => window.__clock.step(1000 / 30));
      await page.screenshot({ path: panel, clip: { x: 430, y: 330, width: 420, height: 330 } });
      // The slots as the export writes them (see exportAllSlots in SlotsPanel.js)
      return page.evaluate(() => {
        const slots = [];
        for (let i = 0; i < 16; i++) {
          const key = `hydractrl-slot-bank-0-slot-${i}`;
          const code = localStorage.getItem(key);
          if (!code) continue;
          const thumbnail = localStorage.getItem(`${key}-thumbnail`);
          slots.push({ slotIndex: i, code: btoa(encodeURIComponent(code)), thumbnail });
        }
        return slots;
      });
    },
  );

  const key = (name) => `<span class="k">"${name}"</span>`;
  const text = (value) => `<span class="s">"${value.slice(0, 22)}…"</span>`;
  const num = (value) => `<span class="n">${value}</span>`;
  const lines = [
    "{",
    `  ${key("version")}: ${num(1)},`,
    `  ${key("banks")}: [`,
    "    {",
    `      ${key("bankIndex")}: ${num(0)},`,
    `      ${key("slots")}: [`,
  ];
  for (const slot of exported.slice(0, 3)) {
    lines.push(
      "        {",
      `          ${key("slotIndex")}: ${num(slot.slotIndex)},`,
      `          ${key("code")}: ${text(slot.code)},`,
      `          ${key("thumbnail")}: ${text(slot.thumbnail)}`,
      "        },",
    );
  }
  lines.push('        <span class="c">…</span>');
  const code = lines
    .map((line, i) => `<div class="l"><b>${i + 1}</b><span>${line}</span></div>`)
    .join("");
  const date = new Date().toISOString().split("T")[0];
  const html = `<!doctype html><html><head><style>${FONTS}${WINDOW_CSS}
    html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden; }
    body { font-family: "IBM Plex Sans", sans-serif;
      background: radial-gradient(ellipse at 15% 20%, #2a1150 0%, transparent 55%),
        radial-gradient(ellipse at 90% 95%, #0b3a2a 0%, transparent 50%), #0b0a10; }
    .panel { position: absolute; left: 48px; top: 150px; width: 540px; height: 424px; border-radius: 14px;
      overflow: hidden; box-shadow: 0 30px 70px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.09); }
    .panel img { width: 540px; height: 424px; display: block; }
    .file { left: 640px; top: 72px; width: 592px; }
    .code { background: #16151c; padding: 14px 0 18px; font: 400 15px/1.62 "IBM Plex Mono", monospace; color: #cfcbe0; }
    .l { display: flex; white-space: pre; }
    .l b { width: 44px; padding-right: 14px; text-align: right; color: #5c586b; font-weight: 400; flex: none; }
    .k { color: #c59bff; } .s { color: #6ff7bd; } .n { color: #ffd479; } .c { color: #5c586b; }
    .arrow { position: absolute; left: 596px; top: 350px; color: #0cf590; }
    .label { position: absolute; left: 48px; top: 96px; color: #aca6bd; font-size: 17px; }
    .label kbd { font: 500 14px "IBM Plex Mono", monospace; border: 1px solid #4a4854; border-bottom-width: 2px;
      border-radius: 6px; padding: 1px 7px; color: #e8e5f2; background: rgba(255,255,255,.04); }
  </style></head><body>
    <div class="label">Export all 64 slots with <kbd>Alt/⌥</kbd> + <kbd>X</kbd>, import with <kbd>Alt/⌥</kbd> + <kbd>I</kbd></div>
    <div class="panel"><img src="${dataUrl(panel)}"></div>
    <svg class="arrow" width="40" height="24" viewBox="0 0 40 24" fill="none" stroke="currentColor"
      stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h32M26 4l9 8-9 8"/></svg>
    <div class="win file"><div class="bar" style="height:34px"><i></i><i></i><i></i>
      <span>hydractrl-scenes-${date}.json</span></div><div class="code">${code}</div></div>
  </body></html>`;
  await compose(base, html, join(out, "import-export.jpg"));
}

/** The hero: the whole interface, with the (simulated) nanoPAD2 connected. */
async function hero({ base, out }) {
  const options = {
    width: 1600,
    height: 900,
    scale: 1.2,
    midi: true,
    storage: starterStorage({ "hydractrl-xy-pad-visible": "true" }),
  };
  await withApp(base, options, async ({ page }) => {
    await fillSlots(page, VARIANTS);
    await selectSlot(page, 1, 3000);
    await page.click(".stats-toggle");
    await clearToasts(page);
    await place(page, "#editor-container", { left: 24, top: 24, width: 640, height: 470 });
    await place(page, ".xy-pad-panel", { left: 1040, top: 24 });
    await place(page, ".stats-panel", { left: 1391, top: 24 });
    await place(page, ".slots-panel", { left: 24, top: 736 });
    await sleep(300);
    const clip = { x: 0, y: 0, width: 1600, height: 900 };
    const file = join(out, "hydractrl-preview.jpg");
    await still(page, { clip, file, width: 1920, height: 1080, quality: 4 });
  });
}

// ── Data ───────────────────────────────────────────────────────────────────

/**
 * The starter bank, rebuilt from src/sketches.js: the interface imports the
 * code, then saves each scene to capture its thumbnail.
 */
async function starterBank({ base, bankFile }) {
  const encode = (code) => Buffer.from(encodeURIComponent(code), "latin1").toString("base64");
  const codeOnly = {
    version: 1,
    banks: [
      {
        bankIndex: 0,
        slots: SKETCHES.map((sketch, i) => ({ slotIndex: i, code: encode(sketchSource(sketch)) })),
      },
    ],
    exportDate: new Date().toISOString(),
  };
  const options = {
    scale: 1,
    storage: { "hydractrl-show-info-on-startup": "false" },
    prepare: (context) =>
      context.route("**/assets/banks/hydractrl-init-basic.json", (route) =>
        route.fulfill({ contentType: "application/json", body: JSON.stringify(codeOnly) }),
      ),
  };
  const slots = await withApp(base, options, async ({ page }) => {
    const saved = [];
    for (const [i, sketch] of SKETCHES.entries()) {
      await selectSlot(page, i, 4000);
      await page.evaluate(() => window.slotsPanel.saveToActiveSlot());
      await sleep(1200);
      const slot = await page.evaluate(
        (key) => ({
          code: localStorage.getItem(key),
          thumbnail: localStorage.getItem(`${key}-thumbnail`),
        }),
        slotKey(i),
      );
      if (slot.code !== sketchSource(sketch)) throw new Error(`slot ${i + 1} holds other code`);
      if (!slot.thumbnail) throw new Error(`slot ${i + 1} has no thumbnail`);
      saved.push({ slotIndex: i, code: encode(slot.code), thumbnail: slot.thumbnail });
    }
    return saved;
  });
  const bank = {
    version: 1,
    banks: [{ bankIndex: 0, slots }],
    exportDate: new Date().toISOString(),
  };
  writeFileSync(bankFile, JSON.stringify(bank, null, 2));
}

export const SHOTS = {
  "hydractrl-preview": { kind: "still", run: hero },
  "scene-management": { kind: "video", run: sceneManagement },
  "midi-integration": { kind: "video", run: midiIntegration },
  "xy-pad-physics": { kind: "video", run: xyPadPhysics },
  "code-editor": { kind: "video", run: codeEditor },
  "audio-reactivity": { kind: "video", run: audioReactivity },
  "breakout-view": { kind: "still", run: breakoutView },
  "multiple-themes": { kind: "video", run: multipleThemes },
  "setup-code": { kind: "still", run: setupCode },
  "builtin-docs": { kind: "still", run: builtinDocs },
  "import-export": { kind: "still", run: importExport },
  "starter-bank": { kind: "data", run: starterBank },
};

/** Everything the landing page shows (the starter bank only runs when asked for). */
export const MEDIA = Object.keys(SHOTS).filter((name) => SHOTS[name].kind !== "data");
