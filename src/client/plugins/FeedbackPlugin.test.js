import { describe, expect, test } from "bun:test";
import { FEEDBACK_FORM_ID } from "../../project.js";
import { describeSystem, feedbackFormUrl, readFormMessage } from "./FeedbackPlugin.js";

const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const LINUX_FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0";
const DESKTOP_APP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HYDRACTRL/1.2.0 Chrome/140.0.7339.41 Electron/38.1.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

describe("describeSystem", () => {
  test("names the OS and the browser with its major version", () => {
    expect(describeSystem({ userAgent: MAC_CHROME, platform: "MacIntel" })).toEqual({
      app: "browser",
      os: "macOS",
      browser: "Chrome 140",
    });
    expect(describeSystem({ userAgent: MAC_SAFARI, platform: "MacIntel" }).browser).toBe(
      "Safari 18",
    );
    expect(describeSystem({ userAgent: WINDOWS_EDGE, platform: "Win32" })).toEqual({
      app: "browser",
      os: "Windows",
      browser: "Edge 140",
    });
    expect(describeSystem({ userAgent: LINUX_FIREFOX, platform: "Linux x86_64" })).toEqual({
      app: "browser",
      os: "Linux",
      browser: "Firefox 143",
    });
  });

  test("tells the desktop app apart", () => {
    const system = describeSystem(
      { userAgent: DESKTOP_APP, platform: "MacIntel" },
      { desktop: true },
    );
    expect(system).toEqual({ app: "desktop", os: "macOS", browser: "Electron 38" });
  });

  test("recognizes phones and tablets, including an iPad in desktop mode", () => {
    expect(describeSystem({ userAgent: IPHONE, platform: "iPhone", maxTouchPoints: 5 }).os).toBe(
      "iOS",
    );
    expect(describeSystem({ userAgent: ANDROID_CHROME, platform: "Linux armv8l" }).os).toBe(
      "Android",
    );
    const ipad = describeSystem({ userAgent: MAC_SAFARI, platform: "MacIntel", maxTouchPoints: 5 });
    expect(ipad.os).toBe("iPadOS");
  });

  test("falls back to other", () => {
    expect(describeSystem({})).toEqual({ app: "browser", os: "other", browser: "other" });
    expect(describeSystem(undefined)).toEqual({ app: "browser", os: "other", browser: "other" });
  });
});

describe("feedbackFormUrl", () => {
  const system = { app: "desktop", os: "macOS", browser: "Electron 38" };

  test("embeds the form with the hidden fields filled in", () => {
    const url = new URL(feedbackFormUrl(system, { version: "1.2.0" }));
    expect(url.origin).toBe("https://tally.so");
    expect(url.pathname).toBe(`/embed/${FEEDBACK_FORM_ID}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      hideTitle: "1",
      alignLeft: "1",
      source: "app",
      version: "1.2.0",
      app: "desktop",
      os: "macOS",
      browser: "Electron 38",
    });
  });

  test("links the stand-alone form for a browser tab", () => {
    const url = new URL(feedbackFormUrl(system, { version: "1.2.0", embed: false }));
    expect(url.pathname).toBe(`/r/${FEEDBACK_FORM_ID}`);
    expect(url.searchParams.get("hideTitle")).toBeNull();
    expect(url.searchParams.get("source")).toBe("app");
  });
});

describe("readFormMessage", () => {
  const message = (data, origin = "https://tally.so") => ({ origin, data });

  test("reads Tally's events", () => {
    const loaded = JSON.stringify({ event: "Tally.FormLoaded", payload: { formId: "3Erq04" } });
    expect(readFormMessage(message(loaded))).toEqual({
      event: "Tally.FormLoaded",
      payload: { formId: "3Erq04" },
    });
  });

  test("ignores other origins, other events and anything that isn't JSON", () => {
    const submitted = JSON.stringify({ event: "Tally.FormSubmitted", payload: {} });
    expect(readFormMessage(message(submitted, "https://example.com"))).toBeNull();
    expect(readFormMessage(message(JSON.stringify({ event: "other" })))).toBeNull();
    expect(readFormMessage(message("[iFrameSizer]1:2"))).toBeNull();
    expect(readFormMessage(message({ event: "Tally.FormLoaded" }))).toBeNull();
    expect(readFormMessage(null)).toBeNull();
  });
});
