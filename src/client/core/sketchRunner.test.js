import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { combineSketchCode, executeSketch } from "./sketchRunner.js";

function createFakeHydra(calls) {
  return {
    hush: () => calls.push(["hush"]),
    osc: (...args) => {
      calls.push(["osc", ...args]);
      return { out: () => calls.push(["out"]) };
    },
    eval: () => calls.push(["eval"]),
    notAFunction: 42,
  };
}

let errorSpy;
beforeEach(() => {
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe("combineSketchCode", () => {
  test("puts setup before main, separated by a blank line", () => {
    expect(combineSketchCode("a.setBins(6)", "osc().out()")).toBe("a.setBins(6)\n\nosc().out()");
  });

  test("trims and tolerates missing parts", () => {
    expect(combineSketchCode("  ", " osc().out() \n")).toBe("osc().out()");
    expect(combineSketchCode(undefined, "osc().out()")).toBe("osc().out()");
    expect(combineSketchCode(null, null)).toBe("");
  });
});

describe("executeSketch", () => {
  test("hushes, exposes hydra functions as globals and runs the sketch", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), { main: "osc(10, 0.1).out()" });

    expect(result).toEqual({ success: true });
    expect(calls).toEqual([["hush"], ["osc", 10, 0.1], ["out"]]);
    expect(typeof globalThis.osc).toBe("function");
    expect(globalThis.h).toBeDefined();
    // Only functions are exposed
    expect(globalThis.notAFunction).toBeUndefined();
  });

  test("runs setup code before the main sketch", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), {
      setup: "const freq = 7;",
      main: "osc(freq).out()",
    });

    expect(result.success).toBe(true);
    expect(calls).toContainEqual(["osc", 7]);
  });

  test("supports top-level await", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), {
      main: "const f = await Promise.resolve(3); osc(f).out()",
    });

    expect(result.success).toBe(true);
    expect(calls).toContainEqual(["osc", 3]);
  });

  test("reports syntax errors instead of throwing", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), { main: "osc((.out()" });

    expect(result.success).toBe(false);
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });

  test("reports runtime errors with the original message", async () => {
    const calls = [];
    const result = await executeSketch(createFakeHydra(calls), {
      main: "definitelyNotAHydraFunction()",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("definitelyNotAHydraFunction");
    expect(calls).toEqual([["hush"]]);
  });

  test("reports a hush failure as an error result", async () => {
    const hydra = {
      hush: () => {
        throw new Error("no outputs yet");
      },
    };
    const result = await executeSketch(hydra, { main: "osc().out()" });

    expect(result.success).toBe(false);
    expect(result.message).toBe("no outputs yet");
  });
});
