/**
 * Window manager: the main window (loading screen, then the HYDRACTRL
 * interface from the local server) and the settings window. Remembers window
 * bounds, recovers from a crashed renderer, and never lets a failed page load
 * end in a blank window.
 */
import { join } from "node:path";
import { MIN_WINDOW_SIZE, sanitizeBounds } from "./windowState.js";

const CRASH_LIMIT = 3;
const CRASH_WINDOW_MS = 60000;

function debounce(fn, wait) {
  let timer = null;
  const debounced = (...args) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  debounced.flush = (...args) => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    fn(...args);
  };
  return debounced;
}

export function createWindowManager({
  BrowserWindow,
  screen,
  appName,
  preloadPath,
  rendererDir,
  iconPath,
  platform,
  windowStateStore,
  log,
  onMainClosed = () => {},
  onLoadFailed = () => {},
}) {
  let mainWindow = null;
  let settingsWindow = null;
  let view = "none";
  let appUrl = null;
  let crashTimes = [];

  const webPreferences = {
    preload: preloadPath,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    backgroundThrottling: false,
    spellcheck: false,
  };

  function isLive(win) {
    return Boolean(win && !win.isDestroyed());
  }

  function saveMainState() {
    if (!isLive(mainWindow)) return;
    const bounds = mainWindow.getNormalBounds();
    windowStateStore.save({ ...bounds, maximized: mainWindow.isMaximized() });
  }

  function showLoading() {
    if (!isLive(mainWindow)) return;
    if (view === "loading") return;
    view = "loading";
    mainWindow.loadFile(join(rendererDir, "loading.html")).catch((error) => {
      log.error(`could not show the loading screen: ${error.message}`);
    });
  }

  function loadApp(url) {
    if (!isLive(mainWindow)) return;
    if (view === "app" && appUrl === url) return;
    view = "app";
    appUrl = url;
    log.info(`loading interface from ${url}`);
    mainWindow.loadURL(url).catch((error) => {
      // did-fail-load handles the user-facing side; this only logs
      log.warn(`loadURL ${url} rejected: ${error.message}`);
    });
  }

  function reloadApp() {
    if (!isLive(mainWindow)) return;
    if (view === "app" && appUrl) {
      mainWindow.loadURL(appUrl).catch(() => {});
    } else if (appUrl) {
      loadApp(appUrl);
    }
  }

  function createMainWindow() {
    const displays = screen.getAllDisplays().map((display) => display.workArea);
    const bounds = sanitizeBounds(windowStateStore.load(), displays);
    mainWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      minWidth: MIN_WINDOW_SIZE.width,
      minHeight: MIN_WINDOW_SIZE.height,
      show: false,
      title: appName,
      backgroundColor: "#1e1e1e",
      icon: platform === "linux" ? iconPath : undefined,
      webPreferences,
    });
    if (bounds.maximized) mainWindow.maximize();

    mainWindow.once("ready-to-show", () => {
      if (isLive(mainWindow)) mainWindow.show();
    });
    // The interface page sets its own <title>; the window keeps the app name
    mainWindow.on("page-title-updated", (event) => event.preventDefault());

    const persist = debounce(saveMainState, 300);
    for (const event of ["resize", "move", "maximize", "unmaximize"]) {
      mainWindow.on(event, persist);
    }
    mainWindow.on("close", () => persist.flush());

    mainWindow.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === -3) return; // -3: aborted by a newer navigation
      log.warn(`interface failed to load (${code} ${description}) from ${url}`);
      view = "none";
      onLoadFailed({ code, description, url });
      showLoading();
    });

    mainWindow.webContents.on("render-process-gone", (_event, details) => {
      log.error(`interface renderer gone: ${details.reason} (exit code ${details.exitCode})`);
      const now = Date.now();
      crashTimes = crashTimes.filter((time) => now - time < CRASH_WINDOW_MS);
      crashTimes.push(now);
      if (crashTimes.length > CRASH_LIMIT) {
        onLoadFailed({ code: 0, description: `renderer crashed repeatedly (${details.reason})` });
        view = "none";
        showLoading();
        return;
      }
      setTimeout(reloadApp, 1000);
    });

    mainWindow.webContents.on("unresponsive", () => log.warn("interface window is unresponsive"));
    mainWindow.webContents.on("responsive", () => log.info("interface window is responsive again"));

    mainWindow.on("closed", () => {
      mainWindow = null;
      if (isLive(settingsWindow)) settingsWindow.close();
      onMainClosed();
    });
    return mainWindow;
  }

  function openSettings(section) {
    if (isLive(settingsWindow)) {
      settingsWindow.focus();
      if (section) settingsWindow.webContents.send("desktop:focus-section", section);
      return settingsWindow;
    }
    settingsWindow = new BrowserWindow({
      width: 540,
      height: 760,
      minWidth: 460,
      minHeight: 520,
      parent: isLive(mainWindow) ? mainWindow : undefined,
      show: false,
      title: "Output Settings",
      backgroundColor: "#1e1e1e",
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      icon: platform === "linux" ? iconPath : undefined,
      webPreferences,
    });
    settingsWindow.once("ready-to-show", () => {
      if (isLive(settingsWindow)) settingsWindow.show();
    });
    settingsWindow.on("page-title-updated", (event) => event.preventDefault());
    settingsWindow
      .loadFile(join(rendererDir, "settings.html"), { hash: section || "" })
      .catch((error) => log.error(`could not open settings: ${error.message}`));
    settingsWindow.on("close", () => log.info("settings window closing"));
    settingsWindow.on("closed", () => {
      log.info("settings window closed");
      settingsWindow = null;
    });
    settingsWindow.webContents.on("render-process-gone", (_event, details) => {
      log.error(`settings renderer gone: ${details.reason} (exit code ${details.exitCode})`);
    });
    return settingsWindow;
  }

  function broadcast(channel, payload) {
    for (const win of [mainWindow, settingsWindow]) {
      if (isLive(win) && !win.webContents.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  }

  function isTrustedSender(contents) {
    return [mainWindow, settingsWindow].some(
      (win) => isLive(win) && win.webContents.id === contents.id,
    );
  }

  function focusMain() {
    if (!isLive(mainWindow)) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }

  function toggleDevTools() {
    if (isLive(mainWindow)) mainWindow.webContents.toggleDevTools();
  }

  return {
    createMainWindow,
    showLoading,
    loadApp,
    reloadApp,
    openSettings,
    broadcast,
    isTrustedSender,
    focusMain,
    toggleDevTools,
    getMainWindow: () => mainWindow,
    getView: () => view,
  };
}
