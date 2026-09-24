import { afterEach, describe, expect, test } from "bun:test";
import { createEventBus } from "../core/EventBus.js";
import { createOutputSyncPlugin, readXyState, stateChanged } from "./OutputSyncPlugin.js";

describe("stateChanged", () => {
  test("is true without a previous state", () => {
    expect(stateChanged(null, { nanoX: 0.5, nanoY: 0.5 })).toBe(true);
  });

  test("ignores sub-epsilon jitter and reports real moves", () => {
    const previous = { nanoX: 0.5, nanoY: 0.5 };
    expect(stateChanged(previous, { nanoX: 0.50001, nanoY: 0.5 })).toBe(false);
    expect(stateChanged(previous, { nanoX: 0.51, nanoY: 0.5 })).toBe(true);
    expect(stateChanged(previous, { nanoX: 0.5, nanoY: 0.2 })).toBe(true);
  });
});

describe("readXyState", () => {
  test("reads finite numbers only", () => {
    expect(readXyState({ nanoX: 0.1, nanoY: 0.9 })).toEqual({ nanoX: 0.1, nanoY: 0.9 });
    expect(readXyState({})).toBe(null);
    expect(readXyState({ nanoX: "0.1", nanoY: 0.9 })).toBe(null);
    expect(readXyState({ nanoX: Number.NaN, nanoY: 0.9 })).toBe(null);
  });
});

/** A socket stand-in matching the ReconnectingSocket API. */
function createFakeSocket() {
  const sent = [];
  let open = false;
  let handlers = null;
  const factory = (options) => {
    handlers = options;
    return {
      connect: () => {},
      send: (message) => {
        if (!open) return false;
        sent.push(message);
        return true;
      },
      isOpen: () => open,
      dispose: () => {
        open = false;
      },
    };
  };
  return {
    factory,
    sent,
    open: () => {
      open = true;
      handlers.onOpen(handlers && { send: (m) => sent.push(m) });
    },
    receive: (message) => handlers.onMessage(message),
  };
}

function createCtx({ setup = "", main = "osc().out()" } = {}) {
  const notifications = [];
  return {
    ctx: {
      events: createEventBus(),
      notify: (message, opts) => notifications.push({ message, ...opts }),
      editor: { _editor: { getAllCode: () => ({ setup, main }) } },
    },
    notifications,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let plugin;
afterEach(() => {
  plugin?.dispose?.();
  plugin = null;
});

describe("createOutputSyncPlugin", () => {
  test("announces itself, pushes the current sketch on connect, then follows runs", async () => {
    const fake = createFakeSocket();
    const { ctx } = createCtx({ setup: "a.setBins(6)", main: "osc(2).out()" });
    plugin = createOutputSyncPlugin({
      url: "ws://test/ws/output",
      detect: async () => true,
      socketFactory: fake.factory,
    }).setup(ctx);
    await flush();

    fake.open();
    expect(fake.sent[0]).toEqual({ type: "hello", role: "controller" });
    expect(fake.sent[1]).toEqual({ type: "sketch", setup: "a.setBins(6)", main: "osc(2).out()" });

    ctx.events.emit("sketch:run", { setup: "", main: "noise(3).out()" });
    expect(fake.sent.at(-1)).toEqual({ type: "sketch", setup: "", main: "noise(3).out()" });
    expect(plugin.api.isConnected()).toBe(true);
  });

  test("stays idle when there is no output server", async () => {
    const fake = createFakeSocket();
    const { ctx } = createCtx();
    plugin = createOutputSyncPlugin({
      url: "ws://test/ws/output",
      detect: async () => false,
      socketFactory: fake.factory,
    }).setup(ctx);
    await flush();

    ctx.events.emit("sketch:run", { setup: "", main: "osc().out()" });
    expect(fake.sent).toEqual([]);
    expect(plugin.api.isConnected()).toBe(false);
  });

  test("notifies about outputs joining, leaving and failing", async () => {
    const fake = createFakeSocket();
    const { ctx, notifications } = createCtx();
    const counts = [];
    ctx.events.on("output:count", ({ count }) => counts.push(count));
    plugin = createOutputSyncPlugin({
      url: "ws://test/ws/output",
      detect: async () => true,
      socketFactory: fake.factory,
    }).setup(ctx);
    await flush();
    fake.open();

    fake.receive({ type: "outputs", count: 0 });
    fake.receive({ type: "outputs", count: 1 });
    fake.receive({ type: "outputs", count: 1 });
    fake.receive({ type: "output-error", message: "boom", outputId: "o1" });
    fake.receive({ type: "outputs", count: 0 });

    expect(notifications.map((n) => n.message)).toEqual([
      "Output connected (1)",
      "Output error: boom",
      "Output disconnected (0)",
    ]);
    expect(notifications[1].type).toBe("error");
    expect(counts).toEqual([1, 0]);
    expect(plugin.api.outputCount()).toBe(0);
  });

  test("dispose stops following runs", async () => {
    const fake = createFakeSocket();
    const { ctx } = createCtx();
    plugin = createOutputSyncPlugin({
      url: "ws://test/ws/output",
      detect: async () => true,
      socketFactory: fake.factory,
    }).setup(ctx);
    await flush();
    fake.open();
    const sentBefore = fake.sent.length;

    plugin.dispose();
    plugin = null;
    ctx.events.emit("sketch:run", { setup: "", main: "osc().out()" });
    expect(fake.sent).toHaveLength(sentBefore);
  });
});
