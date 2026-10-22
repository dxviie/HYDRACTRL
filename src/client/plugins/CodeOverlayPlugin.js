/**
 * CodeOverlayPlugin - the editor's code over the visuals, as you type.
 *
 * One switch, with a blend mode and an opacity of its own (see
 * core/codeOverlay.js). While it is on, every output draws the editor's code
 * as it is being typed: the /output pages, so the desktop app's Syphon/Spout
 * output too (the output sync plugin sends them what to draw), and the
 * breakout window. A tag says whether that code runs or was edited since,
 * marks show the lines that differ from what runs, the cursor shows where
 * you type, the code flashes when the editor does (a run from the Run button
 * or Ctrl/⌘+Enter), and a corner shows the scenes and slots. The interface
 * draws it while its UI is hidden; in the desktop app it shows the output's
 * own frames then, which carry it already.
 *
 * The editor is read a few times a second at most (EDITOR_UPDATE_MS), and
 * only while the overlay is on, so typing never costs the visuals a frame.
 *
 * With the UI hidden, Ctrl/⌘+` switches it (the first press hides the UI,
 * the second shows or hides the code, the third brings the UI back). The
 * system panel's CODE OVERLAY section has the switches, the blend mode and
 * the opacity. In the desktop app the settings are a desktop setting, which
 * the Output menu's "Show Code on Output" switches too; elsewhere they are
 * kept in local storage. Phones have a code overlay of their own
 * (MobileUiPlugin).
 */
import {
  DEFAULT_CODE_OVERLAY,
  createCodeOverlayView,
  normalizeCodeOverlay,
  sameCodeOverlay,
} from "../core/codeOverlay.js";
import {
  buildEditorSnapshot,
  normalizeSlotsState,
  sameEditorSnapshot,
} from "../core/editorSnapshot.js";
import { createThrottle } from "../core/throttle.js";

/** At most this often (ms) the overlay follows the editor: about 15 times a second. */
export const EDITOR_UPDATE_MS = 66;

export const STORAGE_KEY = "hydractrl-code-overlay";

/** Settings kept in local storage, in a browser. */
export function createStorageOverlayStore(storage) {
  return {
    load: async () => storage.getJSON(STORAGE_KEY, null),
    save: (settings) => storage.setJSON(STORAGE_KEY, settings),
    subscribe: () => () => {},
  };
}

/** Settings kept by the desktop app, whose Output menu changes them too. */
export function createDesktopOverlayStore(bridge) {
  return {
    // null when the app predates the code overlay
    load: async () => (await bridge.getState())?.settings?.codeOverlay ?? null,
    save: (settings) => bridge.updateSettings({ codeOverlay: settings }),
    subscribe: (callback) =>
      bridge.onState((state) => {
        const value = state?.settings?.codeOverlay;
        if (value) callback(value);
      }),
  };
}

/** The desktop app's store when it keeps the setting, local storage otherwise. */
async function pickStore(bridge, storage) {
  if (typeof bridge?.getState === "function" && typeof bridge.updateSettings === "function") {
    try {
      const store = createDesktopOverlayStore(bridge);
      const value = await store.load();
      if (value) return { store, value };
    } catch (error) {
      console.warn("[code-overlay] could not read the desktop settings:", error);
    }
  }
  const store = createStorageOverlayStore(storage);
  return { store, value: await store.load() };
}

/** The editor's code by tab, whatever the editor proxy offers. */
function editorSketch(editor) {
  const tabs = editor?._editor;
  if (tabs && typeof tabs.getAllCode === "function") {
    const { setup, main } = tabs.getAllCode();
    return { setup: setup || "", main: main || "" };
  }
  const main = editor?.state?.doc?.toString?.();
  return { setup: "", main: typeof main === "string" ? main : "" };
}

export function createCodeOverlayPlugin(options = {}) {
  return {
    id: "code-overlay",
    name: "Code Overlay",
    description: "Shows the editor's code over the visuals as you type, on every output too",

    setup(ctx) {
      if (ctx.isMobile) return;
      const doc = options.document !== undefined ? options.document : globalThis.document;
      const bridge =
        options.bridge !== undefined
          ? options.bridge
          : typeof window !== "undefined"
            ? window.hydractrlDesktop
            : undefined;
      const createView = options.createView || createCodeOverlayView;
      const container = doc?.getElementById("hydra-canvas");
      const view = container ? createView(container) : null;
      if (!view) return;
      const controls = ctx.getPanels?.().stats?.codeOverlay;
      const tabs = ctx.editor?._editor;

      let settings = { ...DEFAULT_CODE_OVERLAY };
      // What the store holds as far as we know: its pushes that match it are
      // echoes, or other settings changing (the desktop app pushes them all)
      let stored = null;
      let store = null;
      let unsubscribe = () => {};
      // What runs now (null: nothing ran yet). A context that can't say
      // takes what the editor holds to be running.
      let running =
        typeof ctx.getRunningSketch === "function"
          ? ctx.getRunningSketch()
          : editorSketch(ctx.editor);
      let snapshot = null;
      let slots = null;
      let uiHidden = ctx.storage?.get("hydractrl-ui-visible") === "false";
      let mirrored = false;
      let breakoutView = null;
      let disposed = false;

      const views = () => (breakoutView ? [view, breakoutView] : [view]);

      /** Read the editor and pass on what changed, while anyone looks. */
      function publishEditor() {
        if (!settings.visible) return;
        const next = buildEditorSnapshot({
          tab: tabs?.getCurrentTab?.() === "setup" ? "setup" : "main",
          sketch: editorSketch(ctx.editor),
          selection: tabs?.getSelection?.() ?? { anchor: -1, head: -1 },
          running,
        });
        if (sameEditorSnapshot(next, snapshot)) return;
        snapshot = next;
        for (const target of views()) target.setEditor(snapshot);
        ctx.events.emit("overlay:editor", snapshot);
      }
      const editorUpdates = createThrottle(publishEditor, EDITOR_UPDATE_MS, options.timers);
      const offEditor = tabs?.onUpdate?.(() => editorUpdates.schedule()) ?? (() => {});

      function setSlots(state) {
        slots = normalizeSlotsState(state);
        for (const target of views()) target.setSlots(slots);
        ctx.events.emit("overlay:slots", slots);
      }

      function render() {
        for (const target of views()) target.setStyle(settings);
        view.setSlotsShown(settings.slots);
        view.setShown(settings.visible && uiHidden && !mirrored);
        if (breakoutView) {
          breakoutView.setSlotsShown(settings.slots);
          breakoutView.setShown(settings.visible);
        }
        if (controls) {
          controls.checkbox.checked = settings.visible;
          if (controls.slotsCheckbox) controls.slotsCheckbox.checked = settings.slots;
          controls.blendSelect.value = settings.blendMode;
          controls.showOpacity(Math.round(settings.opacity * 100));
        }
      }

      function apply(next, { announce = false } = {}) {
        const changed = !sameCodeOverlay(next, settings);
        const turnedOn = next.visible && !settings.visible;
        settings = next;
        if (changed) render();
        if (changed || announce) ctx.events.emit("overlay:changed", { ...settings });
        // The editor isn't followed while it is off: catch up
        if (turnedOn) editorUpdates.flush();
      }

      /**
       * Change the settings here and on every output, and keep them unless
       * `persist` is false (while the opacity slider is being dragged).
       */
      function update(partial, { persist = true } = {}) {
        apply(normalizeCodeOverlay({ ...settings, ...partial }, settings));
        if (!persist || !store || sameCodeOverlay(settings, stored)) return;
        stored = { ...settings };
        Promise.resolve()
          .then(() => store.save(stored))
          .catch((error) => console.warn("[code-overlay] could not save:", error));
      }

      /** Settings from the store: its first read, or the desktop app's menu. */
      function fromStore(value, { announce = false } = {}) {
        const next = normalizeCodeOverlay(value);
        if (!announce && sameCodeOverlay(next, stored)) return;
        stored = next;
        apply({ ...next }, { announce });
      }

      pickStore(bridge, ctx.storage)
        .then((picked) => {
          if (disposed) return;
          store = picked.store;
          // Announced even when off, so an output that remembers it on hears otherwise
          fromStore(picked.value, { announce: true });
          unsubscribe = store.subscribe((value) => fromStore(value));
        })
        .catch((error) => console.warn("[code-overlay] could not load its settings:", error));

      const initialSlots = ctx.getPanels?.().slots?.getState?.();
      if (initialSlots) setSlots(initialSlots);
      render();

      ctx.setUiCycleStep?.(() => update({ visible: !settings.visible }));

      const offs = [
        ctx.events.on("ui:visibility", ({ visible } = {}) => {
          uiHidden = visible === false;
          render();
        }),
        ctx.events.on("mirror:changed", ({ active } = {}) => {
          mirrored = active === true;
          render();
        }),
        // What runs now: the tag and the marks follow straight away
        ctx.events.on("sketch:run", (sketch) => {
          running = { setup: sketch?.setup || "", main: sketch?.main || "" };
          editorUpdates.flush();
        }),
        ctx.events.on("editor:flash", () => {
          if (!settings.visible) return;
          for (const target of views()) target.flash();
          ctx.events.emit("overlay:flash");
        }),
        ctx.events.on("slots:changed", (state) => setSlots(state)),
        // The breakout window is an output too
        ctx.events.on("breakout:opened", () => {
          breakoutView?.dispose();
          breakoutView = null;
          const target = globalThis.window?.breakoutWindow?.document;
          const breakoutContainer = target?.getElementById("hydra-canvas-breakout");
          if (!breakoutContainer) return;
          breakoutView = createView(breakoutContainer, { doc: target });
          breakoutView.setEditor(snapshot);
          breakoutView.setSlots(slots);
          render();
        }),
        ctx.events.on("breakout:closed", () => {
          try {
            breakoutView?.dispose();
          } catch (_error) {
            // the window is gone already
          }
          breakoutView = null;
        }),
      ];

      const onVisible = () => update({ visible: controls.checkbox.checked });
      const onSlots = () => update({ slots: controls.slotsCheckbox.checked });
      const onBlend = () => update({ blendMode: controls.blendSelect.value });
      const onOpacityInput = () =>
        update({ opacity: Number(controls.opacitySlider.value) / 100 }, { persist: false });
      const onOpacityChange = () => update({ opacity: Number(controls.opacitySlider.value) / 100 });
      if (controls) {
        controls.checkbox.addEventListener("change", onVisible);
        controls.slotsCheckbox?.addEventListener("change", onSlots);
        controls.blendSelect.addEventListener("change", onBlend);
        controls.opacitySlider.addEventListener("input", onOpacityInput);
        controls.opacitySlider.addEventListener("change", onOpacityChange);
      }

      return {
        api: {
          getSettings: () => ({ ...settings }),
          /** Change some of `{ visible, slots, blendMode, opacity }`. */
          setSettings: (partial) => update(partial),
          toggle: () => update({ visible: !settings.visible }),
          isShown: () => view.isShown(),
          /** What the overlay shows of the editor, or null while it is off. */
          getSnapshot: () => snapshot,
        },
        dispose() {
          disposed = true;
          unsubscribe();
          offEditor();
          editorUpdates.cancel();
          for (const off of offs) off();
          ctx.setUiCycleStep?.(null);
          if (controls) {
            controls.checkbox.removeEventListener("change", onVisible);
            controls.slotsCheckbox?.removeEventListener("change", onSlots);
            controls.blendSelect.removeEventListener("change", onBlend);
            controls.opacitySlider.removeEventListener("input", onOpacityInput);
            controls.opacitySlider.removeEventListener("change", onOpacityChange);
          }
          try {
            breakoutView?.dispose();
          } catch (_error) {
            // the window is gone already
          }
          view.dispose();
        },
      };
    },
  };
}
