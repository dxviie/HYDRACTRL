import { describe, expect, test } from "bun:test";
import {
  AUDIO_INPUT_KEY,
  createAudioInputs,
  findAudioInput,
  listAudioInputs,
  normalizeAudioInput,
  sameAudioInput,
} from "./audioInput.js";

const BUILT_IN = { deviceId: "id-built-in", label: "Built-in Microphone" };
const INTERFACE = { deviceId: "id-interface", label: "USB Interface" };

/**
 * A stand-in for navigator.mediaDevices: the inputs connected (the first is
 * the system default), the requests made and the streams handed out.
 */
function createMediaDevices(inputs = [BUILT_IN, INTERFACE], { labels = true } = {}) {
  const requests = [];
  const streams = [];
  const listeners = new Set();
  const devices = {
    inputs: [...inputs],
    allowed: true,
    // Labels only show once the page was allowed to listen
    labelled: labels,
    requests,
    streams,
    async enumerateDevices() {
      const shown = (input) => ({ ...input, label: devices.labelled ? input.label : "" });
      return [
        { kind: "videoinput", deviceId: "camera", label: "Camera" },
        ...(devices.inputs.length > 0
          ? [{ kind: "audioinput", deviceId: "default", label: "Default - Built-in Microphone" }]
          : []),
        ...devices.inputs.map((input) => ({ kind: "audioinput", ...shown(input) })),
      ];
    },
    async getUserMedia(constraints) {
      const exact = constraints.audio?.deviceId?.exact;
      requests.push(exact ?? "default");
      if (!devices.allowed) throw new Error("Permission denied");
      const input = exact ? devices.inputs.find((i) => i.deviceId === exact) : devices.inputs[0];
      if (!input) throw new Error("Requested device not found");
      devices.labelled = true;
      const ended = new Set();
      const track = {
        readyState: "live",
        stop() {
          track.readyState = "ended";
        },
        addEventListener: (_type, listener) => ended.add(listener),
      };
      const stream = {
        input: input.label,
        getTracks: () => [track],
        getAudioTracks: () => [track],
        // As when the input is unplugged
        end() {
          track.readyState = "ended";
          for (const listener of ended) listener();
        },
      };
      streams.push(stream);
      return stream;
    },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    /** Plug inputs in or pull them out. */
    change(next) {
      devices.inputs = [...next];
      for (const listener of listeners) listener();
    },
  };
  return devices;
}

/** What hydra does with a microphone: ask for the default one, analyse its stream. */
function createHydra(mediaDevices) {
  const a = {};
  mediaDevices.getUserMedia({ video: false, audio: true }).then((stream) => {
    a.stream = stream;
    a.context = { createMediaStreamSource: (source) => ({ stream: source }) };
    a.meyda = {
      source: { stream },
      setSource(source) {
        this.source = source;
      },
    };
  });
  return { synth: { a } };
}

function createStorage(choice) {
  const values = new Map(choice === undefined ? [] : [[AUDIO_INPUT_KEY, choice]]);
  return {
    getJSON: (key) => values.get(key) ?? null,
    setJSON: (key, value) => values.set(key, value),
    values,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The input hydra's analyser listens to. */
const heard = (hydra) => hydra.synth.a.meyda?.source.stream.input;

describe("normalizeAudioInput", () => {
  test("keeps an input's id and label", () => {
    expect(normalizeAudioInput({ ...INTERFACE, kind: "audioinput" })).toEqual(INTERFACE);
    expect(normalizeAudioInput({ label: "USB Interface" })).toEqual({
      deviceId: "",
      label: "USB Interface",
    });
  });

  test("takes anything else for the system default", () => {
    expect(normalizeAudioInput(null)).toBe(null);
    expect(normalizeAudioInput("id-interface")).toBe(null);
    expect(normalizeAudioInput({ deviceId: "", label: "" })).toBe(null);
    expect(normalizeAudioInput({ deviceId: "default", label: "Default - Built-in" })).toBe(null);
    expect(normalizeAudioInput({ deviceId: 3 })).toBe(null);
  });
});

test("sameAudioInput compares the id and the label", () => {
  expect(sameAudioInput(null, null)).toBe(true);
  expect(sameAudioInput(INTERFACE, { ...INTERFACE })).toBe(true);
  expect(sameAudioInput(INTERFACE, null)).toBe(false);
  expect(sameAudioInput(INTERFACE, BUILT_IN)).toBe(false);
});

describe("listAudioInputs", () => {
  test("lists the audio inputs, and the system default's name apart", async () => {
    expect(await listAudioInputs(createMediaDevices())).toEqual({
      inputs: [BUILT_IN, INTERFACE],
      defaultLabel: "Default - Built-in Microphone",
    });
  });

  test("is empty where the browser has no devices to list", async () => {
    expect(await listAudioInputs(undefined)).toEqual({ inputs: [], defaultLabel: "" });
  });
});

test("findAudioInput goes by the id, then by the label", () => {
  const inputs = [BUILT_IN, INTERFACE];
  expect(findAudioInput(INTERFACE, inputs)).toBe(INTERFACE);
  expect(findAudioInput({ deviceId: "old-id", label: "USB Interface" }, inputs)).toBe(INTERFACE);
  expect(findAudioInput({ deviceId: "old-id", label: "Gone" }, inputs)).toBe(null);
  expect(findAudioInput({ deviceId: "old-id", label: "" }, [{ deviceId: "x", label: "" }])).toBe(
    null,
  );
  expect(findAudioInput(null, inputs)).toBe(null);
});

describe("createAudioInputs", () => {
  test("hydra listens to the system default until an input is chosen", async () => {
    const mediaDevices = createMediaDevices();
    const audioInputs = createAudioInputs({ mediaDevices });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();

    expect(mediaDevices.requests).toEqual(["default"]);
    expect(heard(hydra)).toBe("Built-in Microphone");
    expect(audioInputs.getState()).toEqual({
      choice: null,
      device: null,
      missing: false,
      listening: true,
      error: null,
    });
    // hydra's own way of asking is back in place
    expect(Object.hasOwn(mediaDevices, "getUserMedia")).toBe(true);
  });

  test("hydra starts on the input that was kept, with one request", async () => {
    const mediaDevices = createMediaDevices();
    const audioInputs = createAudioInputs({ mediaDevices, storage: createStorage(INTERFACE) });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();

    expect(mediaDevices.requests).toEqual(["id-interface"]);
    expect(heard(hydra)).toBe("USB Interface");
    expect(audioInputs.getState().device).toEqual(INTERFACE);
  });

  test("choosing an input moves the analyser, stops the old stream and keeps the choice", async () => {
    const mediaDevices = createMediaDevices();
    const storage = createStorage();
    const states = [];
    const audioInputs = createAudioInputs({
      mediaDevices,
      storage,
      onChange: (state) => states.push(state),
    });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();
    const analyser = hydra.synth.a.meyda;

    const state = await audioInputs.choose(INTERFACE);

    expect(state).toMatchObject({ choice: INTERFACE, device: INTERFACE, missing: false });
    expect(hydra.synth.a.meyda).toBe(analyser);
    expect(heard(hydra)).toBe("USB Interface");
    expect(hydra.synth.a.stream.input).toBe("USB Interface");
    expect(mediaDevices.streams[0].getTracks()[0].readyState).toBe("ended");
    expect(storage.values.get(AUDIO_INPUT_KEY)).toEqual(INTERFACE);
    expect(states.at(-1)).toEqual(state);

    await audioInputs.choose(null);
    expect(heard(hydra)).toBe("Built-in Microphone");
    expect(storage.values.get(AUDIO_INPUT_KEY)).toBe(null);
  });

  test("choosing the input in use again asks for nothing", async () => {
    const mediaDevices = createMediaDevices();
    const audioInputs = createAudioInputs({ mediaDevices });
    audioInputs.attach(() => createHydra(mediaDevices));
    await audioInputs.choose(INTERFACE);
    const requests = mediaDevices.requests.length;

    await audioInputs.choose({ ...INTERFACE });
    expect(mediaDevices.requests.length).toBe(requests);
  });

  test("every instance follows, also one attached later", async () => {
    const mediaDevices = createMediaDevices();
    const audioInputs = createAudioInputs({ mediaDevices });
    const main = audioInputs.attach(() => createHydra(mediaDevices));
    await audioInputs.choose(INTERFACE);
    const breakout = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();
    expect(heard(breakout)).toBe("USB Interface");

    await audioInputs.choose(null);
    expect(heard(main)).toBe("Built-in Microphone");
    expect(heard(breakout)).toBe("Built-in Microphone");
  });

  test("finds an input by its label when its id changed", async () => {
    const mediaDevices = createMediaDevices();
    const stale = { deviceId: "id-from-another-browser", label: "USB Interface" };
    const audioInputs = createAudioInputs({ mediaDevices, storage: createStorage(stale) });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();

    expect(mediaDevices.requests).toEqual(["id-from-another-browser", "id-interface"]);
    expect(heard(hydra)).toBe("USB Interface");
    expect(audioInputs.getState()).toMatchObject({
      choice: stale,
      device: INTERFACE,
      missing: false,
    });
  });

  test("finds it by its label once listening shows the labels", async () => {
    const mediaDevices = createMediaDevices([BUILT_IN, INTERFACE], { labels: false });
    const stale = { deviceId: "id-from-another-browser", label: "USB Interface" };
    const audioInputs = createAudioInputs({ mediaDevices, storage: createStorage(stale) });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();

    expect(mediaDevices.requests).toEqual(["id-from-another-browser", "default", "id-interface"]);
    expect(heard(hydra)).toBe("USB Interface");
    // The system default was only listened to for its permission
    expect(mediaDevices.streams[0].getTracks()[0].readyState).toBe("ended");
  });

  test("listens to the system default while the chosen input isn't connected", async () => {
    const mediaDevices = createMediaDevices([BUILT_IN]);
    const audioInputs = createAudioInputs({ mediaDevices, storage: createStorage(INTERFACE) });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();

    expect(heard(hydra)).toBe("Built-in Microphone");
    expect(audioInputs.getState()).toMatchObject({
      choice: INTERFACE,
      device: null,
      missing: true,
      listening: true,
    });

    // Plugged in: back to it, and the choice never changed
    mediaDevices.change([BUILT_IN, INTERFACE]);
    await settle();
    expect(heard(hydra)).toBe("USB Interface");
    expect(audioInputs.getState()).toMatchObject({ choice: INTERFACE, missing: false });
  });

  test("falls back to the system default when the input in use is unplugged", async () => {
    const mediaDevices = createMediaDevices();
    const audioInputs = createAudioInputs({ mediaDevices, storage: createStorage(INTERFACE) });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();

    mediaDevices.inputs = [BUILT_IN];
    hydra.synth.a.stream.end();
    await settle();

    expect(heard(hydra)).toBe("Built-in Microphone");
    expect(audioInputs.getState()).toMatchObject({ choice: INTERFACE, missing: true });
  });

  test("an input that connects with others in use changes nothing", async () => {
    const mediaDevices = createMediaDevices([BUILT_IN]);
    const states = [];
    const audioInputs = createAudioInputs({ mediaDevices, onChange: (s) => states.push(s) });
    audioInputs.attach(() => createHydra(mediaDevices));
    await settle();
    const requests = mediaDevices.requests.length;
    const announced = states.length;

    mediaDevices.change([BUILT_IN, INTERFACE]);
    await settle();
    expect(mediaDevices.requests.length).toBe(requests);
    // Announced all the same, for the list of inputs
    expect(states.length).toBe(announced + 1);
  });

  test("says why when it can't listen, and starts once it can", async () => {
    const mediaDevices = createMediaDevices([]);
    const audioInputs = createAudioInputs({ mediaDevices });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();

    expect(hydra.synth.a.meyda).toBeUndefined();
    expect(audioInputs.getState()).toMatchObject({
      listening: false,
      error: "Requested device not found",
    });

    mediaDevices.change([BUILT_IN]);
    await settle();
    expect(heard(hydra)).toBe("Built-in Microphone");
    expect(audioInputs.getState()).toMatchObject({ listening: true, error: null });
  });

  test("keeps the input in use when another can't be opened", async () => {
    const mediaDevices = createMediaDevices();
    const audioInputs = createAudioInputs({ mediaDevices });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    await settle();

    mediaDevices.allowed = false;
    const state = await audioInputs.choose(INTERFACE);
    expect(state).toMatchObject({ choice: INTERFACE, listening: true, error: "Permission denied" });
    expect(heard(hydra)).toBe("Built-in Microphone");
  });

  test("the last of several quick choices wins", async () => {
    const mediaDevices = createMediaDevices();
    const audioInputs = createAudioInputs({ mediaDevices });
    const hydra = audioInputs.attach(() => createHydra(mediaDevices));
    audioInputs.choose(INTERFACE);
    audioInputs.choose(null);
    await audioInputs.choose(INTERFACE);

    expect(heard(hydra)).toBe("USB Interface");
    const live = mediaDevices.streams.filter((s) => s.getTracks()[0].readyState === "live");
    expect(live.map((s) => s.input)).toEqual(["USB Interface"]);
  });

  test("leaves other requests and pages without a microphone alone", async () => {
    const mediaDevices = createMediaDevices();
    const audioInputs = createAudioInputs({ mediaDevices });
    // An instance that doesn't listen (detectAudio off) but opens a camera
    const hydra = audioInputs.attach(() => {
      mediaDevices.getUserMedia({ video: true, audio: false });
      return { synth: {} };
    });
    await audioInputs.choose(INTERFACE);
    expect(hydra).toEqual({ synth: {} });
    expect(mediaDevices.requests).toEqual(["default"]);

    // No mediaDevices at all, as on a page that isn't served securely
    const none = createAudioInputs({ mediaDevices: null });
    expect(none.attach(() => "hydra")).toBe("hydra");
    expect(await none.choose(INTERFACE)).toMatchObject({ choice: INTERFACE, listening: false });
    expect(await none.list()).toEqual({ inputs: [], defaultLabel: "" });
  });

  test("stops listening when disposed", async () => {
    const mediaDevices = createMediaDevices();
    const audioInputs = createAudioInputs({ mediaDevices });
    audioInputs.attach(() => createHydra(mediaDevices));
    await settle();
    audioInputs.dispose();
    expect(mediaDevices.streams[0].getTracks()[0].readyState).toBe("ended");
    mediaDevices.change([BUILT_IN]);
    await settle();
    expect(mediaDevices.requests).toEqual(["default"]);
  });
});
