/**
 * Server manager: makes sure a HYDRACTRL server is reachable.
 *
 * It attaches to a server that is already running (a `bun dev` in a terminal,
 * typically) or spawns its own: the bundled binary in a packaged app, the
 * repository's dev command in a checkout. A spawned server that dies after it
 * was ready is restarted with backoff; an attached server is health-checked so
 * the app can take over when it goes away. Startup failures are reported, not
 * retried blindly, so the loading screen can offer a Retry.
 *
 * Everything platform-specific (spawn, fetch, timers, clock) is injected.
 */
import { describeError } from "./log.js";

export const SERVER_STATUS = Object.freeze({
  idle: "idle",
  probing: "probing",
  starting: "starting",
  ready: "ready",
  failed: "failed",
  stopped: "stopped",
});

export function isConnectionRefused(error) {
  const code = error?.cause?.code || error?.code;
  return code === "ECONNREFUSED";
}

/**
 * What is listening on a port: "hydractrl" (a HYDRACTRL server), "busy"
 * (something else, or unknown), or "free" (nothing).
 */
export async function probeServer(fetchImpl, port, timeoutMs = 1500) {
  try {
    const signal =
      typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(timeoutMs)
        : undefined;
    const response = await fetchImpl(`http://127.0.0.1:${port}/api/capabilities`, {
      signal,
      cache: "no-store",
    });
    if (response.ok) {
      const type = response.headers.get("content-type") || "";
      if (type.includes("application/json")) {
        const body = await response.json();
        if (body && body.name === "hydractrl") return "hydractrl";
      }
    }
    return "busy";
  } catch (error) {
    return isConnectionRefused(error) ? "free" : "busy";
  }
}

const defaultTimers = { setTimeout, clearTimeout, setInterval, clearInterval };

export function createServerManager({
  port,
  allowNetwork = false,
  command,
  spawn,
  fetch: fetchImpl,
  findFreePort,
  log,
  onState = () => {},
  baseEnv = process.env,
  timers = defaultTimers,
  now = () => Date.now(),
  readyTimeoutMs = 20000,
  pollIntervalMs = 250,
  healthIntervalMs = 5000,
  maxRestarts = 5,
  restartWindowMs = 60000,
}) {
  const state = {
    status: SERVER_STATUS.idle,
    url: null,
    port: null,
    mode: null,
    pid: null,
    error: null,
    restarts: 0,
    since: null,
  };
  const serverLog = log.child ? log.child("server") : log;
  let child = null;
  let starting = false;
  let stopping = false;
  let healthTimer = null;
  let restartTimer = null;
  let restartTimes = [];

  const sleep = (ms) => new Promise((resolve) => timers.setTimeout(resolve, ms));
  const urlFor = (p) => `http://127.0.0.1:${p}`;

  function getState() {
    return { ...state };
  }

  function set(patch) {
    Object.assign(state, patch);
    onState(getState());
  }

  function fail(error) {
    const message = describeError(error);
    log.error(`server failed: ${message}`);
    set({ status: SERVER_STATUS.failed, error: message, pid: null });
  }

  function clearRestartTimer() {
    if (restartTimer !== null) {
      timers.clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function clearHealthTimer() {
    if (healthTimer !== null) {
      timers.clearInterval(healthTimer);
      healthTimer = null;
    }
  }

  function pipeOutput(stream, level) {
    if (!stream || typeof stream.on !== "function") return;
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += String(chunk);
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trimEnd();
        buffer = buffer.slice(newline + 1);
        if (line) serverLog[level](line);
        newline = buffer.indexOf("\n");
      }
    });
  }

  function waitForExit(proc) {
    return new Promise((resolve) => {
      proc.once("error", (error) => resolve({ error }));
      proc.once("exit", (code, signal) => resolve({ code, signal }));
    });
  }

  async function runPrepare(prepare) {
    log.info(`preparing: ${prepare.file} ${prepare.args.join(" ")}`);
    const proc = spawn(prepare.file, prepare.args, {
      cwd: prepare.cwd,
      env: { ...baseEnv, ...(prepare.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    pipeOutput(proc.stdout, "info");
    pipeOutput(proc.stderr, "warn");
    const result = await waitForExit(proc);
    if (result.error) throw result.error;
    if (result.code !== 0) {
      throw new Error(`${prepare.file} ${prepare.args.join(" ")} exited with code ${result.code}`);
    }
  }

  async function killChild(proc) {
    if (!proc) return;
    const exited = waitForExit(proc);
    try {
      proc.kill("SIGTERM");
    } catch (_error) {
      // already gone
    }
    const result = await Promise.race([exited, sleep(2000).then(() => null)]);
    if (result === null) {
      try {
        proc.kill("SIGKILL");
      } catch (_error) {
        // already gone
      }
    }
  }

  function scheduleRestart(reason) {
    const current = now();
    restartTimes = restartTimes.filter((time) => current - time < restartWindowMs);
    if (restartTimes.length >= maxRestarts) {
      fail(new Error(`${reason}; it keeps crashing, giving up (see the log)`));
      return;
    }
    restartTimes.push(current);
    const delay = Math.min(1000 * 2 ** (restartTimes.length - 1), 8000);
    log.warn(`${reason}; restarting in ${delay}ms`);
    set({
      status: SERVER_STATUS.failed,
      error: `${reason}; restarting…`,
      pid: null,
      restarts: state.restarts + 1,
    });
    restartTimer = timers.setTimeout(() => {
      restartTimer = null;
      start();
    }, delay);
  }

  function onChildExit(proc, result) {
    if (child !== proc) return;
    child = null;
    const wasReady = state.status === SERVER_STATUS.ready;
    if (stopping) {
      set({ status: SERVER_STATUS.stopped, pid: null });
      return;
    }
    // Exits before readiness are reported by start() itself
    if (!wasReady) return;
    const reason = result.error
      ? `server process error: ${describeError(result.error)}`
      : `server exited unexpectedly (code ${result.code}, signal ${result.signal})`;
    scheduleRestart(reason);
  }

  async function waitReady(p, exited) {
    const deadline = now() + readyTimeoutMs;
    let exitResult = null;
    exited.then((result) => {
      exitResult = result;
    });
    while (!stopping) {
      if (exitResult) {
        const detail = exitResult.error
          ? describeError(exitResult.error)
          : `exited with code ${exitResult.code ?? exitResult.signal} before it was ready`;
        throw new Error(`server ${detail}`);
      }
      if ((await probeServer(fetchImpl, p)) === "hydractrl") return true;
      if (now() > deadline) {
        await killChild(child);
        throw new Error(`server did not become ready within ${Math.round(readyTimeoutMs / 1000)}s`);
      }
      await sleep(pollIntervalMs);
    }
    return false;
  }

  async function launch(p) {
    set({ status: SERVER_STATUS.starting, url: urlFor(p), port: p, mode: "spawned", pid: null });
    if (command.prepare) await runPrepare(command.prepare);
    if (stopping) return;

    const env = {
      ...baseEnv,
      ...(command.env || {}),
      PORT: String(p),
      HOST: allowNetwork ? "0.0.0.0" : "127.0.0.1",
    };
    log.info(
      `starting server: ${command.file} ${command.args.join(" ")} on port ${p} (${
        allowNetwork ? "all interfaces" : "this computer only"
      })`,
    );
    const proc = spawn(command.file, command.args, {
      cwd: command.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child = proc;
    set({ pid: proc.pid ?? null });
    pipeOutput(proc.stdout, "info");
    pipeOutput(proc.stderr, "warn");
    const exited = waitForExit(proc);
    exited.then((result) => onChildExit(proc, result));

    const ready = await waitReady(p, exited);
    if (ready) {
      set({ status: SERVER_STATUS.ready, error: null, since: now() });
      log.info(`server ready at ${urlFor(p)}`);
    }
  }

  function attach(p) {
    log.info(`using the HYDRACTRL server already running on port ${p}`);
    set({
      status: SERVER_STATUS.ready,
      url: urlFor(p),
      port: p,
      mode: "attached",
      pid: null,
      error: null,
      since: now(),
    });
    clearHealthTimer();
    healthTimer = timers.setInterval(async () => {
      if (stopping || state.mode !== "attached") return;
      const found = await probeServer(fetchImpl, p);
      if (found === "hydractrl" || stopping || state.mode !== "attached") return;
      clearHealthTimer();
      log.warn("the server we were using went away; starting our own");
      set({ status: SERVER_STATUS.failed, error: "The server went away", mode: null, url: null });
      start();
    }, healthIntervalMs);
  }

  async function start() {
    if (starting) return getState();
    starting = true;
    stopping = false;
    clearRestartTimer();
    try {
      set({ status: SERVER_STATUS.probing, error: null });
      const found = await probeServer(fetchImpl, port);
      if (found === "hydractrl") {
        attach(port);
      } else {
        let chosen = port;
        if (found === "busy") {
          chosen = await findFreePort(port + 1);
          log.warn(`port ${port} is taken by another program; using port ${chosen} instead`);
        }
        await launch(chosen);
      }
    } catch (error) {
      if (!stopping) fail(error);
    } finally {
      starting = false;
    }
    return getState();
  }

  /** Forget crash history and try again (the loading screen's Retry). */
  function retry() {
    restartTimes = [];
    return start();
  }

  async function stop() {
    stopping = true;
    clearRestartTimer();
    clearHealthTimer();
    const proc = child;
    if (proc) await killChild(proc);
    child = null;
    set({ status: SERVER_STATUS.stopped, pid: null, mode: null, url: null });
  }

  return { start, retry, stop, getState };
}
