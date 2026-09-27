import { describe, expect, test } from "bun:test";
import { isPhone, isTouchFirst } from "./DeviceDetection.js";

// A browser environment: its screen size and whether the main pointer is a finger
function device(width, height, { touch }) {
  return {
    screen: { width, height },
    matchMedia: (query) => ({ matches: touch && query === "(pointer: coarse)" }),
  };
}

describe("isPhone", () => {
  test("recognises phones in either orientation", () => {
    expect(isPhone(device(390, 844, { touch: true }))).toBe(true); // iPhone 13
    expect(isPhone(device(932, 430, { touch: true }))).toBe(true); // iPhone Pro Max, landscape
    expect(isPhone(device(412, 915, { touch: true }))).toBe(true); // Pixel
  });

  test("gives iPads and other tablets the full interface", () => {
    expect(isPhone(device(744, 1133, { touch: true }))).toBe(false); // iPad mini
    expect(isPhone(device(820, 1180, { touch: true }))).toBe(false); // iPad Air
    expect(isPhone(device(1366, 1024, { touch: true }))).toBe(false); // iPad Pro, landscape
    expect(isPhone(device(800, 1280, { touch: true }))).toBe(false); // Android tablet
  });

  test("never treats a mouse-driven computer as a phone", () => {
    expect(isPhone(device(1440, 900, { touch: false }))).toBe(false);
    // Firefox shrinks the reported screen when the page is zoomed in
    expect(isPhone(device(480, 300, { touch: false }))).toBe(false);
  });

  test("falls back to the full interface without matchMedia", () => {
    expect(isTouchFirst({})).toBe(false);
    expect(isPhone({ screen: { width: 390, height: 844 } })).toBe(false);
  });
});
