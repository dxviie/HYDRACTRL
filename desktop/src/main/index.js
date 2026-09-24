/**
 * HYDRACTRL desktop: entry point of the Electron main process.
 *
 * Wires the pieces together: a logger, persisted settings, the window
 * manager, the server manager (attach or spawn the HYDRACTRL server), the
 * output manager (Syphon/Spout texture sharing), the menu and the IPC surface
 * for the windows. All state changes fan out through `broadcast()`.
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import net from "node:net";
import {
  BrowserWindow,
  Menu,
  app,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain,
  powerSaveBlocker,
  screen,
  session,
  shell,
} from "electron";

import {
  APP_ID,
  APP_NAME,
  ICON_PATH,
  PRELOAD_PATH,
  RENDERER_DIR,
  resolvePaths,
  serverCommand,
} from "./config.js";
import { IPC, registerIpc } from "./ipc.js";
import { createLogger, describeError } from "./log.js";
import { buildMenuTemplate } from "./menu.js";
import { createOutputManager } from "./output.js";
import { createSecurityPolicy, isAllowedExternalUrl } from "./security.js";
import { createServerManager } from "./server.js";
import { FRAME_RATES, RESOLUTION_PRESETS, createSettingsStore } from "./settings.js";
import { createWindowStateStore } from "./windowState.js";
import { createWindowManager } from "./windows.js";

app.setName(APP_NAME);
if (process.platform === "win32") app.setAppUserModelId(APP_ID);

// One running copy: a second launch focuses the existing window instead
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  main();
}

function main() {
  // hydra's microphone analysis must start without a click, and the render
  // loops must never be throttled while a window is hidden or unfocused.
  app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");

  const packaged = app.isPackaged;
  const paths = resolvePaths({
    packaged,
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath("userData"),
    platform: process.platform,
  });
  const log = createLogger({ filePath: paths.logFile, fs, mirror: packaged ? null : console });
  log.info(
    `${APP_NAME} desktop ${app.getVersion()} starting (${packaged ? "packaged" : "dev"}, ` +
      `electron ${process.versions.electron}, ${process.platform} ${process.arch})`,
  );

  process.on("uncaughtException", (error) => log.error(`uncaught: ${describeError(error)}`));
  process.on("unhandledRejection", (reason) =>
    log.error(`unhandled rejection: ${describeError(reason)}`),
  );

  const settingsStore = createSettingsStore({ filePath: paths.settingsFile, fs, log });
  settingsStore.load();
  const windowStateStore = createWindowStateStore({ filePath: paths.windowStateFile, fs, log });

  let serverManager = null;
  let outputManager = null;
  let windows = null;
  let lastMenuSignature = null;
  let quitting = false;
  let shutdownDone = false;
  let autoStartArmed = true;
  let lastLoadFailure = null;

  const security = createSecurityPolicy({
    getServerUrl: () => serverManager?.getState().url ?? null,
    shell,
    desktopCapturer,
    log,
  });

  function getAppState() {
    return {
      app: {
        name: APP_NAME,
        version: app.getVersion(),
        platform: process.platform,
        packaged,
        logPath: paths.logFile,
        loadFailure: lastLoadFailure,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
      },
      server: serverManager ? serverManager.getState() : { status: "idle", url: null },
      output: outputManager
        ? outputManager.getStatus()
        : { available: false, protocol: null, state: "stopped", unavailableReason: "loading" },
      settings: settingsStore.get(),
      presets: RESOLUTION_PRESETS,
      frameRates: FRAME_RATES,
    };
  }

  function refreshMenu() {
    const state = getAppState();
    const signature = JSON.stringify([
      state.output.state,
      state.output.available,
      state.server.url,
      state.settings,
    ]);
    if (signature === lastMenuSignature) return;
    lastMenuSignature = signature;
    const template = buildMenuTemplate({
      platform: process.platform,
      appName: APP_NAME,
      state,
      actions: menuActions,
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  function broadcast() {
    if (windows) windows.broadcast(IPC.state, getAppState());
    refreshMenu();
  }

  async function updateSettings(partial) {
    const { settings, changed } = settingsStore.update(partial);
    if (changed.length > 0) {
      log.info(`settings changed: ${changed.join(", ")}`);
      if (outputManager) await outputManager.applySettings(settings.output, changed);
    }
    broadcast();
    return settings;
  }

  function openExternal(url) {
    if (!isAllowedExternalUrl(url)) {
      log.warn(`refused to open ${url}`);
      return false;
    }
    security.openExternally(url);
    return true;
  }

  function openLogs() {
    try {
      fs.mkdirSync(paths.logsDir, { recursive: true });
      if (fs.existsSync(paths.logFile)) shell.showItemInFolder(paths.logFile);
      else shell.openPath(paths.logsDir);
    } catch (error) {
      log.warn(`could not open logs: ${describeError(error)}`);
    }
  }

  function openOutputPage() {
    const url = serverManager?.getState().url;
    if (!url) return false;
    shell.openExternal(`${url}/output`).catch((error) => log.warn(describeError(error)));
    return true;
  }

  function copyServerUrl() {
    const url = serverManager?.getState().url;
    if (url) clipboard.writeText(url);
    return url ?? null;
  }

  function showAbout() {
    const state = getAppState();
    dialog.showMessageBox({
      type: "info",
      title: `About ${APP_NAME}`,
      message: `${APP_NAME} ${state.app.version}`,
      detail:
        "Live visual performance tool built on hydra by Olivia Jack.\n" +
        `Electron ${state.app.electron} · Chromium ${state.app.chrome}\n` +
        `Server: ${state.server.url || "not running"}\n\n` +
        "Licensed under the GNU AGPL v3. Made with ♥ by D17E.",
    });
  }

  const menuActions = {
    toggleOutput: () => outputManager?.toggle(),
    restartOutput: () => outputManager?.restart(),
    setResolution: (width, height) => updateSettings({ output: { width, height } }),
    setFrameRate: (frameRate) => updateSettings({ output: { frameRate } }),
    setPreview: (preview) => updateSettings({ output: { preview } }),
    setIncludeAlpha: (includeAlpha) => updateSettings({ output: { includeAlpha } }),
    setAutoStart: (autoStart) => updateSettings({ output: { autoStart } }),
    openSettings: (section) => windows?.openSettings(section),
    openOutputPage,
    copyServerUrl,
    reloadUi: () => windows?.reloadApp(),
    toggleDevTools: () => windows?.toggleDevTools(),
    openExternal,
    openLogs,
    showAbout,
  };

  async function loadOutputAvailability() {
    const protocol =
      process.platform === "darwin" ? "Syphon" : process.platform === "win32" ? "Spout" : null;
    if (!protocol) {
      return {
        available: false,
        protocol: null,
        reason:
          "Texture sharing needs macOS (Syphon) or Windows (Spout). " +
          "The interface works here, but there is no shared output.",
        createBridge: null,
      };
    }
    try {
      const module = await import("@napolab/texture-bridge-renderer");
      return { available: true, protocol, reason: null, createBridge: module.createTextureBridge };
    } catch (error) {
      log.error(`texture-sharing module failed to load: ${describeError(error)}`);
      return {
        available: false,
        protocol,
        reason: `The ${protocol} module could not be loaded: ${error.message}`,
        createBridge: null,
      };
    }
  }

  function findFreePort(start) {
    const tryPort = (port) =>
      new Promise((resolve) => {
        const probe = net.createServer();
        probe.unref();
        probe.once("error", () => resolve(false));
        probe.listen({ port, host: "127.0.0.1" }, () => probe.close(() => resolve(true)));
      });
    return (async () => {
      for (let port = start; port < start + 50; port++) {
        if (await tryPort(port)) return port;
      }
      throw new Error(`no free port found between ${start} and ${start + 49}`);
    })();
  }

  function handleServerState(state) {
    if (!windows) return;
    if (state.status === "ready") {
      lastLoadFailure = null;
      windows.loadApp(state.url);
      if (autoStartArmed && settingsStore.get().output.autoStart && outputManager) {
        const current = outputManager.getStatus().state;
        if (current !== "running" && current !== "starting") {
          autoStartArmed = false;
          outputManager.start().then((ok) => {
            // Leave it armed if the server was the problem, so the next
            // ready transition tries again
            if (!ok && outputManager.getStatus().error?.includes("could not be loaded")) {
              autoStartArmed = true;
            }
          });
        }
      }
    } else if (state.status !== "stopped") {
      windows.showLoading();
    }
    broadcast();
  }

  async function shutdown() {
    if (shutdownDone) return;
    shutdownDone = true;
    log.info("shutting down");
    try {
      outputManager?.dispose();
    } catch (error) {
      log.warn(`output dispose failed: ${describeError(error)}`);
    }
    try {
      await serverManager?.stop();
    } catch (error) {
      log.warn(`server stop failed: ${describeError(error)}`);
    }
  }

  app.on("second-instance", () => windows?.focusMain());
  app.on("activate", () => windows?.focusMain());
  app.on("child-process-gone", (_event, details) => {
    log.warn(`child process gone: ${details.type} ${details.reason} (${details.exitCode})`);
  });
  app.on("web-contents-created", (_event, contents) => security.attachToContents(contents));
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("will-quit", (event) => {
    if (shutdownDone) return;
    event.preventDefault();
    shutdown().finally(() => app.quit());
  });
  app.on("window-all-closed", () => app.quit());

  app.whenReady().then(async () => {
    try {
      security.installOnSession(session.defaultSession);
      if (process.platform === "darwin") {
        app.setAboutPanelOptions({
          applicationName: APP_NAME,
          applicationVersion: app.getVersion(),
          version: `Electron ${process.versions.electron}`,
          copyright: "Built on hydra by Olivia Jack · AGPL v3 · D17E",
          website: "https://dxviie.github.io/HYDRACTRL/",
        });
      }

      windows = createWindowManager({
        BrowserWindow,
        screen,
        appName: APP_NAME,
        preloadPath: PRELOAD_PATH,
        rendererDir: RENDERER_DIR,
        iconPath: ICON_PATH,
        platform: process.platform,
        windowStateStore,
        log,
        onMainClosed: () => {
          if (!quitting) app.quit();
        },
        onLoadFailed: (failure) => {
          lastLoadFailure = failure;
          broadcast();
        },
      });
      windows.createMainWindow();
      windows.showLoading();
      refreshMenu();

      registerIpc({
        ipcMain,
        isTrustedSender: (sender) => windows.isTrustedSender(sender),
        log,
        handlers: {
          getState: () => getAppState(),
          startOutput: () => outputManager?.start() ?? false,
          stopOutput: () => outputManager?.stop(),
          toggleOutput: () => outputManager?.toggle() ?? false,
          restartOutput: () => outputManager?.restart() ?? false,
          updateSettings: (partial) => updateSettings(partial),
          openSettings: (section) => {
            windows.openSettings(typeof section === "string" ? section : undefined);
          },
          openLogs,
          openExternal: (url) => openExternal(String(url)),
          retryServer: () => serverManager?.retry(),
          copyServerUrl,
          openOutputPage,
        },
      });

      const availability = await loadOutputAvailability();
      outputManager = createOutputManager({
        createBridge: availability.createBridge,
        availability,
        getRendererUrl: () => {
          const state = serverManager?.getState();
          return state?.status === "ready" ? state.url : null;
        },
        getSettings: () => settingsStore.get().output,
        onStatus: () => broadcast(),
        onPreviewClosed: () => {
          settingsStore.update({ output: { preview: false } });
          broadcast();
        },
        log,
        powerSaveBlocker,
      });
      if (!availability.available) log.warn(`output unavailable: ${availability.reason}`);

      const settings = settingsStore.get();
      serverManager = createServerManager({
        port: settings.server.port,
        allowNetwork: settings.server.allowNetwork,
        command: serverCommand({ packaged, paths }),
        spawn,
        fetch: globalThis.fetch,
        findFreePort,
        log,
        onState: handleServerState,
      });
      broadcast();
      serverManager.start();
    } catch (error) {
      log.error(`startup failed: ${describeError(error)}`);
      dialog.showErrorBox(
        `${APP_NAME} could not start`,
        `${error.message}\n\nDetails are in the log:\n${paths.logFile}`,
      );
      app.quit();
    }
  });
}
