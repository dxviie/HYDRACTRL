import { describe, expect, test } from "bun:test";
import { REMEMBERED_RUNS, createPrimaryRunner } from "./primaryRunner.js";

/** An execute stand-in: records what ran, fails sketches that contain "boom". */
function createFakeExecute(log, { delays = {} } = {}) {
  return async (_hydra, sketch) => {
    log.push(`start ${sketch.main}`);
    const delay = delays[sketch.main];
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    log.push(`end ${sketch.main}`);
    if (sketch.main.includes("boom")) return { success: false, message: `failed: ${sketch.main}` };
    return { success: true };
  };
}

const syntax = (sketch) => (sketch.main.includes("((") ? "Unexpected token" : null);

describe("createPrimaryRunner", () => {
  test("runs a sketch and reports success", async () => {
    const log = [];
    const runner = createPrimaryRunner({ hydra: {}, execute: createFakeExecute(log) });
    expect(await runner.run("r1", { main: "osc().out()" })).toEqual({ success: true });
    expect(runner.getLastGood()).toEqual({ setup: "", main: "osc().out()" });
    expect(log).toEqual(["start osc().out()", "end osc().out()"]);
  });

  test("turns down a syntax error without touching hydra", async () => {
    const log = [];
    const runner = createPrimaryRunner({
      hydra: {},
      execute: createFakeExecute(log),
      checkSyntax: syntax,
    });
    await runner.run("r1", { main: "osc().out()" });
    log.length = 0;
    expect(await runner.run("r2", { main: "osc((.out()" })).toEqual({
      success: false,
      message: "Unexpected token",
    });
    expect(log).toEqual([]);
    expect(runner.getLastGood().main).toBe("osc().out()");
  });

  test("brings back the last working sketch after a runtime error", async () => {
    const log = [];
    const runner = createPrimaryRunner({
      hydra: {},
      execute: createFakeExecute(log),
      checkSyntax: syntax,
    });
    await runner.run("r1", { setup: "a.setBins(4)", main: "osc().out()" });
    log.length = 0;
    const result = await runner.run("r2", { main: "boom()" });
    expect(result).toEqual({ success: false, message: "failed: boom()" });
    expect(log).toEqual(["start boom()", "end boom()", "start osc().out()", "end osc().out()"]);
    expect(runner.getLastGood()).toEqual({ setup: "a.setBins(4)", main: "osc().out()" });
  });

  test("leaves a failure alone when nothing worked yet", async () => {
    const log = [];
    const runner = createPrimaryRunner({ hydra: {}, execute: createFakeExecute(log) });
    expect((await runner.run("r1", { main: "boom()" })).success).toBe(false);
    expect(log).toEqual(["start boom()", "end boom()"]);
    expect(runner.getLastGood()).toBe(null);
  });

  test("runs one sketch at a time, in order", async () => {
    const log = [];
    const runner = createPrimaryRunner({
      hydra: {},
      execute: createFakeExecute(log, { delays: { slow: 20 } }),
    });
    const first = runner.run("r1", { main: "slow" });
    const second = runner.runSketch({ main: "fast" });
    await Promise.all([first, second]);
    expect(log).toEqual(["start slow", "end slow", "start fast", "end fast"]);
  });

  test("skips the broadcast of a run it already ran, but not others", async () => {
    const log = [];
    const runner = createPrimaryRunner({ hydra: {}, execute: createFakeExecute(log) });
    await runner.run("r1", { main: "osc().out()" });
    expect(await runner.runSketch({ main: "osc().out()" }, { runId: "r1" })).toEqual({
      success: true,
      skipped: true,
    });
    expect(await runner.runSketch({ main: "noise().out()" }, { runId: "other" })).toEqual({
      success: true,
    });
    expect(await runner.runSketch({ main: "shape().out()" })).toEqual({ success: true });
    expect(log.filter((line) => line.startsWith("start"))).toEqual([
      "start osc().out()",
      "start noise().out()",
      "start shape().out()",
    ]);
  });

  test("remembers a bounded number of runs", async () => {
    const log = [];
    const runner = createPrimaryRunner({ hydra: {}, execute: createFakeExecute(log) });
    for (let i = 0; i <= REMEMBERED_RUNS; i++) await runner.run(`r${i}`, { main: `s${i}` });
    log.length = 0;
    await runner.runSketch({ main: "s0" }, { runId: "r0" });
    await runner.runSketch({ main: "s1" }, { runId: "r1" });
    expect(log).toEqual(["start s0", "end s0"]);
  });

  test("keeps going after a sketch throws past executeSketch", async () => {
    const runner = createPrimaryRunner({
      hydra: {},
      execute: async (_hydra, sketch) => {
        if (sketch.main === "explode()") throw new Error("unexpected");
        return { success: true };
      },
    });
    await expect(runner.run("r1", { main: "explode()" })).rejects.toThrow("unexpected");
    expect(await runner.run("r2", { main: "osc().out()" })).toEqual({ success: true });
  });
});
