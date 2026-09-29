#!/usr/bin/env node
/**
 * End-to-end smoke test of the desktop app, driven through the main process's
 * own inspector, so no browser-automation dependency is needed. It launches
 * the app, waits for the server and the interface, exercises the output
 * controls, media files dropped on the editor, the settings window, settings
 * persistence and menu sync, then quits and verifies the server was stopped.
 *
 * Usage:
 *   node scripts/smoke.mjs                     packaged directory build (dist/<platform>-unpacked)
 *   node scripts/smoke.mjs --dev               development mode (electron .)
 *   node scripts/smoke.mjs --executable <app>  a specific executable
 *   --software-gl      use SwiftShader (headless Linux CI without a GPU)
 *   --no-gpu           start without the GPU, for machines where not even
 *                      SwiftShader runs (the Intel macOS runners): check
 *                      everything but the interface's own start, which needs
 *                      WebGL
 *   --optional-output  report a Syphon or Spout output that doesn't start as a
 *                      warning, not a failure (hosted CI runners have no GPU)
 *
 * On Linux without a display, run under `xvfb-run -a`. Exits 1 on any failure.
 */
import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
// A 1×1 PNG, for the media checks
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const results = [];
let failures = 0;
let warnings = 0;
function check(name, ok, detail = "", { optional = false } = {}) {
  const verdict = ok ? "PASS" : optional ? "WARN" : "FAIL";
  results.push(`${verdict} ${name}${detail ? ` (${detail})` : ""}`);
  console.log(results.at(-1));
  if (ok) return;
  if (optional) warnings += 1;
  else failures += 1;
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
  if (typeof WebSocket === "undefined") {
    console.error("smoke: needs Node.js 22 or later (for its built-in WebSocket)");
    process.exit(1);
  }
  const launch = resolveLaunch();
  if (!launch.executable || !existsSync(launch.executable)) {
    console.error(
      `smoke: executable not found (${launch.executable}). Build with "bun run pack" or pass --dev.`,
    );
    process.exit(1);
  }
  const userData = mkdtempSync(join(tmpdir(), "hydractrl-smoke-"));
  // Files to drop, and a second media folder, outside the app's data folder
  const mediaFiles = mkdtempSync(join(tmpdir(), "hydractrl-smoke-files-"));
  const chromiumFlags = ["--no-sandbox", `--user-data-dir=${userData}`, "--inspect=0"];
  const noGpu = flag("--no-gpu");
  if (noGpu) chromiumFlags.push("--disable-gpu");
  else if (flag("--software-gl")) {
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

  const printOutputTail = () => {
    if (output)
      console.log(`--- app output (tail) ---\n${output.split("\n").slice(-30).join("\n")}`);
    const logFile = join(userData, "logs", "hydractrl-desktop.log");
    if (existsSync(logFile)) {
      const log = readFileSync(logFile, "utf8").trim().split("\n").slice(-20).join("\n");
      console.log(`--- app log (tail) ---\n${log}`);
    }
  };
  const deadline = setTimeout(() => {
    check("finished within 4 minutes", false);
    printOutputTail();
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
    rmSync(mediaFiles, { recursive: true, force: true });
    const passed = results.length - failures - warnings;
    const warned = warnings > 0 ? `, ${warnings} optional check(s) failed` : "";
    console.log(`\nsmoke: ${passed}/${results.length} checks passed${warned}`);
    process.exit(failures > 0 ? 1 : 0);
  }

  try {
    for (let i = 0; i < 150 && !wsUrl && !exited; i++) await sleep(200);
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
    // The interface's window is the first one the app opens. On macOS and
    // Windows the output renders in an offscreen window of its own, which
    // can come first in getAllWindows().
    const MAIN_WINDOW =
      "BrowserWindow.getAllWindows().filter((w) => !w.webContents.isOffscreen()).sort((a, b) => a.id - b.id)[0]";
    const SETTINGS_WINDOW =
      'BrowserWindow.getAllWindows().find((w) => w.getTitle() === "Output Settings")';
    const inWindow = (finder, name, code) =>
      inMain(
        `const w = ${finder}; if (!w) throw new Error("no ${name} window"); return w.webContents.executeJavaScript(${JSON.stringify(code)});`,
      );
    const inMainWindow = (code) => inWindow(MAIN_WINDOW, "main", code);
    const inSettings = (code) => inWindow(SETTINGS_WINDOW, "settings", code);
    const getState = () => inMainWindow("window.hydractrlDesktop.getState()");
    /** Drop files at a point of a window, the way the OS does, through the DevTools protocol. */
    const dropFiles = (finder, files, point) =>
      inMain(`
        const w = ${finder};
        const debug = w.webContents.debugger;
        if (!debug.isAttached()) debug.attach("1.3");
        const data = { items: [], files: ${JSON.stringify(files)}, dragOperationsMask: 1 };
        try {
          for (const type of ["dragEnter", "dragOver", "drop"]) {
            await debug.sendCommand("Input.dispatchDragEvent", { type, x: ${point.x}, y: ${point.y}, data });
          }
        } finally {
          debug.detach();
        }
        return true;`);
    /** Status and body of a file the server serves. */
    const fetchMedia = async (path, headers = {}) => {
      const response = await fetch(`${(await getState()).server.url}${path}`, { headers });
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        bytes: Buffer.from(await response.arrayBuffer()),
      };
    };

    // Startup: loading screen, then the interface from the local server. The
    // inspector answers while Node is still starting, before require exists,
    // so the first polls may fail.
    let firstUrl = "";
    for (let i = 0; i < 80 && !firstUrl && !exited; i++) {
      firstUrl = await inMain(
        `const w = ${MAIN_WINDOW}; return w ? w.webContents.getURL() : "";`,
      ).catch(() => "");
      if (!firstUrl) await sleep(250);
    }
    check(
      "first page is the loading screen or the interface",
      /loading\.html|127\.0\.0\.1/.test(String(firstUrl)),
      String(firstUrl),
    );
    // Without a GPU the interface can't start hydra, so only wait for the page
    // and the desktop bridge
    const readyProbe = noGpu
      ? 'typeof window.hydractrlDesktop === "object"'
      : "Boolean(window.hydractrl && window.hydractrl.plugins)";
    let ready = false;
    for (let i = 0; i < 360 && !ready && !exited; i++) {
      ready = await inMain(
        `const w = ${MAIN_WINDOW}; if (!w || !w.webContents.getURL().startsWith("http://127.0.0.1:")) return false; return w.webContents.executeJavaScript(${JSON.stringify(readyProbe)}).catch(() => false);`,
      ).catch(() => false);
      if (!ready) await sleep(250);
    }
    check(
      noGpu
        ? "interface page loaded from the local server"
        : "interface loaded from the local server",
      ready,
      exited ? "the app exited" : "",
    );
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

    if (noGpu) {
      console.log("SKIP interface plugins and the OUTPUT block (they need WebGL)");
    } else {
      const plugins = await inMainWindow("window.hydractrl.plugins.list()");
      check(
        "all interface plugins active",
        plugins.every((p) => p.status === "active") &&
          plugins.some((p) => p.id === "desktop-output"),
        plugins
          .filter((p) => p.status !== "active")
          .map((p) => p.id)
          .join(",") || `${plugins.length} plugins`,
      );
      const block = await inMainWindow(
        '(document.querySelector(".desktop-output") || {}).innerText || ""',
      );
      check("OUTPUT block in the stats panel", /OUTPUT/.test(block), block.replace(/\n/g, " | "));
    }

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
      const optional = flag("--optional-output");
      check(
        "output starts and reports fps",
        started && running.state === "running" && running.fps > 0,
        JSON.stringify({ state: running.state, fps: running.fps, error: running.error }),
        { optional },
      );
      await inMainWindow("window.hydractrlDesktop.stopOutput()");
      await sleep(500);
      const stopped = (await getState()).output;
      check("output stops", stopped.state === "stopped", stopped.state, { optional });
    } else {
      const started = await inMainWindow("window.hydractrlDesktop.startOutput()");
      const after = (await getState()).output;
      check(
        "startOutput refuses gracefully when unavailable",
        started === false && after.state === "error",
        after.error,
      );
    }

    // Media: images and videos dropped on the editor go to the media folder,
    // which the server serves at /media/
    const mediaState = (await getState()).media;
    const mediaDir = join(dirname(dirname(state.app.logPath)), "media");
    check(
      "media folder defaults to the app's data folder",
      mediaState?.folder === mediaDir && mediaState.isDefault && mediaState.available,
      JSON.stringify(mediaState),
    );
    const pixel = join(mediaFiles, "smoke pixel.png");
    writeFileSync(pixel, PIXEL_PNG);
    if (noGpu) {
      // No interface to drop on: put the file in the folder by hand
      console.log("SKIP dropping a file on the editor (the interface needs WebGL)");
      mkdirSync(mediaDir, { recursive: true });
      copyFileSync(pixel, join(mediaDir, "smoke pixel.png"));
    } else {
      // The About panel covers the editor on a first start
      const point = await inMainWindow(`(() => {
        const info = document.getElementById("info-panel");
        if (info) info.style.display = "none";
        const box = document.querySelector("#editor-content .cm-content").getBoundingClientRect();
        const point = { x: Math.round(box.left + 60), y: Math.round(box.top + 8) };
        return { ...point, onEditor: Boolean(document.elementFromPoint(point.x, point.y)?.closest(".cm-editor")) };
      })()`);
      await dropFiles(MAIN_WINDOW, [pixel], point);
      const line = 's0.initImage("/media/smoke pixel.png");';
      let code = "";
      for (let i = 0; i < 40 && !code.includes(line); i++) {
        await sleep(250);
        code = await inMainWindow("window._editorProxy._editor.getCode()");
      }
      check(
        "a file dropped on the editor adds a line that loads it",
        point.onEditor && code.includes(line),
        code.split("\n").slice(0, 2).join(" | "),
      );
      check(
        "the dropped file is copied into the media folder",
        existsSync(join(mediaDir, "smoke pixel.png")) && existsSync(pixel),
      );
      const loaded = await inMainWindow(`new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image.width);
        image.onerror = () => resolve(-1);
        image.src = "/media/smoke pixel.png";
      })`);
      check("the interface loads it the way hydra does", loaded === 1, `width ${loaded}`);
    }
    const served = await fetchMedia("/media/smoke%20pixel.png");
    check(
      "the server serves the media folder at /media/",
      served.status === 200 && served.type === "image/png" && served.bytes.equals(PIXEL_PNG),
      `${served.status} ${served.type}`,
    );
    const ranged = await fetchMedia("/media/smoke%20pixel.png", { Range: "bytes=0-7" });
    check("media answers byte ranges", ranged.status === 206 && ranged.bytes.length === 8);

    const otherFolder = join(mediaFiles, "other media");
    mkdirSync(otherFolder, { recursive: true });
    writeFileSync(join(otherFolder, "other.png"), PIXEL_PNG);
    const pidBeforeSwitch = (await getState()).server.pid;
    await inMainWindow(
      `window.hydractrlDesktop.updateSettings({ media: { folder: ${JSON.stringify(otherFolder)} } }).then(() => true)`,
    );
    let switched = null;
    for (let i = 0; i < 20 && switched?.status !== 200; i++) {
      await sleep(150);
      switched = await fetchMedia("/media/other.png");
    }
    const oldFile = await fetchMedia("/media/smoke%20pixel.png");
    check(
      "the server follows a new media folder without restarting",
      switched?.status === 200 &&
        oldFile.status === 404 &&
        (await getState()).server.pid === pidBeforeSwitch,
      `new ${switched?.status}, old ${oldFile.status}`,
    );
    await inMainWindow(
      'window.hydractrlDesktop.updateSettings({ media: { folder: "" } }).then(() => true)',
    );
    let restored = null;
    for (let i = 0; i < 20 && restored?.status !== 200; i++) {
      await sleep(150);
      restored = await fetchMedia("/media/smoke%20pixel.png");
    }
    check("Use Default goes back to the app's media folder", restored?.status === 200);

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
    const mediaRow = await inSettings(
      'JSON.stringify({ text: document.getElementById("media-folder").textContent, title: document.getElementById("media-folder").title })',
    );
    check(
      "settings window shows the media folder",
      JSON.parse(mediaRow).title === mediaDir && JSON.parse(mediaRow).text.endsWith("media"),
      mediaRow,
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
    printOutputTail();
  }
  await finish();
}

main();
