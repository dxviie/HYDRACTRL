import { describe, expect, test } from "bun:test";
import { createEventBus } from "./EventBus.js";

describe("EventBus", () => {
  test("delivers payloads to subscribers", () => {
    const bus = createEventBus();
    const received = [];
    bus.on("tick", (payload) => received.push(payload));

    bus.emit("tick", 1);
    bus.emit("tick", 2);

    expect(received).toEqual([1, 2]);
  });

  test("emit returns the number of handlers invoked", () => {
    const bus = createEventBus();
    bus.on("tick", () => {});
    bus.on("tick", () => {});

    expect(bus.emit("tick")).toBe(2);
    expect(bus.emit("unknown")).toBe(0);
  });

  test("on returns an unsubscribe function", () => {
    const bus = createEventBus();
    let calls = 0;
    const unsubscribe = bus.on("tick", () => calls++);

    bus.emit("tick");
    unsubscribe();
    bus.emit("tick");

    expect(calls).toBe(1);
    expect(bus.listenerCount("tick")).toBe(0);
  });

  test("once only fires a single time", () => {
    const bus = createEventBus();
    let calls = 0;
    bus.once("tick", () => calls++);

    bus.emit("tick");
    bus.emit("tick");

    expect(calls).toBe(1);
  });

  test("a throwing listener does not break other listeners", () => {
    const bus = createEventBus();
    const received = [];
    bus.on("tick", () => {
      throw new Error("boom");
    });
    bus.on("tick", (payload) => received.push(payload));

    expect(() => bus.emit("tick", "ok")).not.toThrow();
    expect(received).toEqual(["ok"]);
  });

  test("unsubscribing during emit does not skip other handlers", () => {
    const bus = createEventBus();
    const received = [];
    const unsubscribeA = bus.on("tick", () => {
      received.push("a");
      unsubscribeA();
    });
    bus.on("tick", () => received.push("b"));

    bus.emit("tick");

    expect(received).toEqual(["a", "b"]);
  });

  test("off and clear remove listeners", () => {
    const bus = createEventBus();
    const handler = () => {};
    bus.on("tick", handler);
    bus.off("tick", handler);
    expect(bus.listenerCount("tick")).toBe(0);

    bus.on("a", () => {});
    bus.on("b", () => {});
    bus.clear();
    expect(bus.listenerCount("a")).toBe(0);
    expect(bus.listenerCount("b")).toBe(0);
  });

  test("rejects invalid subscriptions", () => {
    const bus = createEventBus();
    expect(() => bus.on(null, () => {})).toThrow(TypeError);
    expect(() => bus.on("tick", null)).toThrow(TypeError);
  });
});
