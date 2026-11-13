/**
 * AudioInputPlugin - choose what a.fft listens to.
 *
 * Fills the system panel's AUDIO INPUT list with the inputs the browser
 * offers and moves a.fft to the one picked (`ctx.audioInputs`, see
 * core/audioInput.js). The choice is kept in this browser. The core emits
 * `audio:input` whenever the choice, the input in use or the inputs connected
 * change; the output sync plugin passes the choice on, so the outputs listen
 * to the same input. That matters most in the desktop app, whose sketches
 * run on its Syphon/Spout output, and which has no browser settings to pick
 * a microphone in.
 */
import { findAudioInput } from "../core/audioInput.js";

/** The list's value for the system default, and for a chosen input that isn't connected. */
export const DEFAULT_VALUE = "";
export const MISSING_VALUE = "missing";

/**
 * What the list offers, `{ options: [{ value, label }], value }`: the system
 * default, every input connected, and the chosen one when it isn't.
 */
export function audioInputOptions({ inputs = [], defaultLabel = "", choice = null } = {}) {
  const options = [{ value: DEFAULT_VALUE, label: defaultLabel || "System default" }];
  inputs.forEach((input, index) => {
    // No names until the page may use the microphone
    options.push({ value: input.deviceId, label: input.label || `Input ${index + 1}` });
  });
  if (!choice) return { options, value: DEFAULT_VALUE };
  const found = findAudioInput(choice, inputs);
  if (found) return { options, value: found.deviceId };
  options.push({
    value: MISSING_VALUE,
    label: `${choice.label || "Chosen input"} (not connected)`,
  });
  return { options, value: MISSING_VALUE };
}

/** What to say under the list, "" when a.fft listens to the chosen input. */
export function audioInputStatus(state) {
  if (!state) return "";
  if (state.error && !state.listening) return `Can't listen: ${state.error}`;
  if (state.missing) return "Not connected. a.fft listens to the system default until it is back.";
  return "";
}

export function createAudioInputPlugin() {
  return {
    id: "audio-input",
    name: "Audio Input",
    description: "Chooses the audio input a.fft listens to, on every output too",

    setup(ctx) {
      const audioInputs = ctx.audioInputs;
      const controls = ctx.getPanels?.().stats?.audioInput;
      if (!audioInputs || !controls) return;
      const { select, status } = controls;

      let inputs = [];
      let defaultLabel = "";
      let shown = "";
      let disposed = false;

      function render() {
        const state = audioInputs.getState();
        const { options, value } = audioInputOptions({
          inputs,
          defaultLabel,
          choice: state.choice,
        });
        // Left alone while nothing changed, so an open list stays open
        const next = JSON.stringify(options);
        if (next !== shown) {
          shown = next;
          select.replaceChildren(
            ...options.map((option) => {
              const element = select.ownerDocument.createElement("option");
              element.value = option.value;
              element.textContent = option.label;
              return element;
            }),
          );
        }
        select.value = value;
        const text = audioInputStatus(state);
        status.textContent = text;
        status.style.display = text ? "block" : "none";
      }

      async function refresh() {
        try {
          ({ inputs, defaultLabel } = await audioInputs.list());
        } catch (error) {
          console.warn("[audio-input] could not list the inputs:", error);
        }
        if (!disposed) render();
      }

      const onPick = () => {
        if (select.value === MISSING_VALUE) return;
        const picked = inputs.find((input) => input.deviceId === select.value) || null;
        audioInputs
          .choose(picked)
          .then((state) => {
            const problem = audioInputStatus(state);
            if (problem) ctx.notify(`Audio input: ${problem}`, { type: "error" });
          })
          .catch((error) => console.warn("[audio-input] could not switch:", error));
      };
      select.addEventListener("change", onPick);

      // Also when a.fft starts listening: the inputs have their names from then on
      const offInput = ctx.events.on("audio:input", refresh);
      refresh();

      return {
        api: {
          refresh,
          getState: () => audioInputs.getState(),
          /** Listen to an input, `{ deviceId, label }`, or to the system default (null). */
          choose: (input) => audioInputs.choose(input),
        },
        dispose() {
          disposed = true;
          offInput();
          select.removeEventListener("change", onPick);
        },
      };
    },
  };
}
