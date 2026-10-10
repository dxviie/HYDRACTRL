// A synthetic 120 BPM beat for hydra's audio analyser, on the page's clock:
// kick on every beat, snare on 2 and 4, hats on the eighths. The recordings
// are silent, so a steady pattern reads better than real audio would.
// __installBeat() replaces a.meyda, which a.tick() reads every frame.
window.__installBeat = () => {
  const start = performance.now();
  const decay = (t, ms) => (t < 0 ? 0 : Math.exp(-t / ms));
  window.a.meyda = {
    get() {
      const t = performance.now() - start;
      const beat = 500;
      const inBeat = t % beat;
      const count = Math.floor(t / beat);
      const kick = decay(inBeat, 110) * (count % 4 === 0 ? 1.15 : 1);
      const snare = count % 2 === 1 ? decay(inBeat, 140) : 0;
      const hat = decay(t % (beat / 2), 45);
      // 24 bark bands, as meyda's loudness feature has them
      const specific = new Float32Array(24);
      for (let i = 0; i < 24; i++) {
        const low = i < 6 ? 2.6 * kick : 0;
        const mid = i >= 6 && i < 12 ? 1.6 * kick + 1.9 * snare : 0;
        const high = i >= 12 && i < 18 ? 1.8 * snare + 0.5 * hat : 0;
        const air = i >= 18 ? 1.3 * hat + 0.6 * snare : 0;
        specific[i] = 0.35 + low + mid + high + air + 0.08 * Math.sin(t / 97 + i);
      }
      return { loudness: { total: specific.reduce((sum, v) => sum + v, 0), specific } };
    },
  };
};
