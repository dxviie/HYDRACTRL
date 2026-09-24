// Preload for every HYDRACTRL desktop window. Runs sandboxed with context
// isolation; exposes a small, typed-by-convention API as window.hydractrlDesktop.
// The web interface's DesktopOutputPlugin and the settings/loading pages use it.
const { contextBridge, ipcRenderer } = require("electron");

const STATE_CHANNEL = "desktop:state";
const FOCUS_CHANNEL = "desktop:focus-section";

async function invoke(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (result && result.ok) return result.value;
  throw new Error(result && result.error ? result.error : `${channel} failed`);
}

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("hydractrlDesktop", {
  platform: process.platform,
  getState: () => invoke("desktop:get-state"),
  startOutput: () => invoke("desktop:start-output"),
  stopOutput: () => invoke("desktop:stop-output"),
  toggleOutput: () => invoke("desktop:toggle-output"),
  restartOutput: () => invoke("desktop:restart-output"),
  updateSettings: (partial) => invoke("desktop:update-settings", partial),
  openSettings: (section) => invoke("desktop:open-settings", section),
  openLogs: () => invoke("desktop:open-logs"),
  openExternal: (url) => invoke("desktop:open-external", url),
  retryServer: () => invoke("desktop:retry-server"),
  copyServerUrl: () => invoke("desktop:copy-server-url"),
  openOutputPage: () => invoke("desktop:open-output-page"),
  onState: (callback) => subscribe(STATE_CHANNEL, callback),
  onFocusSection: (callback) => subscribe(FOCUS_CHANNEL, callback),
});
