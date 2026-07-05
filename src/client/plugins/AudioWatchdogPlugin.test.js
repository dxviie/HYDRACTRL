import { describe, expect, test } from "bun:test";
import { isFlatFrame } from "./AudioWatchdogPlugin.js";

describe("isFlatFrame", () => {
  test("treats missing or empty FFT data as flat", () => {
    expect(isFlatFrame(null)).toBe(true);
    expect(isFlatFrame(undefined)).toBe(true);
    expect(isFlatFrame([])).toBe(true);
    expect(isFlatFrame({})).toBe(true);
  });

  test("detects silence", () => {
    expect(isFlatFrame([0, 0, 0, 0, 0, 0])).toBe(true);
    expect(isFlatFrame(new Float32Array(6))).toBe(true);
  });

  test("detects live signal", () => {
    expect(isFlatFrame([0.2, 0.05, 0.4, 0, 0, 0.01])).toBe(false);
    expect(isFlatFrame(new Float32Array([0, 0, 0.5, 0, 0, 0]))).toBe(false);
  });

  test("ignores sub-epsilon noise", () => {
    expect(isFlatFrame([0.00001, 0, 0, 0, 0, 0])).toBe(true);
  });

  test("handles NaN/undefined bins defensively", () => {
    const withHoles = [0.3, undefined, Number.NaN, 0, 0, 0];
    expect(isFlatFrame(withHoles)).toBe(false);
  });

  test("respects a custom epsilon", () => {
    expect(isFlatFrame([0.01, 0, 0, 0], 0.1)).toBe(true);
    expect(isFlatFrame([0.2, 0, 0, 0], 0.1)).toBe(false);
  });
});
