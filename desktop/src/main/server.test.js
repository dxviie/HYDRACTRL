import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { createServerManager, isConnectionRefused, probeServer } from "./server.js";

const silentLog = { info() {}, warn() {}, error() {}, child: () => silentLog };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A fetch stand-in driven by a mutable map of port -> "hydractrl" | "busy" | "free". */
function fakeFetch(ports) {
  return async (url) => {
    const port = Number(new URL(url).port);
    const kind = ports[port] || "free";
    if (kind === "free") {
      throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    }
    if (kind === "busy") {
      return { ok: true, headers: { get: () => "text/html" }, json: async () => ({}) };
    }
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ name: "hydractrl", outputSync: true }),
    };
  };
}

class FakeChild extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.exitCode = null;
    this.signalCode = null;
    this.killed = [];
  }
  kill(signal) {
    this.killed.push(signal);
    this.exitCode = null;
    this.signalCode = signal;
    setTimeout(() => this.emit("exit", null, signal), 0);
  }
}

function setup({ ports = {}, readyAfterSpawn = true, command } = {}) {
  const spawned = [];
  const states = [];
  let nextPid = 100;
  const manager = createServerManager({
    port: 3000,
    command: command || { file: "hydractrl", args: [], cwd: "/app" },
    spawn: (file, args, options) => {
      const child = new FakeChild(nextPid++);
      spawned.push({ file, args, options, child });
      if (readyAfterSpawn) {
        // The server comes up on the port it was given
        setTimeout(() => {
          ports[Number(options.env.PORT)] = "hydractrl";
        }, 5);
      }
      return child;
    },
    fetch: fakeFetch(ports),
    findFreePort: async (start) => start + 4,
    log: silentLog,
    onState: (state) => states.push(state),
    baseEnv: { PATH: "/bin" },
    readyTimeoutMs: 400,
    pollIntervalMs: 10,
    healthIntervalMs: 20,
    maxRestarts: 2,
    restartWindowMs: 10000,
  });
  return { manager, spawned, states, ports };
}

describe("probeServer", () => {
  test("classifies what is on a port", async () => {
    const fetch = fakeFetch({ 3000: "hydractrl", 3001: "busy" });
    expect(await probeServer(fetch, 3000)).toBe("hydractrl");
    expect(await probeServer(fetch, 3001)).toBe("busy");
    expect(await probeServer(fetch, 3002)).toBe("free");
    expect(
      await probeServer(async () => {
        throw new Error("timeout");
      }, 3000),
    ).toBe("busy");
  });

  test("isConnectionRefused reads the cause code", () => {
    expect(isConnectionRefused({ cause: { code: "ECONNREFUSED" } })).toBe(true);
    expect(isConnectionRefused({ code: "ECONNREFUSED" })).toBe(true);
    expect(isConnectionRefused({ code: "ECONNRESET" })).toBe(false);
    expect(isConnectionRefused(null)).toBe(false);
  });
});

describe("createServerManager", () => {
  test("attaches to a server that is already running", async () => {
    const { manager, spawned } = setup({ ports: { 3000: "hydractrl" } });
    const state = await manager.start();
    expect(state.status).toBe("ready");
    expect(state.mode).toBe("attached");
    expect(state.url).toBe("http://127.0.0.1:3000");
    expect(spawned).toHaveLength(0);
    await manager.stop();
  });

  test("spawns the server with PORT and HOST and waits for readiness", async () => {
    const { manager, spawned, states } = setup();
    const state = await manager.start();
    expect(state.status).toBe("ready");
    expect(state.mode).toBe("spawned");
    expect(state.pid).toBe(100);
    expect(spawned[0].options.env.PORT).toBe("3000");
    expect(spawned[0].options.env.HOST).toBe("127.0.0.1");
    expect(spawned[0].options.env.PATH).toBe("/bin");
    expect(states.map((s) => s.status)).toEqual(["probing", "starting", "starting", "ready"]);
    await manager.stop();
    expect(spawned[0].child.killed).toEqual(["SIGTERM"]);
    expect(manager.getState().status).toBe("stopped");
  });

  test("binds all interfaces when network access is allowed", async () => {
    const spawned = [];
    const ports = {};
    const manager = createServerManager({
      port: 3000,
      allowNetwork: true,
      command: { file: "hydractrl", args: [], cwd: "/app" },
      spawn: (file, args, options) => {
        const child = new FakeChild(1);
        spawned.push(options);
        ports[3000] = "hydractrl";
        return child;
      },
      fetch: fakeFetch(ports),
      findFreePort: async (p) => p,
      log: silentLog,
      baseEnv: {},
      pollIntervalMs: 5,
    });
    await manager.start();
    expect(spawned[0].env.HOST).toBe("0.0.0.0");
    await manager.stop();
  });

  test("moves to a free port when the configured one is taken by something else", async () => {
    const { manager, spawned } = setup({ ports: { 3000: "busy" } });
    const state = await manager.start();
    expect(state.status).toBe("ready");
    expect(state.port).toBe(3005);
    expect(spawned[0].options.env.PORT).toBe("3005");
    await manager.stop();
  });

  test("runs the prepare step before spawning the server", async () => {
    const { manager, spawned } = setup({
      command: {
        prepare: { file: "bun", args: ["run", "build:client"], cwd: "/repo" },
        file: "bun",
        args: ["--watch", "src/index.ts"],
        cwd: "/repo",
      },
    });
    const started = manager.start();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(spawned[0].args).toEqual(["run", "build:client"]);
    spawned[0].child.emit("exit", 0, null);
    const state = await started;
    expect(state.status).toBe("ready");
    expect(spawned[1].args).toEqual(["--watch", "src/index.ts"]);
    await manager.stop();
  });

  test("a failing prepare step fails the start", async () => {
    const { manager, spawned } = setup({
      command: {
        prepare: { file: "bun", args: ["x"], cwd: "/repo" },
        file: "bun",
        args: [],
        cwd: "/repo",
      },
    });
    const started = manager.start();
    await new Promise((resolve) => setTimeout(resolve, 5));
    spawned[0].child.emit("exit", 2, null);
    const state = await started;
    expect(state.status).toBe("failed");
    expect(state.error).toContain("exited with code 2");
  });

  test("reports a server that never becomes ready and kills it", async () => {
    const { manager, spawned } = setup({ readyAfterSpawn: false });
    const state = await manager.start();
    expect(state.status).toBe("failed");
    expect(state.error).toContain("did not become ready");
    expect(spawned[0].child.killed).toContain("SIGTERM");
  });

  test("reports a spawn error such as a missing binary", async () => {
    const states = [];
    const manager = createServerManager({
      port: 3000,
      command: { file: "bun", args: [], cwd: "/repo" },
      spawn: () => {
        const child = new FakeChild(1);
        setTimeout(
          () =>
            child.emit("error", Object.assign(new Error("spawn bun ENOENT"), { code: "ENOENT" })),
          0,
        );
        return child;
      },
      fetch: fakeFetch({}),
      findFreePort: async (p) => p,
      log: silentLog,
      onState: (s) => states.push(s),
      baseEnv: {},
      pollIntervalMs: 5,
      readyTimeoutMs: 200,
    });
    const state = await manager.start();
    expect(state.status).toBe("failed");
    expect(state.error).toContain("ENOENT");
  });

  test("restarts a ready server that dies, then gives up after too many crashes", async () => {
    const { manager, spawned, states, ports } = setup();
    await manager.start();
    expect(manager.getState().status).toBe("ready");

    // First crash: restarted after 1s of (real) backoff, use a short wait via fake exit
    ports[3000] = "free";
    spawned[0].child.emit("exit", 1, null);
    await tick();
    expect(manager.getState().status).toBe("failed");
    expect(manager.getState().error).toContain("restarting");
    expect(manager.getState().restarts).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(spawned).toHaveLength(2);
    expect(manager.getState().status).toBe("ready");

    // Second crash: still within the window, one more restart allowed (2s backoff)
    ports[3000] = "free";
    spawned[1].child.emit("exit", 1, null);
    await tick();
    expect(manager.getState().restarts).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect(spawned).toHaveLength(3);

    // Third crash exceeds maxRestarts: give up
    ports[3000] = "free";
    spawned[2].child.emit("exit", 1, null);
    await tick();
    expect(manager.getState().status).toBe("failed");
    expect(manager.getState().error).toContain("giving up");
    expect(states.filter((s) => s.status === "ready")).toHaveLength(3);

    // Retry clears the history and starts again
    const retried = await manager.retry();
    expect(retried.status).toBe("ready");
    await manager.stop();
  }, 10000);

  test("takes over when an attached server goes away", async () => {
    const { manager, spawned, ports } = setup({ ports: { 3000: "hydractrl" } });
    await manager.start();
    expect(manager.getState().mode).toBe("attached");

    ports[3000] = "free";
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(spawned).toHaveLength(1);
    expect(manager.getState().mode).toBe("spawned");
    expect(manager.getState().status).toBe("ready");
    await manager.stop();
  });

  test("start is idempotent while a start is in flight", async () => {
    const { manager, spawned } = setup();
    const first = manager.start();
    const second = manager.start();
    await Promise.all([first, second]);
    expect(spawned).toHaveLength(1);
    await manager.stop();
  });

  test("relays server output to the log line by line", async () => {
    const lines = [];
    const log = {
      info() {},
      warn() {},
      error() {},
      child: () => ({ info: (l) => lines.push(["info", l]), warn: (l) => lines.push(["warn", l]) }),
    };
    const ports = {};
    let child;
    const manager = createServerManager({
      port: 3000,
      command: { file: "hydractrl", args: [], cwd: "/app" },
      spawn: () => {
        child = new FakeChild(7);
        ports[3000] = "hydractrl";
        return child;
      },
      fetch: fakeFetch(ports),
      findFreePort: async (p) => p,
      log,
      baseEnv: {},
      pollIntervalMs: 5,
    });
    await manager.start();
    child.stdout.emit("data", "hello\nwor");
    child.stdout.emit("data", "ld\n");
    child.stderr.emit("data", "oops\n");
    expect(lines).toEqual([
      ["info", "hello"],
      ["info", "world"],
      ["warn", "oops"],
    ]);
    await manager.stop();
  });
});
