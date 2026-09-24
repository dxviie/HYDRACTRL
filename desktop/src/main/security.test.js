import { describe, expect, test } from "bun:test";
import {
  createSecurityPolicy,
  isAllowedExternalUrl,
  isTrustedUrl,
  serverOrigins,
} from "./security.js";

describe("url policies", () => {
  test("external links are limited to https on known hosts", () => {
    expect(isAllowedExternalUrl("https://github.com/dxviie/HYDRACTRL")).toBe(true);
    expect(isAllowedExternalUrl("https://hydra.ojack.xyz/docs/")).toBe(true);
    expect(isAllowedExternalUrl("http://github.com/x")).toBe(false);
    expect(isAllowedExternalUrl("https://evil.example/")).toBe(false);
    expect(isAllowedExternalUrl("not a url")).toBe(false);
  });

  test("server origins cover both loopback spellings", () => {
    expect(serverOrigins("http://127.0.0.1:3005")).toEqual([
      "http://127.0.0.1:3005",
      "http://localhost:3005",
    ]);
    expect(serverOrigins(null)).toEqual([]);
  });

  test("trusted urls are our pages, the server, blank popups and devtools", () => {
    const origins = serverOrigins("http://127.0.0.1:3000");
    expect(isTrustedUrl("http://localhost:3000/output", origins)).toBe(true);
    expect(isTrustedUrl("http://127.0.0.1:3000/#sketch=abc", origins)).toBe(true);
    expect(isTrustedUrl("about:blank", origins)).toBe(true);
    expect(isTrustedUrl("", origins)).toBe(true);
    expect(isTrustedUrl("file:///app/src/renderer/settings.html", origins)).toBe(true);
    expect(isTrustedUrl("http://127.0.0.1:9999/", origins)).toBe(false);
    expect(isTrustedUrl("https://example.com/", origins)).toBe(false);
  });
});

function fakeContents(url) {
  const handlers = {};
  let openHandler = null;
  return {
    getURL: () => url,
    on: (event, handler) => {
      handlers[event] = handler;
    },
    setWindowOpenHandler: (handler) => {
      openHandler = handler;
    },
    navigate: (target) => {
      let prevented = false;
      const event = {
        preventDefault: () => {
          prevented = true;
        },
      };
      handlers["will-navigate"](event, target);
      return prevented;
    },
    open: (target) => openHandler({ url: target }),
  };
}

describe("createSecurityPolicy", () => {
  function setup() {
    const opened = [];
    const denied = [];
    const policy = createSecurityPolicy({
      getServerUrl: () => "http://127.0.0.1:3000",
      shell: { openExternal: async (url) => opened.push(url) },
      desktopCapturer: { getSources: async () => [{ id: "screen:0", name: "Screen" }] },
      log: { warn: (m) => denied.push(m), info() {}, error() {} },
    });
    return { policy, opened, denied };
  }

  test("keeps navigation inside the app and sends the rest to the browser", () => {
    const { policy, opened } = setup();
    const contents = fakeContents("http://127.0.0.1:3000/");
    policy.attachToContents(contents);
    expect(contents.navigate("http://127.0.0.1:3000/output")).toBe(false);
    expect(contents.navigate("https://hydra.ojack.xyz/")).toBe(true);
    expect(opened).toEqual(["https://hydra.ojack.xyz/"]);
  });

  test("allows the breakout popup and denies everything else", () => {
    const { policy, opened } = setup();
    const contents = fakeContents("http://127.0.0.1:3000/");
    policy.attachToContents(contents);
    const popup = contents.open("about:blank");
    expect(popup.action).toBe("allow");
    expect(popup.overrideBrowserWindowOptions.webPreferences.sandbox).toBe(true);
    expect(contents.open("https://github.com/dxviie/HYDRACTRL").action).toBe("deny");
    expect(opened).toEqual(["https://github.com/dxviie/HYDRACTRL"]);
    expect(contents.open("javascript:alert(1)").action).toBe("deny");
    expect(opened).toHaveLength(1);
  });

  test("grants only the listed permissions to our own pages", () => {
    const { policy, denied } = setup();
    let requestHandler;
    let checkHandler;
    let displayHandler;
    policy.installOnSession({
      setPermissionRequestHandler: (h) => {
        requestHandler = h;
      },
      setPermissionCheckHandler: (h) => {
        checkHandler = h;
      },
      setDisplayMediaRequestHandler: (h) => {
        displayHandler = h;
      },
    });
    const results = [];
    const contents = { getURL: () => "http://localhost:3000/" };
    requestHandler(contents, "media", (ok) => results.push(ok), {
      requestingUrl: "http://localhost:3000/",
    });
    requestHandler(contents, "geolocation", (ok) => results.push(ok), {});
    requestHandler(contents, "media", (ok) => results.push(ok), {
      requestingUrl: "https://evil.example/",
    });
    expect(results).toEqual([true, false, false]);
    expect(denied).toHaveLength(2);
    expect(checkHandler(contents, "midi", "http://127.0.0.1:3000")).toBe(true);
    expect(checkHandler(contents, "notifications", "http://127.0.0.1:3000")).toBe(false);

    return new Promise((resolve) => {
      displayHandler({}, (streams) => {
        expect(streams.video.id).toBe("screen:0");
        resolve();
      });
    });
  });
});
