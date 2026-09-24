import { describe, expect, test } from "bun:test";
import { createDesktopOutputPlugin, describeOutput } from "./DesktopOutputPlugin.js";

describe("describeOutput", () => {
  test("handles missing and unavailable output", () => {
    expect(describeOutput(null).tone).toBe("unavailable");
    const info = describeOutput({ available: false, unavailableReason: "Needs macOS" });
    expect(info.tone).toBe("unavailable");
    expect(info.title).toBe("Needs macOS");
    expect(info.action).toBe(null);
  });

  test("describes running output with live fps", () => {
    const info = describeOutput({
      available: true,
      protocol: "Syphon",
      state: "running",
      name: "HYDRACTRL",
      width: 1920,
      height: 1080,
      fps: 60,
    });
    expect(info).toEqual({
      tone: "running",
      text: "Syphon · 1920×1080 · 60 fps",
      title: "HYDRACTRL is live",
      action: "Stop",
    });
    expect(
      describeOutput({ available: true, protocol: "Spout", state: "running", fps: null }).text,
    ).toContain("– fps");
  });

  test("describes starting, error and stopped states", () => {
    expect(describeOutput({ available: true, protocol: "Spout", state: "starting" })).toEqual({
      tone: "starting",
      text: "Starting Spout…",
      title: "",
      action: null,
    });
    const error = describeOutput({
      available: true,
      protocol: "Syphon",
      state: "error",
      error: "boom",
    });
    expect(error.tone).toBe("error");
    expect(error.title).toBe("boom");
    expect(error.action).toBe("Start");
    expect(describeOutput({ available: true, protocol: "Syphon", state: "stopped" }).action).toBe(
      "Start",
    );
  });
});

describe("createDesktopOutputPlugin", () => {
  test("does nothing outside the desktop app", () => {
    const plugin = createDesktopOutputPlugin({ bridge: null });
    const result = plugin.setup({ getPanels: () => ({ stats: undefined }), notify() {} });
    expect(result).toBeUndefined();
  });
});
