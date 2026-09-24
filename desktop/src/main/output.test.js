import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { createOutputManager, friendlyOutputError } from "./output.js";
import { validateSettings } from "./settings.js";

const silentLog = { info() {}, warn() {}, error() {}, child: () => silentLog };

class FakePreview extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
  }
  isDestroyed() {
    return this.destroyed;
  }
  close() {
    this.destroyed = true;
    this.emit("closed");
  }
}

class FakeBridge extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.disposed = false;
    this.resized = [];
    this.previewWindow = options.preview?.enabled ? new FakePreview() : null;
    this.renderWindow = { webContents: new EventEmitter() };
    this.failResize = false;
  }
  dispose() {
    this.disposed = true;
    this.emit("disposed");
  }
  resize(width, height) {
    if (this.failResize) throw new Error("resize failed");
    this.resized.push([width, height]);
  }
  openPreview() {
    if (!this.previewWindow || this.previewWindow.destroyed) this.previewWindow = new FakePreview();
  }
  closePreview() {
    this.previewWindow?.close();
  }
}

function setup({
  available = true,
  url = "http://127.0.0.1:3000",
  settings = {},
  failCreate = null,
} = {}) {
  const bridges = [];
  const statuses = [];
  const blocker = {
    started: 0,
    stopped: 0,
    start: () => ++blocker.started && 1,
    stop: () => blocker.stopped++,
  };
  let current = validateSettings({ output: settings }).output;
  const manager = createOutputManager({
    createBridge: async (options) => {
      if (failCreate) throw failCreate;
      const bridge = new FakeBridge(options);
      bridges.push(bridge);
      return bridge;
    },
    availability: available
      ? { available: true, protocol: "Syphon", reason: null }
      : { available: false, protocol: null, reason: "Needs macOS or Windows" },
    getRendererUrl: () => url,
    getSettings: () => current,
    onStatus: (s) => statuses.push(s),
    log: silentLog,
    powerSaveBlocker: blocker,
    crashRestartLimit: 2,
  });
  const setSettings = (partial) => {
    const previous = validateSettings({ output: current });
    const next = validateSettings({ output: partial }, previous);
    current = next.output;
    const changed = Object.keys(next.output)
      .filter((k) => next.output[k] !== previous.output[k])
      .map((k) => `output.${k}`);
    return { next: next.output, changed };
  };
  return { manager, bridges, statuses, blocker, setSettings };
}

describe("friendlyOutputError", () => {
  test("translates page-load and name-collision errors", () => {
    expect(friendlyOutputError(new Error("ERR_CONNECTION_REFUSED (-102) loading"))).toContain(
      "could not be loaded",
    );
    expect(friendlyOutputError(new Error("Syphon server name already exists"))).toContain(
      "already uses this name",
    );
    expect(friendlyOutputError(new Error("something else"))).toContain("something else");
  });
});

describe("createOutputManager", () => {
  test("starts with the current settings and reports running", async () => {
    const { manager, bridges, blocker } = setup({
      settings: { name: "Main", width: 1280, height: 720 },
    });
    expect(await manager.start()).toBe(true);
    const status = manager.getStatus();
    expect(status.state).toBe("running");
    expect(status.protocol).toBe("Syphon");
    expect(status.name).toBe("Main");
    expect(bridges[0].options.rendererUrl).toBe("http://127.0.0.1:3000/output");
    expect(bridges[0].options.width).toBe(1280);
    expect(bridges[0].options.webPreferences.backgroundThrottling).toBe(false);
    expect(blocker.started).toBe(1);
  });

  test("refuses to start when unavailable or without a server", async () => {
    const unavailable = setup({ available: false });
    expect(await unavailable.manager.start()).toBe(false);
    expect(unavailable.manager.getStatus().error).toBe("Needs macOS or Windows");

    const noServer = setup({ url: null });
    expect(await noServer.manager.start()).toBe(false);
    expect(noServer.manager.getStatus().state).toBe("error");
    expect(noServer.manager.getStatus().error).toContain("server is not running");
  });

  test("reports a bridge creation failure as an error state", async () => {
    const { manager } = setup({ failCreate: new Error("TextureSender: device failure") });
    expect(await manager.start()).toBe(false);
    expect(manager.getStatus().state).toBe("error");
    expect(manager.getStatus().error).toContain("device failure");
  });

  test("tracks fps, dropped frames and non-fatal errors while running", async () => {
    const { manager, bridges } = setup();
    await manager.start();
    bridges[0].emit("fps", 59.94);
    bridges[0].emit("frameDropped", { reason: "send-failed" });
    bridges[0].emit("frameDropped", { reason: "send-failed" });
    bridges[0].emit("error", new Error("transient"));
    await new Promise((resolve) => setTimeout(resolve, 550));
    const status = manager.getStatus();
    expect(status.state).toBe("running");
    expect(status.fps).toBe(59.9);
    expect(status.droppedFrames).toBe(2);
    expect(status.lastDropReason).toBe("send-failed");
    expect(status.error).toBe("transient");
  });

  test("stop disposes the bridge, releases the sleep blocker and toggle flips state", async () => {
    const { manager, bridges, blocker } = setup();
    await manager.start();
    manager.stop();
    expect(bridges[0].disposed).toBe(true);
    expect(blocker.stopped).toBe(1);
    expect(manager.getStatus().state).toBe("stopped");
    expect(manager.getStatus().fps).toBe(null);

    expect(await manager.toggle()).toBe(true);
    expect(manager.getStatus().state).toBe("running");
    expect(await manager.toggle()).toBe(false);
    expect(manager.getStatus().state).toBe("stopped");
  });

  test("a stop during startup wins the race and disposes the late bridge", async () => {
    let resolveCreate;
    const bridges = [];
    const manager = createOutputManager({
      createBridge: () =>
        new Promise((resolve) => {
          resolveCreate = () => {
            const bridge = new FakeBridge({ preview: { enabled: false } });
            bridges.push(bridge);
            resolve(bridge);
          };
        }),
      availability: { available: true, protocol: "Spout", reason: null },
      getRendererUrl: () => "http://127.0.0.1:3000",
      getSettings: () => validateSettings({}).output,
      log: silentLog,
    });
    const started = manager.start();
    expect(manager.getStatus().state).toBe("starting");
    manager.stop();
    resolveCreate();
    expect(await started).toBe(false);
    expect(bridges[0].disposed).toBe(true);
    expect(manager.getStatus().state).toBe("stopped");
  });

  test("resizes in place, restarts for name or frame rate, toggles preview", async () => {
    const { manager, bridges, setSettings } = setup();
    await manager.start();

    let change = setSettings({ width: 3840, height: 2160 });
    await manager.applySettings(change.next, change.changed);
    expect(bridges).toHaveLength(1);
    expect(bridges[0].resized).toEqual([[3840, 2160]]);
    expect(manager.getStatus().width).toBe(3840);

    change = setSettings({ frameRate: 30 });
    await manager.applySettings(change.next, change.changed);
    expect(bridges).toHaveLength(2);
    expect(bridges[0].disposed).toBe(true);
    expect(bridges[1].options.frameRate).toBe(30);
    expect(manager.getStatus().state).toBe("running");

    change = setSettings({ preview: true });
    await manager.applySettings(change.next, change.changed);
    expect(manager.getStatus().previewOpen).toBe(true);
    change = setSettings({ preview: false });
    await manager.applySettings(change.next, change.changed);
    expect(manager.getStatus().previewOpen).toBe(false);
  });

  test("a failed resize falls back to a restart", async () => {
    const { manager, bridges, setSettings } = setup();
    await manager.start();
    bridges[0].failResize = true;
    const change = setSettings({ width: 1000, height: 1000 });
    await manager.applySettings(change.next, change.changed);
    expect(bridges).toHaveLength(2);
    expect(bridges[1].options.width).toBe(1000);
  });

  test("settings changes while stopped only update the displayed values", async () => {
    const { manager, bridges, setSettings } = setup();
    const change = setSettings({ name: "Club" });
    await manager.applySettings(change.next, change.changed);
    expect(bridges).toHaveLength(0);
    expect(manager.getStatus().name).toBe("Club");
    expect(manager.getStatus().state).toBe("stopped");
  });

  test("the user closing the preview window is reported", async () => {
    const closed = [];
    let current = validateSettings({ output: { preview: true } }).output;
    const bridges = [];
    const manager = createOutputManager({
      createBridge: async (options) => {
        const bridge = new FakeBridge(options);
        bridges.push(bridge);
        return bridge;
      },
      availability: { available: true, protocol: "Syphon", reason: null },
      getRendererUrl: () => "http://127.0.0.1:3000",
      getSettings: () => current,
      onPreviewClosed: () => closed.push(true),
      log: silentLog,
    });
    await manager.start();
    expect(manager.getStatus().previewOpen).toBe(true);
    bridges[0].previewWindow.close();
    expect(manager.getStatus().previewOpen).toBe(false);
    expect(closed).toHaveLength(1);
    current = { ...current, preview: false };
  });

  test("restarts after a render process crash and stops after repeated crashes", async () => {
    const { manager, bridges } = setup();
    await manager.start();
    bridges[0].renderWindow.webContents.emit("render-process-gone", {}, { reason: "crashed" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(bridges).toHaveLength(2);
    expect(manager.getStatus().state).toBe("running");

    bridges[1].renderWindow.webContents.emit("render-process-gone", {}, { reason: "crashed" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(bridges).toHaveLength(3);

    bridges[2].renderWindow.webContents.emit("render-process-gone", {}, { reason: "crashed" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(bridges).toHaveLength(3);
    expect(manager.getStatus().state).toBe("error");
    expect(manager.getStatus().error).toContain("repeatedly");
  });

  test("dispose stops everything and blocks further starts", async () => {
    const { manager, bridges } = setup();
    await manager.start();
    manager.dispose();
    expect(bridges[0].disposed).toBe(true);
    expect(await manager.start()).toBe(false);
  });
});
