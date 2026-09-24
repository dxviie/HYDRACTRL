import { describe, expect, test } from "bun:test";
import { IPC, registerIpc } from "./ipc.js";

function fakeIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle: (channel, fn) => handlers.set(channel, fn),
    removeHandler: (channel) => handlers.delete(channel),
  };
}

describe("registerIpc", () => {
  test("registers only the handlers that exist and wraps results", async () => {
    const ipcMain = fakeIpcMain();
    const warnings = [];
    const registration = registerIpc({
      ipcMain,
      isTrustedSender: (sender) => sender.id === 1,
      handlers: {
        getState: () => ({ hello: "world" }),
        toggleOutput: async () => true,
        updateSettings: () => {
          throw new Error("bad value");
        },
      },
      log: { warn: (m) => warnings.push(m), error() {}, info() {} },
    });
    expect(registration.channels).toEqual([IPC.getState, IPC.toggleOutput, IPC.updateSettings]);

    const trusted = { sender: { id: 1 } };
    expect(await ipcMain.handlers.get(IPC.getState)(trusted)).toEqual({
      ok: true,
      value: { hello: "world" },
    });
    expect(await ipcMain.handlers.get(IPC.toggleOutput)(trusted)).toEqual({
      ok: true,
      value: true,
    });
    expect(await ipcMain.handlers.get(IPC.updateSettings)(trusted, {})).toEqual({
      ok: false,
      error: "bad value",
    });

    const untrusted = { sender: { id: 99 } };
    expect(await ipcMain.handlers.get(IPC.getState)(untrusted)).toEqual({
      ok: false,
      error: "untrusted sender",
    });
    expect(warnings).toHaveLength(1);

    registration.dispose();
    expect(ipcMain.handlers.size).toBe(0);
  });
});
