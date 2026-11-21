import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(8_000);
  await page.addInitScript(() => {
    window.hydraDraws = 0;
    for (const Context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const method of ["drawArrays", "drawElements"]) {
        const draw = Context.prototype[method];
        Context.prototype[method] = function (...args) {
          if (this.canvas === document.querySelector("#hydra-canvas canvas")) window.hydraDraws++;
          return draw.apply(this, args);
        };
      }
    }
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.HYDRACTRL_URL || "http://127.0.0.1:3000/app");
  await page.waitForFunction(
    () => window.hydractrl?.plugins.getStatus("signature-assist") === "active",
  );

  const editor = page.locator(".cm-content");
  const tip = page.locator(".cm-signature-assist");
  const active = tip.locator("strong");
  const summary = tip.locator(".cm-signature-summary");
  const parameterDoc = tip.locator(".cm-signature-parameter");

  async function replace(code) {
    await editor.press("Control+a");
    await page.keyboard.insertText(code);
  }

  const setupTab = page.locator('[data-tab="setup"]');
  const sketchTab = page.locator('[data-tab="main"]');
  await setupTab.click();
  const originalSetup = await editor.innerText();
  await replace("// setup edit");
  await sketchTab.click();
  await replace("osc().out()");
  await page.waitForTimeout(600);
  await page.keyboard.insertText(")");
  await editor.press("Control+Enter");
  const error = page.locator(".error-notification");
  await error.waitFor({ state: "visible" });
  await error.click();
  await setupTab.click();
  assert.equal(await editor.innerText(), "// setup edit");
  await editor.press("Control+z");
  assert.equal(await editor.innerText(), originalSetup);
  await editor.press("Control+y");
  assert.equal(await editor.innerText(), "// setup edit");
  await editor.press("Control+z");
  await sketchTab.click();
  assert.equal(await editor.innerText(), "osc().out())");
  await editor.press("Control+z");
  assert.equal(await editor.innerText(), "osc().out()");
  await setupTab.click();
  assert.equal(await editor.innerText(), originalSetup);
  await sketchTab.click();
  await editor.press("Control+y");
  assert.equal(await editor.innerText(), "osc().out())");

  const oscillator = "osc(frequency = 60, sync = 0.1, offset = 0)";
  async function expectParameter(label, signature = oscillator) {
    await tip.waitFor({ state: "visible" });
    assert.equal(await tip.locator(".cm-signature-label").textContent(), signature);
    assert.equal(await active.textContent(), label);
  }

  await replace("osc(60,");
  await expectParameter("sync = 0.1");
  if (process.env.SIGNATURE_SCREENSHOT) {
    await page.screenshot({ path: process.env.SIGNATURE_SCREENSHOT });
  }
  await editor.press("ArrowLeft");
  await expectParameter("frequency = 60");
  await editor.press("ArrowRight");
  await expectParameter("sync = 0.1");
  await page.keyboard.insertText(" 0.1,");
  await expectParameter("offset = 0");
  await editor.press("Escape");
  await tip.waitFor({ state: "hidden" });

  await replace("osc(osc(60,");
  await expectParameter("sync = 0.1");
  await page.keyboard.insertText(" 0.1)");
  await expectParameter("frequency = 60");
  await page.keyboard.insertText(", noi");
  await expectParameter("sync = 0.1");
  await editor.press("Control+Space");
  const completion = page.getByRole("option", { name: /noise/ });
  await completion.first().waitFor({ state: "visible" });
  await expectParameter("sync = 0.1");
  // CodeMirror ignores acceptance during its initial 75 ms interaction guard.
  await page.waitForTimeout(100);
  await editor.press("Enter");
  assert.match(await editor.innerText(), /noise\(/);

  for (const [code, label, signature] of [
    ["noise(1,", "offset = 0.1", "noise(scale = 10, offset = 0.1)"],
    ["shape().rotate(0,", "speed = 0", "rotate(angle = 10, speed = 0)"],
    ["shape().color(", "r = 1", "color(r = 1, g = 1, b = 1, a = 1)"],
    ["shape().blend(osc(),", "amount = 0.5", "blend(texture, amount = 0.5)"],
    ["osc().modulate(noise(),", "amount = 0.1", "modulate(texture, amount = 0.1)"],
    ["osc().out(", "buffer = o0", "out(buffer = o0)"],
    ["setResolution(640,", "height", "setResolution(width, height)"],
    ["s0.initVideo(url,", "params", 'initVideo(url = "", params)'],
    ["a.setSmooth(", "smooth", "setSmooth(smooth)"],
    ["[1, 2].fast().fit(0,", "high = 1", "fit(low = 0, high = 1)"],
  ]) {
    await replace(code);
    await expectParameter(label, signature);
  }
  for (const code of ["osc(unknown(", "other.rotate(", "a.fft(", "osc(60, @"]) {
    await replace(code);
    await tip.waitFor({ state: "hidden" });
  }
  await replace("var carrier = () => osc(40, 0.02, 0);\ncarrier().diff(");
  await expectParameter("texture", "diff(texture)");
  await replace("var carrier = () => osc(40, 0.02, 0);\ncarrier().diff(osc()).rotate(0,");
  await expectParameter("speed = 0", "rotate(angle = 10, speed = 0)");
  await replace("osc(60, 1, 0,");
  await tip.waitFor({ state: "visible" });
  assert.equal(await active.count(), 0);

  const panel = page.locator("#editor-container");
  const oldWidth = await panel.evaluate((element) => element.style.width);
  await panel.evaluate((element) => {
    element.style.width = "400px";
  });
  await page.locator("body").evaluate((body) => body.classList.add("theme-light"));
  await replace("osc().scale(1,");
  await expectParameter(
    "xMult = 1",
    "scale(amount = 1.5, xMult = 1, yMult = 1, offsetX = 0.5, offsetY = 0.5)",
  );
  const narrowPanel = await panel.boundingBox();
  assert.ok(narrowPanel.width <= 420, "the editor panel should be narrow");
  const bounds = await tip.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width);
  if (process.env.SIGNATURE_NARROW_SCREENSHOT) {
    await page.screenshot({ path: process.env.SIGNATURE_NARROW_SCREENSHOT });
  }
  await page.locator("body").evaluate((body) => body.classList.remove("theme-light"));
  await panel.evaluate((element, width) => {
    element.style.width = width;
  }, oldWidth);

  await replace("osc(60,");
  await expectParameter("sync = 0.1");
  await page.locator('[data-tab="setup"]').click();
  await tip.waitFor({ state: "hidden" });
  await page.locator('[data-tab="main"]').click();
  await replace("osc(60,");
  await expectParameter("sync = 0.1");
  await page.locator('.slot[data-index="1"]').click();
  await tip.waitFor({ state: "hidden" });
  await replace("osc(60,");
  await expectParameter("sync = 0.1");
  await editor.press("Control+Backquote");
  await page.locator("body.ui-hidden").waitFor({ state: "attached" });
  await tip.waitFor({ state: "hidden" });
  await page.locator("body").press("Escape");
  await page.locator("body.ui-hidden").waitFor({ state: "detached" });

  const clampDoc = [
    "/**",
    " * Restricts a value to a specified range.",
    " * @param {number} value - Input value to constrain.",
    " * @param {number} min - Lower bound.",
    " * @param {number} max - Upper bound.",
    " */",
  ].join("\n");
  const setup = [
    clampDoc,
    "var clamp = (value, min, max) => Math.min(Math.max(value, min), max)",
    "/**",
    " * Interpolates between two values.",
    " * @param t - Interpolation factor.",
    " */",
    "function lerp(a, b, t) { return a + (b - a) * t }",
    "const tide = (period, amplitude = 1) => Math.sin(time * 2 * Math.PI / period) * amplitude",
  ].join("\n");
  await setupTab.click();
  await replace(`${setup}\nclamp(0.5,`);
  await expectParameter("min", "clamp(value, min, max)");
  await replace(setup);
  await sketchTab.click();
  // Switching tabs normally persists Setup. Prove discovery uses tab text even without storage.
  await page.evaluate(() => localStorage.removeItem("hydractrl-setup-code"));
  await replace("clamp(0.5,");
  await expectParameter("min", "clamp(value, min, max)");
  assert.equal(await summary.textContent(), "Restricts a value to a specified range.");
  assert.equal(await parameterDoc.textContent(), "Lower bound.");
  if (process.env.SIGNATURE_CUSTOM_SCREENSHOT) {
    await page.screenshot({ path: process.env.SIGNATURE_CUSTOM_SCREENSHOT });
  }
  // A hint can be created in the DOM but hidden offscreen if CodeMirror's
  // scroller and the editor panel disagree about the visible lines.
  await replace(`${"// Earlier code\n".repeat(35)}clamp(0.5,`);
  await expectParameter("min", "clamp(value, min, max)");
  await page.waitForFunction(() => {
    const scroller = document.querySelector(".cm-scroller");
    const hint = document.querySelector(".cm-signature-assist")?.getBoundingClientRect();
    return scroller.scrollTop > 0 && hint && hint.top >= 0 && hint.bottom <= innerHeight;
  });

  await replace("clamp(0.5,");
  await page.keyboard.insertText(" 0,");
  await expectParameter("max", "clamp(value, min, max)");
  assert.equal(await parameterDoc.textContent(), "Upper bound.");
  await replace("clamp(0.5, noi");
  await editor.press("Control+Space");
  await completion.first().waitFor({ state: "visible" });
  await expectParameter("min", "clamp(value, min, max)");
  assert.equal(await parameterDoc.textContent(), "Lower bound.");
  await page.waitForTimeout(100);
  await editor.press("Enter");
  assert.match(await editor.innerText(), /noise\(/);
  assert.equal(await tip.locator(".cm-signature-doc").count(), 0);

  await replace("clamp(0.5,");
  await setupTab.click();
  await replace(setup.replace("Lower bound.", "Lower limit. <em>literal</em>"));
  await sketchTab.click();
  await editor.press("End");
  await expectParameter("min", "clamp(value, min, max)");
  assert.equal(await parameterDoc.textContent(), "Lower limit. <em>literal</em>");
  assert.equal(await parameterDoc.locator("em").count(), 0);

  await panel.evaluate((element) => {
    element.style.width = "400px";
  });
  await page.locator("body").evaluate((body) => body.classList.add("theme-light"));
  await replace("clamp(0.5,");
  await expectParameter("min", "clamp(value, min, max)");
  await parameterDoc.waitFor({ state: "visible" });
  // CodeMirror positions tooltips in a measure pass after inserting their DOM.
  await page.waitForFunction(
    () => {
      const bounds = document.querySelector(".cm-signature-assist")?.getBoundingClientRect();
      return (
        bounds &&
        bounds.left >= 0 &&
        bounds.right <= innerWidth &&
        bounds.top >= 0 &&
        bounds.bottom <= innerHeight
      );
    },
    null,
    { timeout: 8_000 },
  );
  if (process.env.SIGNATURE_DOC_NARROW_SCREENSHOT) {
    await page.screenshot({ path: process.env.SIGNATURE_DOC_NARROW_SCREENSHOT });
  }
  await page.locator("body").evaluate((body) => body.classList.remove("theme-light"));
  await panel.evaluate((element, width) => {
    element.style.width = width;
  }, oldWidth);

  await setupTab.click();
  await replace(setup.replace(`${clampDoc}\n`, ""));
  await sketchTab.click();
  await editor.press("End");
  await expectParameter("min", "clamp(value, min, max)");
  assert.equal(await tip.locator(".cm-signature-doc").count(), 0);
  await replace("lerp(0, 1,");
  await expectParameter("t", "lerp(a, b, t)");
  assert.equal(await parameterDoc.textContent(), "Interpolation factor.");
  await replace("tide(20,");
  await expectParameter("amplitude = 1", "tide(period, amplitude = 1)");
  assert.equal(await tip.locator(".cm-signature-doc").count(), 0);
  await setupTab.click();
  await replace(setup.replaceAll("amplitude", "depth").replace("depth = 1", "depth = 2"));
  await sketchTab.click();
  await replace("osc(tide(20,");
  await expectParameter("depth = 2", "tide(period, depth = 2)");
  await page.keyboard.insertText(" 2),");
  await expectParameter("sync = 0.1");
  await editor.press("Escape");
  await tip.waitFor({ state: "hidden" });

  await setupTab.click();
  await replace(setup.replace("const tide", "const wave"));
  await sketchTab.click();
  await replace("tide(20,");
  await tip.waitFor({ state: "hidden" });
  await replace("wave(20,");
  await expectParameter("amplitude = 1", "wave(period, amplitude = 1)");
  await replace("/** Local only. */\nconst local = (left, right) => left; local(1,");
  await expectParameter("right", "local(left, right)");
  assert.equal(await summary.textContent(), "Local only.");
  await replace("const local = (left, edited = 1) => left; local(1,");
  await expectParameter("edited = 1", "local(left, edited = 1)");
  assert.equal(await summary.count(), 0);
  await page.locator('.slot[data-index="2"]').click();
  await replace("local(1,");
  await tip.waitFor({ state: "hidden" });
  await replace("osc(clamp(0.5,");
  await expectParameter("min", "clamp(value, min, max)");
  assert.equal(await parameterDoc.textContent(), "Lower bound.");
  await page.keyboard.insertText(" 0, 1),");
  await expectParameter("sync = 0.1");
  assert.equal(await tip.locator(".cm-signature-doc").count(), 0);
  await replace("function osc(custom) {} osc(");
  await expectParameter("custom", "osc(custom)");
  await replace("function osc(custom) {} osc().rotate(");
  await tip.waitFor({ state: "hidden" });
  await replace("const clamp = factory(); clamp(");
  await tip.waitFor({ state: "hidden" });
  await replace("osc(60,");
  await expectParameter("sync = 0.1");

  await page.evaluate(() => {
    window.testRuns = [];
    window.hydractrl.events.on("sketch:run", ({ main }) => window.testRuns.push(main));
  });
  await page.locator("#auto-run-checkbox").check();
  for (const frequency of [15, 25]) {
    const code = `osc(${frequency}, 0.1).out()`;
    await replace(code);
    await editor.press("Space");
    await page.waitForFunction(
      (expected) => window.testRuns.some((code) => code?.trim() === expected),
      code,
    );
    assert.equal(await page.locator("#hydra-canvas canvas").first().isVisible(), true);
    const beforeDraws = await page.evaluate(() => window.hydraDraws);
    await page.waitForFunction((before) => window.hydraDraws > before, beforeDraws);
    console.log(
      `Auto-run and WebGL draws observed with signature assist ${frequency === 15 ? "enabled" : "disabled"}.`,
    );

    if (frequency === 15) {
      await replace("osc(60,");
      await expectParameter("sync = 0.1");
      assert.equal(
        await page.evaluate(() => window.hydractrl.plugins.unregister("signature-assist")),
        true,
      );
      await tip.waitFor({ state: "detached" });
      await replace("osc(60,");
      assert.equal(await tip.count(), 0);
    }
  }

  assert.deepEqual(errors, []);
  console.log(
    "Passed native and custom signatures, JSDoc and unsaved edits, nesting, autocomplete, scrolling, tab undo and redo, slot, visibility, disposal and auto-run checks.",
  );
} finally {
  await browser.close();
}
