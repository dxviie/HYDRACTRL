import { describe, expect, test } from "bun:test";
import { nextUiAction } from "./uiCycle.js";

describe("nextUiAction", () => {
  test("hides a visible UI, whatever the step", () => {
    expect(nextUiAction({ visible: true, hasStep: true, stepTaken: false })).toBe("hide");
    expect(nextUiAction({ visible: true, hasStep: false, stepTaken: false })).toBe("hide");
  });

  test("takes the step once while hidden, then shows the UI", () => {
    expect(nextUiAction({ visible: false, hasStep: true, stepTaken: false })).toBe("step");
    expect(nextUiAction({ visible: false, hasStep: true, stepTaken: true })).toBe("show");
  });

  test("is a plain toggle without a step", () => {
    expect(nextUiAction({ visible: false, hasStep: false, stepTaken: false })).toBe("show");
  });
});
