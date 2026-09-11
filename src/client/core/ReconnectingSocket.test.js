import { describe, expect, test } from "bun:test";
import { createReconnectingSocket, nextReconnectDelay } from "./ReconnectingSocket.js";

/** Minimal WebSocket stand-in: records instances and lets tests drive events. */
class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.closed = false;
    FakeWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(data) {
    this.onmessage?.({ data });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({});
  }
}

function fakeTimers() {
  const pending = [];
  return {
    pending,
    setTimeout: (fn, delay) => {
      const handle = { fn, delay };
      pending.push(handle);
      return handle;
    },
    clearTimeout: (handle) => {
      const index = pending.indexOf(handle);
      if (index >= 0) pending.splice(index, 1);
    },
    fire: () => {
      const next = pending.shift();
      next?.fn();
    },
  };
}

function setup(overrides = {}) {
  FakeWebSocket.instances = [];
  const timers = fakeTimers();
  const events = [];
  const socket = createReconnectingSocket({
    url: "ws://localhost:3000/ws/output",
    onOpen: () => events.push("open"),
    onMessage: (message) => events.push(message),
    onClose: () => events.push("close"),
    WebSocketImpl: FakeWebSocket,
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    ...overrides,
  });
  return { socket, timers, events };
}

describe("nextReconnectDelay", () => {
  test("doubles from the base and caps at the maximum", () => {
    expect(nextReconnectDelay(0)).toBe(1000);
    expect(nextReconnectDelay(1)).toBe(2000);
    expect(nextReconnectDelay(3)).toBe(8000);
    expect(nextReconnectDelay(10)).toBe(30000);
    expect(nextReconnectDelay(200)).toBe(30000);
  });

  test("respects custom base and max", () => {
    expect(nextReconnectDelay(0, { base: 100, max: 250 })).toBe(100);
    expect(nextReconnectDelay(2, { base: 100, max: 250 })).toBe(250);
  });
});

describe("createReconnectingSocket", () => {
  test("connects, reports open, and JSON-encodes sent objects", () => {
    const { socket, events } = setup();
    expect(socket.send({ type: "hello" })).toBe(false);

    socket.connect();
    const ws = FakeWebSocket.instances[0];
    expect(ws.url).toBe("ws://localhost:3000/ws/output");
    expect(socket.isOpen()).toBe(false);

    ws.open();
    expect(socket.isOpen()).toBe(true);
    expect(events).toEqual(["open"]);
    expect(socket.send({ type: "hello", role: "output" })).toBe(true);
    expect(socket.send("raw")).toBe(true);
    expect(ws.sent).toEqual(['{"type":"hello","role":"output"}', "raw"]);
  });

  test("delivers parsed messages and ignores malformed frames", () => {
    const { socket, events } = setup();
    socket.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.receive('{"type":"sketch","setup":"","main":"osc().out()"}');
    ws.receive("garbage");
    ws.receive('{"noType":true}');

    expect(events).toEqual(["open", { type: "sketch", setup: "", main: "osc().out()" }]);
  });

  test("reconnects with growing backoff and resets after a successful open", () => {
    const { socket, timers, events } = setup();
    socket.connect();
    FakeWebSocket.instances[0].drop();

    expect(events).toEqual(["close"]);
    expect(timers.pending.map((t) => t.delay)).toEqual([1000]);
    timers.fire();
    expect(FakeWebSocket.instances).toHaveLength(2);

    FakeWebSocket.instances[1].drop();
    expect(timers.pending.map((t) => t.delay)).toEqual([2000]);
    timers.fire();

    FakeWebSocket.instances[2].open();
    expect(socket.attempt).toBe(0);
    FakeWebSocket.instances[2].drop();
    expect(timers.pending.map((t) => t.delay)).toEqual([1000]);
  });

  test("connect is idempotent while a socket exists", () => {
    const { socket } = setup();
    socket.connect();
    socket.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  test("dispose closes the socket and stops reconnecting", () => {
    const { socket, timers, events } = setup();
    socket.connect();
    const ws = FakeWebSocket.instances[0];
    ws.open();

    socket.dispose();
    expect(ws.closed).toBe(true);
    expect(socket.isOpen()).toBe(false);
    expect(timers.pending).toHaveLength(0);
    // A close after dispose neither reports nor reconnects
    ws.onclose?.({});
    expect(events).toEqual(["open"]);
    socket.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  test("a constructor failure schedules a retry instead of throwing", () => {
    const logs = [];
    const { socket, timers } = setup({
      WebSocketImpl: class {
        constructor() {
          throw new Error("SecurityError");
        }
      },
      log: (line) => logs.push(line),
    });
    socket.connect();
    expect(logs[0]).toContain("SecurityError");
    expect(timers.pending.map((t) => t.delay)).toEqual([1000]);
  });
});
