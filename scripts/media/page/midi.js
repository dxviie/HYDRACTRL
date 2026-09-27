// A fake Korg nanoPAD2 behind the Web MIDI API, for the MIDI recording:
// __midi.send([status, data1, data2]) delivers a message as if it came from
// the device.
(() => {
  if (window.__midi) return;
  const listeners = new Set();
  const input = {
    id: "fake-nanopad2",
    name: "nanoPAD2",
    manufacturer: "KORG INC.",
    type: "input",
    state: "connected",
    connection: "open",
    version: "1.0",
    onmidimessage: null,
    onstatechange: null,
    addEventListener(type, listener) {
      if (type === "midimessage") listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    open: async () => input,
    close: async () => input,
  };
  const access = {
    inputs: new Map([[input.id, input]]),
    outputs: new Map(),
    sysexEnabled: true,
    onstatechange: null,
    addEventListener() {},
    removeEventListener() {},
  };
  navigator.requestMIDIAccess = () => Promise.resolve(access);
  window.__midi = {
    send(bytes) {
      const event = { data: new Uint8Array(bytes), timeStamp: performance.now(), target: input };
      if (typeof input.onmidimessage === "function") input.onmidimessage(event);
      for (const listener of listeners) listener(event);
    },
  };
})();
