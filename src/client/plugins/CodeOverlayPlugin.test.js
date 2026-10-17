import { afterEach, describe, expect, test } from "bun:test";
import { createEventBus } from "../core/EventBus.js";
import { createSafeStorage } from "../core/Storage.js";
import { DEFAULT_CODE_OVERLAY } from "../core/codeOverlay.js";
import { STORAGE_KEY, createCodeOverlayPlugin } from "./CodeOverlayPlugin.js";

function createMemoryBackend() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

function createFakeView() {
  return {
    code: "",
    style: null,
    shown: false,
    disposed: false,
    setCode(code) {
      this.code = code;
    },
    setStyle(style) {
      this.style = { blendMode: style.blendMode, opacity: style.opacity };
    },
    setShown(shown) {
      this.shown = shown;
    },
    isShown() {
      return this.shown;
    },
    dispose() {
      this.disposed = true;
    },
  };
}

function createControl(props) {
  const listeners = {};
  return {
    ...props,
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    removeEventListener: (type) => {
      delete listeners[type];
    },
    fire: (type) => listeners[type]?.(),
  };
}

function createControls() {
  return {
    checkbox: createControl({ checked: false }),
    blendSelect: createControl({ value: "normal" }),
    opacitySlider: createControl({ value: "100" }),
    shownOpacity: null,
    showOpacity(percent) {
      this.shownOpacity = percent;
    },
  };
}

/** A desktop bridge whose settings the main process would validate and push back. */
function createFakeBridge(codeOverlay = { ...DEFAULT_CODE_OVERLAY }) {
  const listeners = new Set();
  const saved = [];
  let settings = { output: {}, codeOverlay };
  const push = () => {
    for (const listener of listeners) listener({ settings });
  };
  return {
    saved,
    push,
    setFromMenu(partial) {
      settings = { ...settings, codeOverlay: { ...settings.codeOverlay, ...partial } };
      push();
    },
    getState: async () => ({ settings }),
    updateSettings: async (partial) => {
      saved.push(partial);
      settings = { ...settings, codeOverlay: { ...settings.codeOverlay, ...partial.codeOverlay } };
      push();
      return settings;
    },
    onState: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function setUp({ bridge = null, uiVisible = true, isMobile = false } = {}) {
  const view = createFakeView();
  const controls = createControls();
  const events = createEventBus();
  const storage = createSafeStorage({ backend: createMemoryBackend() });
  storage.set("hydractrl-ui-visible", uiVisible ? "true" : "false");
  const announced = [];
  events.on("overlay:changed", (settings) => announced.push(settings));
  let step = null;
  const ctx = {
    events,
    storage,
    isMobile,
    editor: { _editor: { getAllCode: () => ({ setup: "", main: "osc(4).out()" }) } },
    getPanels: () => ({ stats: { codeOverlay: controls } }),
    setUiCycleStep: (fn) => {
      step = fn;
    },
  };
  const plugin = createCodeOverlayPlugin({
    bridge,
    document: { getElementById: (id) => (id === "hydra-canvas" ? {} : null) },
    createView: () => view,
  }).setup(ctx);
  return { plugin, view, controls, events, storage, announced, step: () => step };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let current;
afterEach(() => {
  current?.plugin?.dispose?.();
  current = null;
});

describe("createCodeOverlayPlugin", () => {
  test("does nothing on phones, which have their own code overlay", () => {
    current = setUp({ isMobile: true });
    expect(current.plugin).toBeUndefined();
    expect(current.step()).toBe(null);
  });

  test("tells the outputs its settings once they are loaded, even when off", async () => {
    current = setUp();
    await flush();
    expect(current.announced).toEqual([{ ...DEFAULT_CODE_OVERLAY }]);
    expect(current.view.code).toBe("osc(4).out()");
  });

  test("shows the code here only while it is on and the UI is hidden", async () => {
    current = setUp();
    await flush();
    const { plugin, view, events } = current;

    plugin.api.setSettings({ visible: true });
    expect(view.shown).toBe(false);
    events.emit("ui:visibility", { visible: false });
    expect(view.shown).toBe(true);

    // In the desktop app the output's own frames carry it
    events.emit("mirror:changed", { active: true });
    expect(view.shown).toBe(false);
    events.emit("mirror:changed", { active: false });
    expect(view.shown).toBe(true);

    events.emit("sketch:run", { setup: "", main: "noise(2).out()" });
    expect(view.code).toBe("noise(2).out()");
  });

  test("adds a step to Ctrl/⌘+` that switches it", async () => {
    current = setUp({ uiVisible: false });
    await flush();
    const { step, view, announced } = current;

    step()();
    expect(view.shown).toBe(true);
    expect(announced.at(-1).visible).toBe(true);
    step()();
    expect(view.shown).toBe(false);
    expect(announced.at(-1).visible).toBe(false);
  });

  test("keeps its settings in local storage in a browser", async () => {
    current = setUp();
    await flush();
    const { controls, storage, announced, view } = current;

    controls.checkbox.checked = true;
    controls.checkbox.fire("change");
    controls.blendSelect.value = "difference";
    controls.blendSelect.fire("change");
    await flush();
    expect(storage.getJSON(STORAGE_KEY)).toEqual({
      visible: true,
      blendMode: "difference",
      opacity: 1,
    });
    expect(view.style).toEqual({ blendMode: "difference", opacity: 1 });

    // Dragging the opacity reaches the outputs at once, and is kept on release
    controls.opacitySlider.value = "40";
    controls.opacitySlider.fire("input");
    expect(announced.at(-1).opacity).toBe(0.4);
    await flush();
    expect(storage.getJSON(STORAGE_KEY).opacity).toBe(1);
    controls.opacitySlider.fire("change");
    await flush();
    expect(storage.getJSON(STORAGE_KEY).opacity).toBe(0.4);
  });

  test("restores what local storage holds and shows it on the controls", async () => {
    const view = createFakeView();
    const controls = createControls();
    const storage = createSafeStorage({ backend: createMemoryBackend() });
    storage.setJSON(STORAGE_KEY, { visible: true, blendMode: "screen", opacity: 0.25 });
    const plugin = createCodeOverlayPlugin({
      bridge: null,
      document: { getElementById: () => ({}) },
      createView: () => view,
    }).setup({
      events: createEventBus(),
      storage,
      isMobile: false,
      getPanels: () => ({ stats: { codeOverlay: controls } }),
    });
    current = { plugin };
    await flush();
    expect(plugin.api.getSettings()).toEqual({ visible: true, blendMode: "screen", opacity: 0.25 });
    expect(controls.checkbox.checked).toBe(true);
    expect(controls.blendSelect.value).toBe("screen");
    expect(controls.shownOpacity).toBe(25);
  });

  test("in the desktop app, keeps them as a desktop setting the Output menu changes too", async () => {
    const bridge = createFakeBridge({ visible: false, blendMode: "overlay", opacity: 0.5 });
    current = setUp({ bridge });
    await flush();
    const { plugin, controls, storage } = current;
    expect(plugin.api.getSettings().blendMode).toBe("overlay");

    plugin.api.toggle();
    await flush();
    expect(bridge.saved).toEqual([
      { codeOverlay: { visible: true, blendMode: "overlay", opacity: 0.5 } },
    ]);
    expect(storage.getJSON(STORAGE_KEY)).toBe(null);

    bridge.setFromMenu({ visible: false });
    expect(plugin.api.getSettings().visible).toBe(false);
    expect(controls.checkbox.checked).toBe(false);
  });

  test("an opacity being dragged survives the desktop app pushing its state", async () => {
    const bridge = createFakeBridge();
    current = setUp({ bridge });
    await flush();
    const { plugin, controls } = current;

    controls.opacitySlider.value = "30";
    controls.opacitySlider.fire("input");
    // The output's frame rate changed, say: same settings as before
    bridge.push();
    expect(plugin.api.getSettings().opacity).toBe(0.3);
  });

  test("falls back to local storage with a desktop app that predates it", async () => {
    const bridge = createFakeBridge();
    bridge.getState = async () => ({ settings: { output: {} } });
    current = setUp({ bridge });
    await flush();
    current.plugin.api.toggle();
    await flush();
    expect(bridge.saved).toEqual([]);
    expect(current.storage.getJSON(STORAGE_KEY).visible).toBe(true);
  });

  test("dispose removes the view and its Ctrl/⌘+` step", async () => {
    current = setUp();
    await flush();
    const { plugin, view, step } = current;
    plugin.dispose();
    current = null;
    expect(view.disposed).toBe(true);
    expect(step()).toBe(null);
  });
});
