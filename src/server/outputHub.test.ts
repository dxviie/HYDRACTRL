import { describe, expect, test } from "bun:test";
import {
  MAX_SKETCH_LENGTH,
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
    expect(controller).toEqual([{ type: "outputs", count: 0 }]);

    join(hub, "o1", "output");
    join(hub, "o2", "output");
    expect(controller.at(-1)).toEqual({ type: "outputs", count: 2 });

    hub.disconnect("o1");
    expect(controller.at(-1)).toEqual({ type: "outputs", count: 1 });
    expect(hub.outputCount()).toBe(1);

    // A controller that joins later learns the current count straight away
    const lateController = join(hub, "c2", "controller");
    expect(lateController).toEqual([{ type: "outputs", count: 1 }]);
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
