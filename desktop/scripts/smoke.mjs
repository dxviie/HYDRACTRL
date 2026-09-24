#!/usr/bin/env node
/**
 * End-to-end smoke test of the desktop app, driven through the main process's
 * own inspector, so no browser-automation dependency is needed. It launches
 * the app, waits for the server and the interface, exercises the output
 * controls, the settings window, settings persistence and menu sync, then
 * quits and verifies the server was stopped.
 *
 * Usage:
 *   node scripts/smoke.mjs                     packaged directory build (dist/<platform>-unpacked)
 *   node scripts/smoke.mjs --dev               development mode (electron .)
 *   node scripts/smoke.mjs --executable <app>  a specific executable
 *   --software-gl   use SwiftShader (headless Linux CI without a GPU)
 *
 * On Linux without a display, run under `xvfb-run -a`. Exits 1 on any failure.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
let failures = 0;
function check(name, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  console.log(results.at(-1));
  if (!ok) failures += 1;
}

function findPackagedExecutable() {
  const dist = join(desktopDir, "dist");
  if (!existsSync(dist)) return null;
  const entries = readdirSync(dist);
  if (process.platform === "darwin") {
    const macDir = entries.find((e) => e.startsWith("mac"));
    return macDir ? join(dist, macDir, "HYDRACTRL.app", "Contents", "MacOS", "HYDRACTRL") : null;
  }
  if (process.platform === "win32") {
    return join(dist, "win-unpacked", "HYDRACTRL.exe");
  }
  return join(dist, "linux-unpacked", "hydractrl-desktop");
}

function resolveLaunch() {
  const dev = flag("--dev");
  const custom = option("--executable");
  if (custom) return { executable: resolve(custom), appArgs: [], mode: "custom" };
  if (dev) {
    const electronPath = join(desktopDir, "node_modules", "electron", "path.txt");
    const binary = join(
      desktopDir,
      "node_modules",
      "electron",
      "dist",
      readFileSync(electronPath, "utf8").trim(),
    );
    return { executable: binary, appArgs: ["."], mode: "dev" };
  }
  const packaged = findPackagedExecutable();
  return { executable: packaged, appArgs: [], mode: "packaged" };
}

async function main() {
  const launch = resolveLaunch();
  if (!launch.executable || !existsSync(launch.executable)) {
    console.error(
      `smoke: executable not found (${launch.executable}). Build with "bun run pack" or pass --dev.`,
    );
    process.exit(1);
  }
  const userData = mkdtempSync(join(tmpdir(), "hydractrl-smoke-"));
  const chromiumFlags = ["--no-sandbox", `--user-data-dir=${userData}`, "--inspect=0"];
  if (flag("--software-gl")) {
    chromiumFlags.push(
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    );
  }
  const spawnArgs =
    launch.mode === "dev"
      ? [...chromiumFlags, ...launch.appArgs]
      : [...chromiumFlags, ...launch.appArgs];
  console.log(`smoke: launching ${launch.mode} build: ${launch.executable}`);
  const child = spawn(launch.executable, spawnArgs, {
    cwd: desktopDir,
    env: { ...process.env, XDG_CONFIG_HOME: join(userData, "xdg"), ELECTRON_ENABLE_LOGGING: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let wsUrl = null;
  const onData = (data) => {
    const text = String(data);
    output += text;
    const match = text.match(/ws:\/\/127\.0\.0\.1:\d+\/[0-9a-f-]+/);
    if (match && !wsUrl) wsUrl = match[0];
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  let exited = false;
  const exitPromise = new Promise((resolve) =>
    child.on("exit", (code) => {
      exited = true;
      resolve(code);
    }),
  );

  const deadline = setTimeout(() => {
    check("finished within 4 minutes", false);
    finish();
  }, 240000);

  async function finish() {
    clearTimeout(deadline);
    if (!exited) {
      child.kill();
      await Promise.race([exitPromise, sleep(5000)]);
      if (!exited) child.kill("SIGKILL");
    }
    rmSync(userData, { recursive: true, force: true });
    console.log(`\nsmoke: ${results.length - failures}/${results.length} checks passed`);
    process.exit(failures > 0 ? 1 : 0);
  }

  try {
    for (let i = 0; i < 150 && !wsUrl; i++) await sleep(200);
    check("main process inspector reachable", Boolean(wsUrl));
    if (!wsUrl) throw new Error(`no inspector url in output:\n${output.slice(-800)}`);

    const ws = new WebSocket(wsUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      ws.onopen = resolveOpen;
      ws.onerror = () => rejectOpen(new Error("inspector connection failed"));
    });
    let nextId = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    };
    const send = (method, params) =>
      new Promise((resolveSend, rejectSend) => {
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          rejectSend(new Error(`inspector timeout: ${method}`));
        }, 20000);
        pending.set(id, (message) => {
          clearTimeout(timer);
          resolveSend(message);
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    await send("Runtime.enable");

    /** Run an async snippet in the main process with electron's app, BrowserWindow and Menu in scope. */
    const inMain = async (body) => {
      const expression = `(async () => { const electron = typeof require === "function" ? require("electron") : process.mainModule.require("electron"); const { app, BrowserWindow, Menu } = electron; ${body} })()`;
      const response = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      const details = response.result?.exceptionDetails;
      if (details)
        throw new Error(details.exception?.description || details.text || "evaluate failed");
      return response.result?.result?.value;
    };
    const windowTitles = () =>
      inMain("return BrowserWindow.getAllWindows().map((w) => w.getTitle());");
    const inWindow = (title, code) =>
      inMain(
        `const w = BrowserWindow.getAllWindows().find((w) => w.getTitle() === ${JSON.stringify(title)}); if (!w) throw new Error("no window titled ${title}"); return w.webContents.executeJavaScript(${JSON.stringify(code)});`,
      );
    const inMainWindow = (code) => inWindow("HYDRACTRL", code);
    const inSettings = (code) => inWindow("Output Settings", code);
    const getState = () => inMainWindow("window.hydractrlDesktop.getState()");

    // Startup: loading screen, then the interface from the local server
    let firstUrl = "";
    for (let i = 0; i < 80 && !firstUrl; i++) {
      firstUrl = await inMain(
        'const w = BrowserWindow.getAllWindows()[0]; return w ? w.webContents.getURL() : "";',
      );
      if (!firstUrl) await sleep(250);
    }
    check(
      "first page is the loading screen or the interface",
      /loading\.html|127\.0\.0\.1/.test(String(firstUrl)),
      String(firstUrl),
    );
    let ready = false;
    for (let i = 0; i < 360 && !ready; i++) {
      ready = await inMain(
        'const w = BrowserWindow.getAllWindows()[0]; if (!w || !w.webContents.getURL().startsWith("http://127.0.0.1:")) return false; return w.webContents.executeJavaScript("Boolean(window.hydractrl && window.hydractrl.plugins)").catch(() => false);',
      );
      if (!ready) await sleep(250);
    }
    check("interface loaded from the local server", ready);
    if (!ready) throw new Error("interface did not load");
    await sleep(1000);

    const state = await getState();
    check(
      "server ready",
      state.server.status === "ready" && Boolean(state.server.url),
      JSON.stringify(state.server),
    );
    check(
      "app mode reported",
      state.app.packaged === (launch.mode === "packaged"),
      `packaged=${state.app.packaged}`,
    );
    const expectAvailable = process.platform === "darwin" || process.platform === "win32";
    check(
      "output availability matches the platform",
      state.output.available === expectAvailable,
      state.output.available ? state.output.protocol : state.output.unavailableReason,
    );
    check(
      "settings are the defaults",
      state.settings.output.name === "HYDRACTRL" && state.settings.output.width === 1920,
    );

    const plugins = await inMainWindow("window.hydractrl.plugins.list()");
    check(
      "all interface plugins active",
      plugins.every((p) => p.status === "active") && plugins.some((p) => p.id === "desktop-output"),
      plugins
        .filter((p) => p.status !== "active")
        .map((p) => p.id)
        .join(",") || `${plugins.length} plugins`,
    );
    const block = await inMainWindow(
      '(document.querySelector(".desktop-output") || {}).innerText || ""',
    );
    check("OUTPUT block in the stats panel", /OUTPUT/.test(block), block.replace(/\n/g, " | "));

    const outputMenu = await inMain(
      'const menu = Menu.getApplicationMenu().items.find((i) => i.label === "Output"); return menu ? menu.submenu.items.map((i) => ({ label: i.label, enabled: i.enabled })) : null;',
    );
    check(
      "Output menu present",
      Array.isArray(outputMenu) && outputMenu.some((i) => i.label === "Resolution"),
    );
    check(
      "Output toggle enabled state matches availability",
      outputMenu?.[0]?.enabled === expectAvailable,
      JSON.stringify(outputMenu?.[0]),
    );

    if (expectAvailable) {
      const started = await inMainWindow("window.hydractrlDesktop.startOutput()");
      let running = null;
      for (let i = 0; i < 40; i++) {
        running = (await getState()).output;
        if (running.state === "running" && running.fps !== null) break;
        await sleep(250);
      }
      check(
        "output starts and reports fps",
        started && running.state === "running" && running.fps > 0,
        JSON.stringify({ state: running.state, fps: running.fps, error: running.error }),
      );
      await inMainWindow("window.hydractrlDesktop.stopOutput()");
      await sleep(500);
      check("output stops", (await getState()).output.state === "stopped");
    } else {
      const started = await inMainWindow("window.hydractrlDesktop.startOutput()");
      const after = (await getState()).output;
      check(
        "startOutput refuses gracefully when unavailable",
        started === false && after.state === "error",
        after.error,
      );
    }

    // Settings window
    await inMainWindow('window.hydractrlDesktop.openSettings("resolution")');
    let serverText = "";
    for (let i = 0; i < 60 && !String(serverText).startsWith("http"); i++) {
      await sleep(250);
      serverText = await inSettings('document.getElementById("server-url").textContent').catch(
        () => "",
      );
    }
    check(
      "settings window opened and shows the server address",
      String(serverText).startsWith("http://127.0.0.1:"),
      String(serverText),
    );
    await inSettings('document.querySelector("label:has(#allowNetwork) .track").click(); true');
    await sleep(400);
    check(
      "switch toggles a server setting",
      await inSettings('document.getElementById("allowNetwork").checked'),
    );
    await inSettings(
      'window.hydractrlDesktop.updateSettings({ output: { name: "SmokeTest", width: 3840, height: 2160, frameRate: 30 } }).then(() => true)',
    );
    await sleep(600);
    const stateAfter = await getState();
    const settingsFile = join(dirname(dirname(stateAfter.app.logPath)), "settings.json");
    const saved = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, "utf8")) : null;
    check(
      "settings persisted to disk",
      saved?.output?.name === "SmokeTest" &&
        saved?.output?.width === 3840 &&
        saved?.server?.allowNetwork === true,
      settingsFile,
    );
    const rendered = await inSettings(
      'JSON.stringify({ name: document.getElementById("name").value, preset: document.getElementById("preset").value, rate: document.getElementById("frameRate").value })',
    );
    check(
      "settings window re-rendered from state",
      rendered === '{"name":"SmokeTest","preset":"3840x2160","rate":"30"}',
      rendered,
    );
    const checked = await inMain(
      'const menu = Menu.getApplicationMenu().items.find((i) => i.label === "Output"); const res = menu.submenu.items.find((i) => i.label === "Resolution").submenu.items.find((i) => i.checked); const rate = menu.submenu.items.find((i) => i.label === "Frame Rate").submenu.items.find((i) => i.checked); return { res: res && res.label, rate: rate && rate.label };',
    );
    check(
      "menu checkmarks follow settings",
      /4K/.test(String(checked.res)) && checked.rate === "30 fps",
      JSON.stringify(checked),
    );
    const clamped = await inMainWindow(
      'window.hydractrlDesktop.updateSettings({ output: { width: -5, name: "" } })',
    );
    check(
      "invalid settings are clamped",
      clamped.output.width === 16 && clamped.output.name === "SmokeTest",
      JSON.stringify(clamped.output),
    );
    await sleep(2000);
    check(
      "settings window still open after updates",
      (await windowTitles()).includes("Output Settings"),
    );
    await inSettings(
      'document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); true',
    );
    await sleep(800);
    check("Escape closes the settings window", !(await windowTitles()).includes("Output Settings"));

    // Quit and verify cleanup
    const serverPid = stateAfter.server.pid;
    const logPath = stateAfter.app.logPath;
    // Detach the inspector before quitting: an attached debugger session keeps
    // the process alive after Electron's quit sequence has run.
    await inMain("setTimeout(() => app.quit(), 800); return true;");
    ws.close();
    const code = await Promise.race([exitPromise, sleep(20000).then(() => "timeout")]);
    check("app quits cleanly", code === 0, `exit ${code}`);
    await sleep(1000);
    if (serverPid) {
      let alive = true;
      try {
        process.kill(serverPid, 0);
      } catch {
        alive = false;
      }
      check("server process stopped on quit", !alive, `pid ${serverPid}`);
    }
    let portFree = false;
    try {
      await fetch(`${stateAfter.server.url}/api/capabilities`);
    } catch {
      portFree = true;
    }
    check(
      "server port released on quit",
      portFree || stateAfter.server.mode === "attached",
      stateAfter.server.url,
    );
    const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
    check(
      "log records startup and shutdown",
      /starting \(/.test(log) && /shutting down/.test(log),
      logPath,
    );
    ws.close();
  } catch (error) {
    check("smoke test completed", false, String(error.message || error).slice(0, 300));
    if (output)
      console.log(`--- app output (tail) ---\n${output.split("\n").slice(-15).join("\n")}`);
  }
  await finish();
}

main();
