import { describe, expect, test } from "bun:test";
import {
  MAX_ERROR_LENGTH,
  MAX_PENDING_RUNS,
  MAX_RUN_ID_LENGTH,
  MAX_SKETCH_LENGTH,
  NO_OUTPUT_MESSAGE,
  type OutgoingMessage,
  createOutputHub,
  parseIncomingMessage,
} from "./outputHub";

/** Registers a client and returns the messages it received, parsed. */
function join(hub: ReturnType<typeof createOutputHub>, id: string, role?: "controller" | "output") {
  const received: OutgoingMessage[] = [];
  hub.connect(id, (text) => received.push(JSON.parse(text)));
  if (role) hub.message(id, { type: "hello", role });
  return received;
}

/** Registers the desktop app's own output, which runs the interface's sketches itself. */
function joinPrimary(hub: ReturnType<typeof createOutputHub>, id: string) {
  const received: OutgoingMessage[] = [];
  hub.connect(id, (text) => received.push(JSON.parse(text)));
  hub.message(id, { type: "hello", role: "output", primary: true });
  return received;
}

const RUN = { type: "run", id: "run-1", setup: "", main: "osc(3).out()" } as const;

const SKETCH = { type: "sketch", setup: "a.setBins(6)", main: "osc(10).out()" } as const;

describe("parseIncomingMessage", () => {
  test("accepts JSON strings and pre-parsed objects", () => {
    expect(parseIncomingMessage(JSON.stringify(SKETCH))).toEqual(SKETCH);
    expect(parseIncomingMessage(SKETCH)).toEqual(SKETCH);
  });

  test("defaults a missing setup to an empty string", () => {
    expect(parseIncomingMessage({ type: "sketch", main: "osc().out()" })).toEqual({
      type: "sketch",
      setup: "",
      main: "osc().out()",
    });
  });

  test("rejects garbage, unknown types and malformed payloads", () => {
    expect(parseIncomingMessage("not json")).toBe(null);
    expect(parseIncomingMessage(42)).toBe(null);
    expect(parseIncomingMessage(null)).toBe(null);
    expect(parseIncomingMessage({ type: "reboot" })).toBe(null);
    expect(parseIncomingMessage({ type: "hello", role: "admin" })).toBe(null);
    expect(parseIncomingMessage({ type: "sketch", main: 12 })).toBe(null);
    expect(parseIncomingMessage({ type: "state" })).toBe(null);
    expect(parseIncomingMessage({ type: "state", nanoX: Number.NaN })).toBe(null);
    expect(parseIncomingMessage({ type: "state", nanoX: "0.5" })).toBe(null);
    expect(parseIncomingMessage({ type: "error", message: 1 })).toBe(null);
  });

  test("keeps only the numeric axes of a state message", () => {
    expect(parseIncomingMessage({ type: "state", nanoX: 0.25, nanoY: "x", extra: 1 })).toEqual({
      type: "state",
      nanoX: 0.25,
    });
  });

  test("rejects oversized sketches", () => {
    const main = "x".repeat(MAX_SKETCH_LENGTH + 1);
    expect(parseIncomingMessage({ type: "sketch", main })).toBe(null);
    expect(parseIncomingMessage({ type: "run", id: "r", main })).toBe(null);
  });

  test("keeps primary only for outputs", () => {
    expect(parseIncomingMessage({ type: "hello", role: "output", primary: true })).toEqual({
      type: "hello",
      role: "output",
      primary: true,
    });
    expect(parseIncomingMessage({ type: "hello", role: "output", primary: "yes" })).toEqual({
      type: "hello",
      role: "output",
    });
    expect(parseIncomingMessage({ type: "hello", role: "controller", primary: true })).toEqual({
      type: "hello",
      role: "controller",
    });
  });

  test("carries a sketch's run id when it is a sane string", () => {
    expect(parseIncomingMessage({ ...SKETCH, runId: "run-1" })).toEqual({
      ...SKETCH,
      runId: "run-1",
    });
    expect(parseIncomingMessage({ ...SKETCH, runId: 7 })).toEqual(SKETCH);
    expect(parseIncomingMessage({ ...SKETCH, runId: "x".repeat(MAX_RUN_ID_LENGTH + 1) })).toEqual(
      SKETCH,
    );
  });

  test("parses runs and results", () => {
    expect(parseIncomingMessage({ type: "run", id: "r1", main: "osc().out()" })).toEqual({
      type: "run",
      id: "r1",
      setup: "",
      main: "osc().out()",
    });
    expect(parseIncomingMessage({ type: "run", main: "osc().out()" })).toBe(null);
    expect(parseIncomingMessage({ type: "run", id: "", main: "osc().out()" })).toBe(null);
    expect(parseIncomingMessage({ type: "result", id: "r1", success: true })).toEqual({
      type: "result",
      id: "r1",
      success: true,
    });
    expect(
      parseIncomingMessage({ type: "result", id: "r1", success: false, message: "x".repeat(5000) }),
    ).toEqual({ type: "result", id: "r1", success: false, message: "x".repeat(MAX_ERROR_LENGTH) });
    expect(parseIncomingMessage({ type: "result", id: "r1", success: "yes" })).toBe(null);
    expect(parseIncomingMessage({ type: "result", success: true })).toBe(null);
  });
});

describe("createOutputHub", () => {
  test("fans a sketch out to outputs only", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    const otherController = join(hub, "c2", "controller");
    const output = join(hub, "o1", "output");

    expect(hub.message("c1", SKETCH)).toBe(true);

    expect(output).toContainEqual(SKETCH);
    expect(controller.filter((m) => m.type === "sketch")).toHaveLength(0);
    expect(otherController.filter((m) => m.type === "sketch")).toHaveLength(0);
  });

  test("ignores sketches and state from clients that are not controllers", () => {
    const hub = createOutputHub();
    join(hub, "anon");
    join(hub, "o1", "output");
    const output = join(hub, "o2", "output");

    expect(hub.message("anon", SKETCH)).toBe(false);
    expect(hub.message("o1", SKETCH)).toBe(false);
    expect(hub.message("o1", { type: "state", nanoX: 0.1 })).toBe(false);
    expect(output.filter((m) => m.type === "sketch")).toHaveLength(0);
    expect(hub.getLastSketch()).toBe(null);
  });

  test("replays the last sketch and merged state to an output that connects late", () => {
    const hub = createOutputHub();
    join(hub, "c1", "controller");
    hub.message("c1", SKETCH);
    hub.message("c1", { type: "state", nanoX: 0.2 });
    hub.message("c1", { type: "state", nanoY: 0.9 });

    const late = join(hub, "o-late", "output");

    expect(late[0]).toEqual(SKETCH);
    expect(late[1]).toEqual({ type: "state", nanoX: 0.2, nanoY: 0.9 });
  });

  test("tells controllers how many outputs are connected", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    expect(controller).toEqual([{ type: "outputs", count: 0, primaries: 0 }]);

    join(hub, "o1", "output");
    join(hub, "o2", "output");
    expect(controller.at(-1)).toEqual({ type: "outputs", count: 2, primaries: 0 });

    hub.disconnect("o1");
    expect(controller.at(-1)).toEqual({ type: "outputs", count: 1, primaries: 0 });
    expect(hub.outputCount()).toBe(1);

    // A controller that joins later learns the current count straight away
    const lateController = join(hub, "c2", "controller");
    expect(lateController).toEqual([{ type: "outputs", count: 1, primaries: 0 }]);
  });

  test("relays output errors to controllers with the output id", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    join(hub, "o1", "output");

    expect(hub.message("o1", { type: "error", message: "osc is not defined" })).toBe(true);
    expect(controller.at(-1)).toEqual({
      type: "output-error",
      message: "osc is not defined",
      outputId: "o1",
    });
    // Controllers cannot spoof output errors
    expect(hub.message("c1", { type: "error", message: "nope" })).toBe(false);
  });

  test("a failing send does not break delivery to other clients", () => {
    const log: string[] = [];
    const hub = createOutputHub({ log: (m) => log.push(m) });
    join(hub, "c1", "controller");
    hub.connect("broken", () => {
      throw new Error("socket closed");
    });
    hub.message("broken", { type: "hello", role: "output" });
    const healthy = join(hub, "o2", "output");

    expect(hub.message("c1", SKETCH)).toBe(true);
    expect(healthy).toContainEqual(SKETCH);
    expect(log.some((line) => line.includes("broken"))).toBe(true);
  });

  test("messages from unknown or disconnected clients are ignored", () => {
    const hub = createOutputHub();
    expect(hub.message("ghost", SKETCH)).toBe(false);
    join(hub, "c1", "controller");
    hub.disconnect("c1");
    expect(hub.message("c1", SKETCH)).toBe(false);
    expect(hub.controllerCount()).toBe(0);
  });
});

describe("primary outputs", () => {
  test("count once they have a sketch to show", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    const primary = joinPrimary(hub, "p1");
    expect(hub.primaryCount()).toBe(1);
    expect(controller.at(-1)).toEqual({ type: "outputs", count: 1, primaries: 0 });

    hub.message("c1", SKETCH);
    expect(primary).toContainEqual(SKETCH);
    expect(controller.at(-1)).toEqual({ type: "outputs", count: 1, primaries: 1 });
  });

  test("get the last sketch on connect and count straight away", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    hub.message("c1", { ...SKETCH, runId: "run-0" });
    const primary = joinPrimary(hub, "p1");
    expect(primary[0]).toEqual({ ...SKETCH, runId: "run-0" });
    expect(controller.at(-1)).toEqual({ type: "outputs", count: 1, primaries: 1 });
  });

  test("a run goes to the primary outputs only, its result to the controller that asked", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    const otherController = join(hub, "c2", "controller");
    const output = join(hub, "o1", "output");
    const primary = joinPrimary(hub, "p1");

    expect(hub.message("c1", RUN)).toBe(true);
    expect(primary).toContainEqual(RUN);
    expect(output.filter((m) => m.type === "run")).toHaveLength(0);
    expect(hub.getLastSketch()).toBe(null);
    expect(hub.pendingRunCount()).toBe(1);

    expect(hub.message("p1", { type: "result", id: "run-1", success: true })).toBe(true);
    // The primary output now has a sketch to show
    expect(controller.slice(-2)).toEqual([
      { type: "outputs", count: 2, primaries: 1 },
      { type: "result", id: "run-1", success: true },
    ]);
    expect(otherController.filter((m) => m.type === "result")).toHaveLength(0);
    expect(hub.pendingRunCount()).toBe(0);

    // Answered once: a second result for the same run is dropped
    expect(hub.message("p1", { type: "result", id: "run-1", success: true })).toBe(false);
  });

  test("the sketch that follows a run reaches every output with the run id", () => {
    const hub = createOutputHub();
    join(hub, "c1", "controller");
    const output = join(hub, "o1", "output");
    const primary = joinPrimary(hub, "p1");
    hub.message("c1", { ...SKETCH, runId: "run-1" });
    expect(output).toContainEqual({ ...SKETCH, runId: "run-1" });
    expect(primary).toContainEqual({ ...SKETCH, runId: "run-1" });
    expect(hub.getLastSketch()).toEqual({ ...SKETCH, runId: "run-1" });
  });

  test("a failed run is relayed with its message", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    joinPrimary(hub, "p1");
    hub.message("c1", RUN);
    hub.message("p1", { type: "result", id: "run-1", success: false, message: "osc is not here" });
    expect(controller.at(-1)).toEqual({
      type: "result",
      id: "run-1",
      success: false,
      message: "osc is not here",
    });
    expect(controller.filter((m) => m.type === "outputs").at(-1)).toEqual({
      type: "outputs",
      count: 1,
      primaries: 0,
    });
  });

  test("a run without a primary output is answered at once", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    const output = join(hub, "o1", "output");
    expect(hub.message("c1", RUN)).toBe(true);
    expect(controller.at(-1)).toEqual({
      type: "result",
      id: "run-1",
      success: false,
      message: NO_OUTPUT_MESSAGE,
      reason: "no-output",
    });
    expect(output.filter((m) => m.type === "run")).toHaveLength(0);
    expect(hub.pendingRunCount()).toBe(0);
  });

  test("waiting runs are answered when the last primary output goes away", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    joinPrimary(hub, "p1");
    joinPrimary(hub, "p2");
    hub.message("c1", RUN);
    hub.disconnect("p1");
    expect(controller.filter((m) => m.type === "result")).toHaveLength(0);
    hub.disconnect("p2");
    expect(controller).toContainEqual({
      type: "result",
      id: "run-1",
      success: false,
      message: NO_OUTPUT_MESSAGE,
      reason: "no-output",
    });
    expect(hub.pendingRunCount()).toBe(0);
  });

  test("forgets the runs of a controller that leaves", () => {
    const hub = createOutputHub();
    join(hub, "c1", "controller");
    joinPrimary(hub, "p1");
    hub.message("c1", RUN);
    hub.disconnect("c1");
    expect(hub.pendingRunCount()).toBe(0);
    expect(hub.message("p1", { type: "result", id: "run-1", success: true })).toBe(false);
  });

  test("keeps the waiting runs bounded", () => {
    const hub = createOutputHub();
    join(hub, "c1", "controller");
    joinPrimary(hub, "p1");
    for (let i = 0; i < MAX_PENDING_RUNS + 5; i++) hub.message("c1", { ...RUN, id: `r${i}` });
    expect(hub.pendingRunCount()).toBe(MAX_PENDING_RUNS);
    // The oldest were forgotten
    expect(hub.message("p1", { type: "result", id: "r0", success: true })).toBe(false);
  });

  test("only controllers run and only primary outputs answer", () => {
    const hub = createOutputHub();
    const controller = join(hub, "c1", "controller");
    join(hub, "o1", "output");
    const primary = joinPrimary(hub, "p1");
    expect(hub.message("o1", RUN)).toBe(false);
    expect(hub.message("p1", RUN)).toBe(false);
    expect(primary.filter((m) => m.type === "run")).toHaveLength(0);

    hub.message("c1", RUN);
    expect(hub.message("o1", { type: "result", id: "run-1", success: true })).toBe(false);
    expect(hub.message("c1", { type: "result", id: "run-1", success: true })).toBe(false);
    expect(controller.filter((m) => m.type === "result")).toHaveLength(0);
  });
});
