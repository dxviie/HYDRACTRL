import { describe, expect, test } from "bun:test";
import { buildMenuTemplate, outputToggleLabel } from "./menu.js";
import { validateSettings } from "./settings.js";

function makeState(overrides = {}) {
  return {
    output: {
      available: true,
      protocol: "Syphon",
      state: "stopped",
      ...overrides.output,
    },
    settings: validateSettings(overrides.settings || {}),
    server: { url: "http://127.0.0.1:3000", ...overrides.server },
  };
}

function noopActions() {
  const calls = [];
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  return {
    calls,
    actions: new Proxy(
      {},
      {
        get: (_target, name) => record(name),
      },
    ),
  };
}

function find(template, label) {
  return template.find((item) => item.label === label);
}

describe("outputToggleLabel", () => {
  test("reflects availability and state", () => {
    expect(outputToggleLabel({ available: false, state: "stopped" })).toBe("Output Unavailable");
    expect(outputToggleLabel({ available: true, state: "stopped" })).toBe("Start Output");
    expect(outputToggleLabel({ available: true, state: "running" })).toBe("Stop Output");
    expect(outputToggleLabel({ available: true, state: "starting" })).toBe("Starting Output…");
    expect(outputToggleLabel({ available: true, state: "error" })).toBe("Start Output");
  });
});

describe("buildMenuTemplate", () => {
  test("macOS gets an app menu first, Windows gets About under Help", () => {
    const mac = buildMenuTemplate({
      platform: "darwin",
      appName: "HYDRACTRL",
      state: makeState(),
      actions: noopActions().actions,
    });
    expect(mac[0].label).toBe("HYDRACTRL");
    expect(mac[0].submenu[0].role).toBe("about");
    expect(find(mac, "Help").submenu.some((i) => i.label === "About HYDRACTRL")).toBe(false);

    const win = buildMenuTemplate({
      platform: "win32",
      appName: "HYDRACTRL",
      state: makeState(),
      actions: noopActions().actions,
    });
    expect(win[0].label).toBe("File");
    expect(find(win, "Help").submenu.some((i) => i.label === "About HYDRACTRL")).toBe(true);
    expect(find(win, "Edit").submenu.map((i) => i.role)).toContain("paste");
  });

  test("output menu reflects state, checks the active preset and wires actions", () => {
    const { actions, calls } = noopActions();
    const template = buildMenuTemplate({
      platform: "darwin",
      appName: "HYDRACTRL",
      state: makeState({
        output: { state: "running" },
        settings: { output: { width: 3840, height: 2160, frameRate: 30, preview: true } },
      }),
      actions,
    });
    const output = find(template, "Output").submenu;
    expect(output[0].label).toBe("Stop Output");
    expect(output[0].enabled).toBe(true);
    expect(output[1].enabled).toBe(true);

    const resolution = find(output, "Resolution").submenu;
    expect(resolution.find((i) => i.checked).label).toContain("4K");
    const frameRate = find(output, "Frame Rate").submenu;
    expect(frameRate.find((i) => i.checked).label).toBe("30 fps");
    expect(find(output, "Show Preview Window").checked).toBe(true);

    output[0].click();
    resolution[1].click();
    frameRate[0].click();
    find(output, "Include Alpha Channel").click({ checked: true });
    expect(calls).toEqual([
      ["toggleOutput"],
      ["setResolution", 1920, 1080],
      ["setFrameRate", 24],
      ["setIncludeAlpha", true],
    ]);
  });

  test("custom sizes and frame rates show as checked custom entries", () => {
    const template = buildMenuTemplate({
      platform: "win32",
      appName: "HYDRACTRL",
      state: makeState({ settings: { output: { width: 1000, height: 500, frameRate: 48 } } }),
      actions: noopActions().actions,
    });
    const output = find(template, "Output").submenu;
    const custom = find(output, "Resolution").submenu.at(-1);
    expect(custom.checked).toBe(true);
    expect(custom.label).toContain("1000×500");
    const rate = find(output, "Frame Rate").submenu.at(-1);
    expect(rate.checked).toBe(true);
    expect(rate.label).toBe("48 fps (custom)");
  });

  test("disables the toggle when output is unavailable or starting", () => {
    const unavailable = buildMenuTemplate({
      platform: "linux",
      appName: "HYDRACTRL",
      state: makeState({ output: { available: false, state: "stopped" } }),
      actions: noopActions().actions,
    });
    expect(find(unavailable, "Output").submenu[0].enabled).toBe(false);
    const starting = buildMenuTemplate({
      platform: "darwin",
      appName: "HYDRACTRL",
      state: makeState({ output: { state: "starting" } }),
      actions: noopActions().actions,
    });
    expect(find(starting, "Output").submenu[0].enabled).toBe(false);
  });

  test("server items are disabled until the server has an address", () => {
    const template = buildMenuTemplate({
      platform: "win32",
      appName: "HYDRACTRL",
      state: makeState({ server: { url: null } }),
      actions: noopActions().actions,
    });
    expect(find(template, "File").submenu[0].enabled).toBe(false);
  });
});
