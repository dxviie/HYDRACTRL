import { describe, expect, test } from "bun:test";
import { createEventBus } from "../core/EventBus.js";
import {
  DEFAULT_VALUE,
  MISSING_VALUE,
  audioInputOptions,
  audioInputStatus,
  createAudioInputPlugin,
} from "./AudioInputPlugin.js";

const BUILT_IN = { deviceId: "id-built-in", label: "Built-in Microphone" };
const INTERFACE = { deviceId: "id-interface", label: "USB Interface" };

describe("audioInputOptions", () => {
  test("offers the system default and every input", () => {
    expect(audioInputOptions({ inputs: [BUILT_IN, INTERFACE] })).toEqual({
      options: [
        { value: DEFAULT_VALUE, label: "System default" },
        { value: "id-built-in", label: "Built-in Microphone" },
        { value: "id-interface", label: "USB Interface" },
      ],
      value: DEFAULT_VALUE,
    });
  });

  test("names the system default as the browser does", () => {
    const { options } = audioInputOptions({ inputs: [], defaultLabel: "Default - Built-in" });
    expect(options).toEqual([{ value: DEFAULT_VALUE, label: "Default - Built-in" }]);
  });

  test("numbers the inputs while they have no names", () => {
    const { options } = audioInputOptions({
      inputs: [
        { deviceId: "a", label: "" },
        { deviceId: "b", label: "" },
      ],
    });
    expect(options.slice(1).map((option) => option.label)).toEqual(["Input 1", "Input 2"]);
  });

  test("selects the chosen input, by its label when its id changed", () => {
    const inputs = [BUILT_IN, INTERFACE];
    expect(audioInputOptions({ inputs, choice: INTERFACE }).value).toBe("id-interface");
    const stale = { deviceId: "old-id", label: "USB Interface" };
    expect(audioInputOptions({ inputs, choice: stale }).value).toBe("id-interface");
  });

  test("lists a chosen input that isn't connected, selected", () => {
    const { options, value } = audioInputOptions({ inputs: [BUILT_IN], choice: INTERFACE });
    expect(value).toBe(MISSING_VALUE);
    expect(options.at(-1)).toEqual({
      value: MISSING_VALUE,
      label: "USB Interface (not connected)",
    });
  });
});

describe("audioInputStatus", () => {
  test("says nothing while a.fft listens to the chosen input", () => {
    expect(audioInputStatus({ listening: true, missing: false, error: null })).toBe("");
    expect(audioInputStatus(null)).toBe("");
    // Another input couldn't be opened, but the one in use plays on
    expect(audioInputStatus({ listening: true, missing: false, error: "Busy" })).toBe("");
  });

  test("says when the chosen input isn't connected, or nothing can be heard", () => {
    expect(audioInputStatus({ listening: true, missing: true, error: null })).toContain(
      "Not connected",
    );
    expect(audioInputStatus({ listening: false, missing: false, error: "Permission denied" })).toBe(
      "Can't listen: Permission denied",
    );
  });
});

/** A <select> stand-in: options, a value and listeners. */
function createSelect() {
  const listeners = new Map();
  const select = {
    options: [],
    value: "",
    ownerDocument: { createElement: () => ({ value: "", textContent: "" }) },
    replaceChildren: (...options) => {
      select.options = options;
    },
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
    pick(value) {
      select.value = value;
      listeners.get("change")?.();
    },
    listening: () => listeners.size > 0,
  };
  return select;
}

function createSetup({ inputs = [BUILT_IN, INTERFACE], choice = null } = {}) {
  const select = createSelect();
  const status = { textContent: "", style: { display: "none" } };
  const events = createEventBus();
  const chosen = [];
  const notifications = [];
  let state = { choice, device: choice, missing: false, listening: true, error: null };
  const audioInputs = {
    inputs,
    list: async () => ({ inputs: audioInputs.inputs, defaultLabel: "" }),
    getState: () => state,
    // What choosing leads to, for the next choice only
    outcome: {},
    choose: async (input) => {
      chosen.push(input);
      state = { ...state, choice: input, device: input, missing: false, ...audioInputs.outcome };
      events.emit("audio:input", state);
      return state;
    },
    set: (next) => {
      state = { ...state, ...next };
      events.emit("audio:input", state);
    },
  };
  const ctx = {
    audioInputs,
    events,
    notify: (message, options) => notifications.push({ message, ...options }),
    getPanels: () => ({ stats: { audioInput: { select, status } } }),
  };
  const plugin = createAudioInputPlugin().setup(ctx);
  return { plugin, select, status, audioInputs, chosen, notifications, ctx };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createAudioInputPlugin", () => {
  test("lists the inputs and shows the chosen one", async () => {
    const { select, status } = createSetup({ choice: INTERFACE });
    await settle();
    expect(select.options.map((option) => option.textContent)).toEqual([
      "System default",
      "Built-in Microphone",
      "USB Interface",
    ]);
    expect(select.value).toBe("id-interface");
    expect(status.style.display).toBe("none");
  });

  test("picking an input chooses it; picking the first, the system default", async () => {
    const { select, chosen } = createSetup();
    await settle();
    select.pick("id-interface");
    select.pick(DEFAULT_VALUE);
    await settle();
    expect(chosen).toEqual([INTERFACE, null]);
    expect(select.value).toBe(DEFAULT_VALUE);
  });

  test("follows inputs that connect, and says when the chosen one is gone", async () => {
    const { select, status, audioInputs } = createSetup({ choice: INTERFACE });
    await settle();

    audioInputs.inputs = [BUILT_IN];
    audioInputs.set({ device: null, missing: true });
    await settle();
    expect(select.value).toBe(MISSING_VALUE);
    expect(select.options.at(-1).textContent).toBe("USB Interface (not connected)");
    expect(status.style.display).toBe("block");
    expect(status.textContent).toContain("Not connected");

    // Picking the entry that says so changes nothing
    select.pick(MISSING_VALUE);

    audioInputs.inputs = [BUILT_IN, INTERFACE];
    audioInputs.set({ device: INTERFACE, missing: false });
    await settle();
    expect(select.value).toBe("id-interface");
    expect(status.style.display).toBe("none");
  });

  test("leaves the list alone while it stays the same", async () => {
    const { select, audioInputs } = createSetup();
    await settle();
    const options = select.options;
    audioInputs.set({});
    await settle();
    expect(select.options).toBe(options);
  });

  test("tells when the picked input can't be listened to", async () => {
    const { select, audioInputs, notifications } = createSetup();
    await settle();
    audioInputs.outcome = { listening: false, error: "Permission denied" };
    select.pick("id-interface");
    await settle();
    expect(notifications).toEqual([
      { message: "Audio input: Can't listen: Permission denied", type: "error" },
    ]);
  });

  test("does nothing without the system panel, and lets go when disposed", async () => {
    const events = createEventBus();
    expect(createAudioInputPlugin().setup({ events, getPanels: () => ({}) })).toBeUndefined();

    const { plugin, select } = createSetup();
    await settle();
    plugin.dispose();
    expect(select.listening()).toBe(false);
  });
});
