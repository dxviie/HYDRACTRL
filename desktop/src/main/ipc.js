/**
 * IPC surface between the windows and the main process. Every handler checks
 * that the caller is one of our windows, catches everything, and answers
 * with a plain result object so a renderer never sees a rejected promise.
 */
import { describeError } from "./log.js";

export const IPC = Object.freeze({
  getState: "desktop:get-state",
  startOutput: "desktop:start-output",
  stopOutput: "desktop:stop-output",
  toggleOutput: "desktop:toggle-output",
  restartOutput: "desktop:restart-output",
  updateSettings: "desktop:update-settings",
  openSettings: "desktop:open-settings",
  openLogs: "desktop:open-logs",
  openExternal: "desktop:open-external",
  retryServer: "desktop:retry-server",
  copyServerUrl: "desktop:copy-server-url",
  openOutputPage: "desktop:open-output-page",
  /** Push channel: the full app state, on every change. */
  state: "desktop:state",
  /** Push channel: ask the settings window to focus a section. */
  focusSection: "desktop:focus-section",
});

export function registerIpc({ ipcMain, isTrustedSender, handlers, log }) {
  const registered = [];
  for (const [name, channel] of Object.entries(IPC)) {
    const handler = handlers[name];
    if (typeof handler !== "function") continue;
    const wrapped = async (event, ...args) => {
      if (!isTrustedSender(event.sender)) {
        log.warn(`ignored ${channel} from an untrusted window`);
        return { ok: false, error: "untrusted sender" };
      }
      try {
        const value = await handler(...args);
        return { ok: true, value };
      } catch (error) {
        log.error(`${channel} failed: ${describeError(error)}`);
        return { ok: false, error: error?.message || String(error) };
      }
    };
    ipcMain.handle(channel, wrapped);
    registered.push(channel);
  }
  return {
    channels: registered,
    dispose() {
      for (const channel of registered) ipcMain.removeHandler(channel);
    },
  };
}
