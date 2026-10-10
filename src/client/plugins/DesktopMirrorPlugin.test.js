import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createEventBus } from "../core/EventBus.js";
import {
  RUN_TIMEOUT_MS,
  SETTLE_FRAMES,
  STALL_MS,
  createDesktopMirrorPlugin,
  createMirrorView,
  createRunIds,
  outputReady,
} from "./DesktopMirrorPlugin.js";

describe("outputReady", () => {
  test("needs the output running, a connection and a primary output with a sketch", () => {
    expect(outputReady({ outputRunning: true, connected: true, primaries: 1 })).toBe(true);
    expect(outputReady({ outputRunning: false, connected: true, primaries: 1 })).toBe(false);
    expect(outputReady({ outputRunning: true, connected: false, primaries: 1 })).toBe(false);
    expect(outputReady({ outputRunning: true, connected: true, primaries: 0 })).toBe(false);
  });
});

describe("createRunIds", () => {
  test("hands out unique ids with a shared prefix", () => {
    const next = createRunIds("ab12");
    expect(next()).toBe("ab12-1");
    expect(next()).toBe("ab12-2");
    const other = createRunIds();
    expect(other()).toMatch(/^[a-z0-9]+-1$/);
  });
});

describe("createMirrorView", () => {
  /** Just enough DOM for the view: a container, canvases, a 2D context that records draws. */
  function fakeDocument() {
    const children = [];
    const container = {
      appendChild: (child) => {
        children.push(child);
        child.remove = () => children.splice(children.indexOf(child), 1);
      },
    };
    const doc = {
      getElementById: (id) => (id === "hydra-canvas" ? container : null),
      createElement: () => {
        const canvas = {
          width: 300,
          height: 150,
          hidden: false,
          style: {},
          contexts: [],
          getContext: () => {
            const context = { draws: [], drawImage: (...args) => context.draws.push(args) };
            canvas.contexts.push(context);
            return context;
          },
        };
        return canvas;
      },
    };
    return { doc, children };
  }

  test("needs the canvas container", () => {
    expect(createMirrorView(null, { getElementById: () => null })).toBe(null);
  });

  test("draws each frame at its own size, replacing the last one", () => {
    const { doc, children } = fakeDocument();
    const local = { hidden: false };
    const view = createMirrorView(local, doc);
    expect(children).toEqual([view.canvas]);
    expect(view.canvas.hidden).toBe(true);
    expect(view.canvas.style.objectFit).toBe("contain");

    const first = frame(1920, 1080);
    view.draw(first);
    view.draw(frame(1920, 1080));
    expect([view.canvas.width, view.canvas.height]).toEqual([1920, 1080]);
    expect(view.canvas.contexts).toHaveLength(1);
    const [context] = view.canvas.contexts;
    expect(context.globalCompositeOperation).toBe("copy");
    expect(context.draws[0]).toEqual([first, 0, 0, 1920, 1080]);

    // A new output size gets a canvas of that size
    view.draw(frame(1280, 720));
    expect([view.canvas.width, view.canvas.height]).toEqual([1280, 720]);
  });

  test("shows either the frames or the main hydra canvas", () => {
    const { doc, children } = fakeDocument();
    const local = { hidden: false };
    const view = createMirrorView(local, doc);
    view.show(true);
    expect([view.canvas.hidden, local.hidden]).toEqual([false, true]);
    view.show(false);
    expect([view.canvas.hidden, local.hidden]).toEqual([true, false]);
    view.show(true);
    view.dispose();
    expect(local.hidden).toBe(false);
    expect(children).toEqual([]);
  });
});

/** Manual timers: `advance(ms)` moves the clock and fires what is due. */
function createTimers() {
  let time = 0;
  let nextId = 1;
  const entries = new Map();
  const add = (fn, ms, repeat) => {
    const id = nextId++;
    entries.set(id, { fn, at: time + ms, ms, repeat });
    return id;
  };
  return {
    now: () => time,
    timers: {
      setTimeout: (fn, ms) => add(fn, ms, false),
      clearTimeout: (id) => entries.delete(id),
      setInterval: (fn, ms) => add(fn, ms, true),
      clearInterval: (id) => entries.delete(id),
    },
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const due = [...entries.entries()]
          .filter(([, entry]) => entry.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, entry] = due;
        time = entry.at;
        if (entry.repeat) entry.at += entry.ms;
        else entries.delete(id);
        entry.fn();
      }
      time = end;
    },
  };
}

function createFakeSocket() {
  const sent = [];
  let open = false;
  let handlers = null;
  const api = {
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
  return {
    factory: (options) => {
      handlers = options;
      return api;
    },
    sent,
    open() {
      open = true;
      handlers.onOpen(api);
    },
    close() {
      open = false;
      handlers.onClose(api);
    },
    receive: (message) => handlers.onMessage(message, api),
  };
}

function createFakeBridge() {
  const listeners = new Set();
  const bridge = {
    state: { output: { state: "stopped" } },
    onFrame: null,
    started: 0,
    stopped: 0,
    mirror: {
      start: async (onFrame) => {
        bridge.onFrame = onFrame;
        bridge.started += 1;
        return true;
      },
      stop: async () => {
        bridge.onFrame = null;
        bridge.stopped += 1;
        return false;
      },
    },
    getState: async () => bridge.state,
    onState: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    setOutput(state) {
      bridge.state = { output: { state } };
      for (const listener of listeners) listener(bridge.state);
    },
  };
  return bridge;
}

function createFakeView() {
  const view = {
    mirrored: false,
    drawn: [],
    failDraw: false,
    disposed: false,
    draw(frame) {
      if (view.failDraw) throw new Error("cannot draw");
      view.drawn.push(frame.displayWidth);
    },
    show(mirrored) {
      view.mirrored = mirrored;
    },
    dispose() {
      view.disposed = true;
    },
  };
  return view;
}

function frame(width = 1920, height = 1080) {
  return {
    displayWidth: width,
    displayHeight: height,
    closed: false,
    close() {
      this.closed = true;
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let consoleSpies = [];
beforeEach(() => {
  consoleSpies = ["info", "warn"].map((level) =>
    spyOn(console, level).mockImplementation(() => {}),
  );
});
afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
});

async function setup({ editorCode = "osc(1).out()" } = {}) {
  const bridge = createFakeBridge();
  const socket = createFakeSocket();
  const view = createFakeView();
  const clock = createTimers();
  const executed = [];
  const loop = {
    running: true,
    start() {
      loop.running = true;
    },
    stop() {
      loop.running = false;
    },
  };
  let runner = null;
  const events = createEventBus();
  const changes = [];
  events.on("mirror:changed", ({ active }) => changes.push(active));
  const ctx = {
    hydra: { id: "main" },
    editor: { _editor: { getAllCode: () => ({ setup: "", main: editorCode }) } },
    events,
    isMobile: false,
    renderLoop: {
      start: loop.start,
      stop: loop.stop,
      isRunning: () => loop.running,
    },
    setSketchRunner: (fn) => {
      runner = fn;
    },
  };
  const plugin = createDesktopMirrorPlugin({
    bridge,
    view,
    url: "ws://test/ws/output",
    socketFactory: socket.factory,
    execute: async (hydra, sketch) => {
      executed.push(sketch.main);
      return sketch.main.includes("boom") ? { success: false, message: "boom" } : { success: true };
    },
    now: clock.now,
    timers: clock.timers,
    runIds: createRunIds("t"),
  }).setup(ctx);
  await flush();
  return {
    plugin,
    bridge,
    socket,
    view,
    clock,
    executed,
    loop,
    events,
    changes,
    runner: () => runner,
    /** The output running, its page connected with a sketch, and `count` frames. */
    async goLive(count = SETTLE_FRAMES) {
      bridge.setOutput("running");
      socket.open();
      socket.receive({ type: "outputs", count: 1, primaries: 1 });
      for (let i = 0; i < count; i++) bridge.onFrame(frame());
      await flush();
    },
  };
}

describe("createDesktopMirrorPlugin", () => {
  test("does nothing outside the desktop app", () => {
    const plugin = createDesktopMirrorPlugin({ bridge: null });
    expect(plugin.setup({ events: createEventBus() })).toBeUndefined();
    const noMirror = createDesktopMirrorPlugin({ bridge: { getState: async () => ({}) } });
    expect(noMirror.setup({ events: createEventBus() })).toBeUndefined();
  });

  test("asks for the output's frames and says hello as a controller", async () => {
    const t = await setup();
    expect(t.bridge.started).toBe(1);
    t.socket.open();
    expect(t.socket.sent[0]).toEqual({ type: "hello", role: "controller" });
    t.plugin.dispose();
  });

  test("switches to the output's frames once it is ready and settled", async () => {
    const t = await setup();
    await t.goLive(SETTLE_FRAMES - 1);
    expect(t.plugin.api.isActive()).toBe(false);
    expect(t.loop.running).toBe(true);

    const last = frame();
    t.bridge.onFrame(last);
    expect(last.closed).toBe(true);
    expect(t.plugin.api.isActive()).toBe(true);
    expect(t.loop.running).toBe(false);
    expect(t.view.mirrored).toBe(true);
    expect(typeof t.runner()).toBe("function");
    // The main instance let go of what it was showing
    expect(t.executed).toEqual([""]);
    expect(t.changes).toEqual([true]);
    expect(t.plugin.api.getStatus()).toMatchObject({
      active: true,
      framesDrawn: SETTLE_FRAMES,
      frameSize: { width: 1920, height: 1080 },
    });
    t.plugin.dispose();
  });

  test("frames before the output is ready are drawn but don't count", async () => {
    const t = await setup();
    t.bridge.setOutput("running");
    t.socket.open();
    for (let i = 0; i < SETTLE_FRAMES + 2; i++) t.bridge.onFrame(frame());
    expect(t.view.drawn).toHaveLength(SETTLE_FRAMES + 2);
    expect(t.plugin.api.isActive()).toBe(false);

    // The output's page has a sketch now: wait for fresh frames
    t.socket.receive({ type: "outputs", count: 1, primaries: 1 });
    t.bridge.onFrame(frame());
    expect(t.plugin.api.isActive()).toBe(false);
    for (let i = 1; i < SETTLE_FRAMES; i++) t.bridge.onFrame(frame());
    expect(t.plugin.api.isActive()).toBe(true);
    t.plugin.dispose();
  });

  test("a frame it can't draw doesn't count", async () => {
    const t = await setup();
    t.view.failDraw = true;
    await t.goLive(SETTLE_FRAMES + 2);
    expect(t.plugin.api.isActive()).toBe(false);
    expect(t.plugin.api.getStatus().framesDrawn).toBe(0);
    t.plugin.dispose();
  });

  test("runs sketches on the output and reports its result", async () => {
    const t = await setup();
    await t.goLive();
    const run = t.runner();

    const pending = run({ setup: "a.setBins(4)", main: "osc(5).out()" });
    expect(t.socket.sent.at(-1)).toEqual({
      type: "run",
      id: "t-1",
      setup: "a.setBins(4)",
      main: "osc(5).out()",
    });
    t.socket.receive({ type: "result", id: "t-1", success: true });
    expect(await pending).toEqual({ success: true, runId: "t-1" });

    const failing = run({ setup: "", main: "osc(" });
    t.socket.receive({ type: "result", id: "t-2", success: false, message: "Unexpected end" });
    expect(await failing).toEqual({ success: false, message: "Unexpected end" });
    // Nothing ran on the main instance
    expect(t.executed).toEqual([""]);
    expect(t.plugin.api.isActive()).toBe(true);
    t.plugin.dispose();
  });

  test("renders here again with the last sketch that worked when the output stops", async () => {
    const t = await setup();
    await t.goLive();
    t.events.emit("sketch:run", { setup: "", main: "noise(9).out()", runId: "t-1" });

    t.bridge.setOutput("stopped");
    expect(t.plugin.api.isActive()).toBe(false);
    expect(t.loop.running).toBe(true);
    expect(t.view.mirrored).toBe(false);
    expect(t.runner()).toBe(null);
    expect(t.executed.at(-1)).toBe("noise(9).out()");
    expect(t.changes).toEqual([true, false]);

    // And back once it runs again
    t.bridge.setOutput("running");
    for (let i = 0; i < SETTLE_FRAMES; i++) t.bridge.onFrame(frame());
    expect(t.plugin.api.isActive()).toBe(true);
    t.plugin.dispose();
  });

  test("uses the editor's code when no sketch ran since the page loaded", async () => {
    const t = await setup({ editorCode: "shape(3).out()" });
    await t.goLive();
    t.socket.receive({ type: "outputs", count: 1, primaries: 0 });
    expect(t.plugin.api.isActive()).toBe(false);
    expect(t.executed.at(-1)).toBe("shape(3).out()");
    t.plugin.dispose();
  });

  test("renders here again when the output's frames stop", async () => {
    const t = await setup();
    await t.goLive();
    t.clock.advance(STALL_MS - 1000);
    expect(t.plugin.api.isActive()).toBe(true);
    t.clock.advance(2000);
    expect(t.plugin.api.isActive()).toBe(false);
    expect(t.loop.running).toBe(true);
    t.plugin.dispose();
  });

  test("runs a sketch here when the output is gone", async () => {
    const t = await setup();
    await t.goLive();
    const pending = t.runner()({ setup: "", main: "osc(2).out()" });
    t.socket.receive({ type: "result", id: "t-1", success: false, reason: "no-output" });
    expect(await pending).toEqual({ success: true });
    expect(t.plugin.api.isActive()).toBe(false);
    expect(t.loop.running).toBe(true);
    // Straight to the new sketch, without bringing back the old one first
    expect(t.executed).toEqual(["", "osc(2).out()"]);
    t.plugin.dispose();
  });

  test("runs waiting sketches here when the connection drops", async () => {
    const t = await setup();
    await t.goLive();
    const pending = t.runner()({ setup: "", main: "osc(4).out()" });
    t.socket.close();
    expect(await pending).toEqual({ success: true });
    expect(t.plugin.api.isActive()).toBe(false);
    expect(t.executed.at(-1)).toBe("osc(4).out()");
    t.plugin.dispose();
  });

  test("a run the output doesn't answer fails without leaving the output", async () => {
    const t = await setup();
    await t.goLive();
    const pending = t.runner()({ setup: "", main: "osc(6).out()" });
    // Frames keep coming while the run hangs
    for (let waited = 0; waited < RUN_TIMEOUT_MS; waited += 1000) {
      t.clock.advance(1000);
      t.bridge.onFrame(frame());
    }
    expect(await pending).toEqual({
      success: false,
      message: "The output didn't answer in time",
    });
    // A late answer is ignored
    t.socket.receive({ type: "result", id: "t-1", success: true });
    expect(t.plugin.api.isActive()).toBe(true);
    t.plugin.dispose();
  });

  test("dispose renders here again and stops receiving frames", async () => {
    const t = await setup();
    await t.goLive();
    t.plugin.dispose();
    await flush();
    expect(t.plugin.api.isActive()).toBe(false);
    expect(t.loop.running).toBe(true);
    expect(t.view.disposed).toBe(true);
    expect(t.bridge.stopped).toBe(1);
  });
});
