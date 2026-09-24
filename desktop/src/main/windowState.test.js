import { describe, expect, test } from "bun:test";
import { DEFAULT_WINDOW_STATE, MIN_WINDOW_SIZE, sanitizeBounds } from "./windowState.js";

const primary = { x: 0, y: 0, width: 2560, height: 1415 };
const secondary = { x: 2560, y: 0, width: 1920, height: 1080 };

describe("sanitizeBounds", () => {
  test("keeps a position that is on a display", () => {
    const result = sanitizeBounds({ x: 100, y: 50, width: 1400, height: 800 }, [primary]);
    expect(result).toEqual({ x: 100, y: 50, width: 1400, height: 800, maximized: false });
  });

  test("keeps a position on a secondary display", () => {
    const result = sanitizeBounds({ x: 2600, y: 40, width: 1200, height: 700 }, [
      primary,
      secondary,
    ]);
    expect(result.x).toBe(2600);
  });

  test("drops a position that is off every display", () => {
    const result = sanitizeBounds({ x: 2600, y: 40, width: 1200, height: 700 }, [primary]);
    expect(result.x).toBeUndefined();
    expect(result.y).toBeUndefined();
    expect(result.width).toBe(1200);
  });

  test("enforces the minimum size and caps to the largest display", () => {
    const small = sanitizeBounds({ width: 10, height: 10 }, [primary]);
    expect(small.width).toBe(MIN_WINDOW_SIZE.width);
    expect(small.height).toBe(MIN_WINDOW_SIZE.height);
    const huge = sanitizeBounds({ width: 9000, height: 9000 }, [primary, secondary]);
    expect(huge.width).toBe(primary.width);
    expect(huge.height).toBe(primary.height);
  });

  test("falls back to defaults for garbage", () => {
    const result = sanitizeBounds("nope", [primary]);
    expect(result.width).toBe(DEFAULT_WINDOW_STATE.width);
    expect(result.height).toBe(DEFAULT_WINDOW_STATE.height);
    expect(result.maximized).toBe(false);
    expect(sanitizeBounds({ maximized: true }, [primary]).maximized).toBe(true);
  });

  test("works with no displays known", () => {
    const result = sanitizeBounds({ x: 5, y: 5, width: 1200, height: 800 }, []);
    expect(result.width).toBe(1200);
    expect(result.x).toBeUndefined();
  });
});
