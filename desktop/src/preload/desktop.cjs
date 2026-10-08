// Preload for every HYDRACTRL desktop window. Runs sandboxed with context
// isolation; exposes a small, typed-by-convention API as window.hydractrlDesktop.
// The web interface's DesktopOutputPlugin, DesktopMirrorPlugin and
// DesktopMediaPlugin and the settings/loading pages use it.
const { contextBridge, ipcRenderer, sharedTexture, webUtils } = require("electron");

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

// The Syphon/Spout output's frames, which the interface draws instead of
// rendering every sketch itself. The main process forwards them as GPU
// textures only while the page has asked for them, and stops whenever the
// page goes away, so a frame never waits for a receiver that isn't there.
let onMirrorFrame = null;
let mirrorReceiverSet = false;

function receiveMirrorFrames() {
  if (mirrorReceiverSet) return;
  mirrorReceiverSet = true;
  sharedTexture.setSharedTextureReceiver(async ({ importedSharedTexture: imported }) => {
    let frame = null;
    try {
      if (onMirrorFrame) {
        frame = imported.getVideoFrame();
        // The page gets its own copy of the frame, and closes it
        await onMirrorFrame(frame);
      }
    } catch (error) {
      console.warn("[desktop] could not show the output's frame:", error);
    } finally {
      frame?.close();
      imported.release();
    }
  });
}

const mirror = sharedTexture
  ? {
      start: (callback) => {
        if (typeof callback !== "function") throw new TypeError("mirror.start needs a callback");
        onMirrorFrame = callback;
        receiveMirrorFrames();
        return invoke("desktop:set-mirror", true);
      },
      stop: () => {
        onMirrorFrame = null;
        return invoke("desktop:set-mirror", false);
      },
    }
  : undefined;

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
  // Takes the File objects of a drop, never paths: the page can't name a
  // file on disk that the user didn't drop on it
  importMedia: (files) =>
    invoke(
      "desktop:import-media",
      Array.from(files || [], (file) => webUtils.getPathForFile(file)),
    ),
  openMediaFolder: () => invoke("desktop:open-media-folder"),
  chooseMediaFolder: () => invoke("desktop:choose-media-folder"),
  // Frames of the running output: start(onFrame) gets each one as a VideoFrame
  mirror,
  onState: (callback) => subscribe(STATE_CHANNEL, callback),
  onFocusSection: (callback) => subscribe(FOCUS_CHANNEL, callback),
});
