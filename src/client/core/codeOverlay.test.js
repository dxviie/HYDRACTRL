import { describe, expect, test } from "bun:test";
import {
  BLEND_MODES as DESKTOP_BLEND_MODES,
  DEFAULT_SETTINGS as DESKTOP_DEFAULTS,
} from "../../../desktop/src/main/settings.js";
import {
  BLEND_MODES,
  DEFAULT_CODE_OVERLAY,
  LINE_HEIGHT,
  blendModeLabel,
  fitCodeOverlay,
  measureCode,
  normalizeCodeOverlay,
  sameCodeOverlay,
} from "./codeOverlay.js";

describe("normalizeCodeOverlay", () => {
  test("fills in the defaults", () => {
    expect(normalizeCodeOverlay(null)).toEqual(DEFAULT_CODE_OVERLAY);
    expect(normalizeCodeOverlay("on")).toEqual(DEFAULT_CODE_OVERLAY);
  });

  test("keeps the base value for anything unusable", () => {
    const base = { visible: true, blendMode: "screen", opacity: 0.5 };
    expect(
      normalizeCodeOverlay({ visible: "yes", blendMode: "plus-darker", opacity: "1" }, base),
    ).toEqual(base);
    expect(normalizeCodeOverlay({ opacity: Number.NaN }, base)).toEqual(base);
  });

  test("clamps the opacity and rounds it to hundredths", () => {
    expect(normalizeCodeOverlay({ opacity: 1.5 }).opacity).toBe(1);
    expect(normalizeCodeOverlay({ opacity: -0.2 }).opacity).toBe(0);
    expect(normalizeCodeOverlay({ opacity: 0.333 }).opacity).toBe(0.33);
  });

  test("compares settings by value", () => {
    expect(sameCodeOverlay(DEFAULT_CODE_OVERLAY, { ...DEFAULT_CODE_OVERLAY })).toBe(true);
    expect(sameCodeOverlay(DEFAULT_CODE_OVERLAY, { ...DEFAULT_CODE_OVERLAY, opacity: 0.9 })).toBe(
      false,
    );
    expect(sameCodeOverlay(DEFAULT_CODE_OVERLAY, null)).toBe(false);
  });
});

describe("blend modes", () => {
  test("label for menus", () => {
    expect(blendModeLabel("normal")).toBe("Normal");
    expect(blendModeLabel("color-dodge")).toBe("Color dodge");
  });

  test("the desktop app keeps the same list and defaults", () => {
    expect([...DESKTOP_BLEND_MODES]).toEqual([...BLEND_MODES]);
    expect(DESKTOP_DEFAULTS.codeOverlay).toEqual(DEFAULT_CODE_OVERLAY);
  });
});

describe("measureCode", () => {
  test("counts lines and the longest one, tabs as two spaces, trailing blank lines not", () => {
    expect(measureCode("osc(10)\n\t.out()\n\n\n")).toEqual({ lines: 2, columns: 8 });
    expect(measureCode("")).toEqual({ lines: 1, columns: 0 });
  });
});

describe("fitCodeOverlay", () => {
  test("a short sketch gets the largest size, in step with the view's height", () => {
    const hd = fitCodeOverlay({ lines: 3, columns: 20 }, 1920, 1080);
    const uhd = fitCodeOverlay({ lines: 3, columns: 20 }, 3840, 2160);
    expect(hd.fontSize).toBeCloseTo(1080 * 0.028, 0);
    expect(uhd.fontSize).toBeCloseTo(hd.fontSize * 2, 0);
    expect(Math.abs(uhd.margin - hd.margin * 2)).toBeLessThanOrEqual(1);
  });

  test("a long sketch shrinks to fit the height", () => {
    const { fontSize, margin } = fitCodeOverlay({ lines: 50, columns: 30 }, 1920, 1080);
    expect(fontSize * LINE_HEIGHT * 50).toBeLessThanOrEqual(1080 - 2 * margin);
    expect(fontSize).toBeLessThan(1080 * 0.028);
  });

  test("a wide sketch shrinks to fit the width, never below the smallest size", () => {
    const wide = fitCodeOverlay({ lines: 5, columns: 150 }, 1280, 720);
    expect(wide.fontSize).toBeLessThan(720 * 0.028);
    const huge = fitCodeOverlay({ lines: 400, columns: 400 }, 1920, 1080);
    expect(huge.fontSize).toBeCloseTo(1080 * 0.011, 0);
  });
});
