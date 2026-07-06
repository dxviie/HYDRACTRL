import { describe, expect, test } from "bun:test";
import { buildWindowFeatures } from "./BreakoutPlugin.js";

describe("buildWindowFeatures", () => {
  test("includes the requested dimensions", () => {
    const features = buildWindowFeatures(1920, 1080);
    expect(features).toContain("width=1920");
    expect(features).toContain("height=1080");
  });

  test("strips browser chrome and stays resizable", () => {
    const features = buildWindowFeatures(800, 600);
    expect(features).toContain("menubar=no");
    expect(features).toContain("toolbar=no");
    expect(features).toContain("location=no");
    expect(features).toContain("status=no");
    expect(features).toContain("resizable=yes");
  });

  test("defaults to 1280x720", () => {
    const features = buildWindowFeatures();
    expect(features).toContain("width=1280");
    expect(features).toContain("height=720");
  });
});
