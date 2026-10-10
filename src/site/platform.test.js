import { describe, expect, test } from "bun:test";
import { detectArchitecture, detectPlatform } from "./platform.js";

const UA = {
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  windowsArm: "Mozilla/5.0 (Windows NT 10.0; ARM64) AppleWebKit/537.36 (KHTML, like Gecko)",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
  iPhone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
};

describe("detectPlatform", () => {
  test("recognises desktops", () => {
    expect(detectPlatform({ userAgent: UA.macSafari, platform: "MacIntel" })).toEqual({
      os: "mac",
      arch: null,
    });
    expect(detectPlatform({ userAgent: UA.windowsChrome, platform: "Win32" })).toEqual({
      os: "windows",
      arch: "x64",
    });
    expect(detectPlatform({ userAgent: UA.windowsArm, platform: "Win32" }).arch).toBe("arm64");
    expect(detectPlatform({ userAgent: UA.linuxFirefox, platform: "Linux x86_64" }).os).toBe(
      "linux",
    );
  });

  test("prefers client hints over the legacy platform string", () => {
    expect(
      detectPlatform({ userAgent: "", platform: "", userAgentData: { platform: "macOS" } }).os,
    ).toBe("mac");
  });

  test("treats phones and iPads (which claim to be Macs) as mobile", () => {
    expect(detectPlatform({ userAgent: UA.iPhone, platform: "iPhone" }).os).toBe("mobile");
    expect(detectPlatform({ userAgent: UA.android, platform: "Linux armv8l" }).os).toBe("mobile");
    expect(
      detectPlatform({ userAgent: UA.macSafari, platform: "MacIntel", maxTouchPoints: 5 }).os,
    ).toBe("mobile");
  });

  test("falls back to unknown", () => {
    expect(detectPlatform({})).toEqual({ os: "unknown", arch: null });
    expect(detectPlatform(undefined)).toEqual({ os: "unknown", arch: null });
  });
});

describe("detectArchitecture", () => {
  const withHints = (architecture) => ({
    userAgentData: { getHighEntropyValues: async () => ({ architecture }) },
  });

  test("maps client hints to download architectures", async () => {
    expect(await detectArchitecture(withHints("arm"))).toBe("arm64");
    expect(await detectArchitecture(withHints("x86"))).toBe("x64");
    expect(await detectArchitecture(withHints(""))).toBeNull();
  });

  test("returns null without client hints or when they fail", async () => {
    expect(await detectArchitecture({})).toBeNull();
    expect(
      await detectArchitecture({
        userAgentData: {
          getHighEntropyValues: async () => {
            throw new Error("blocked");
          },
        },
      }),
    ).toBeNull();
  });
});
