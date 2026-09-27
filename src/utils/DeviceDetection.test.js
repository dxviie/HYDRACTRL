import { describe, expect, test } from "bun:test";
import { isPhone, isTablet, isTouchFirst } from "./DeviceDetection.js";

const UA = {
  iPad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  iPhone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

// A browser environment: its screen size, whether the main pointer is a
// finger, and what the browser says about itself
function device(width, height, { touch, ua = "", platform = "", touchPoints = 0 }) {
  return {
    screen: { width, height },
    matchMedia: (query) => ({ matches: touch && query === "(pointer: coarse)" }),
    navigator: { userAgent: ua, platform, maxTouchPoints: touchPoints },
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

describe("isTablet", () => {
  test("recognises iPads, including in desktop mode, and Android tablets", () => {
    expect(isTablet(device(820, 1180, { touch: true, ua: UA.iPad, touchPoints: 5 }))).toBe(true);
    const desktopMode = { ua: UA.mac, platform: "MacIntel", touchPoints: 5 };
    expect(isTablet(device(1180, 820, { touch: true, ...desktopMode }))).toBe(true);
    // With a trackpad attached the main pointer may no longer be a finger
    expect(isTablet(device(1180, 820, { touch: false, ...desktopMode }))).toBe(true);
    expect(isTablet(device(800, 1280, { touch: true, ua: UA.androidTablet }))).toBe(true);
  });

  test("leaves out phones, Macs and touch-screen PCs", () => {
    expect(isTablet(device(390, 844, { touch: true, ua: UA.iPhone, touchPoints: 5 }))).toBe(false);
    expect(isTablet(device(1440, 900, { touch: false, ua: UA.mac, platform: "MacIntel" }))).toBe(
      false,
    );
    // A Surface without its keyboard: touch first, but MIDI and windows work
    const surface = { ua: UA.windows, platform: "Win32", touchPoints: 10 };
    expect(isTablet(device(1368, 912, { touch: true, ...surface }))).toBe(false);
  });
});
