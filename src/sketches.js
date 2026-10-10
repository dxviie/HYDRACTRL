/**
 * The starter scenes: the hydra sketches a fresh HYDRACTRL starts with (bank 1
 * of public/assets/banks/hydractrl-init-basic.json) and that play behind the
 * landing page. Each `code` is a hydra chain without the final `.out()`, so
 * the landing backdrop can pick the output it renders to; sketchSource()
 * turns a sketch into the complete program the editor shows. `setup` runs
 * once before the first frame; the sketches that use s0 all load the same
 * image, so the backdrop can run every setup up front.
 */

const LOGO = "/assets/img/hydractrl-logo-bw.png";

export const SKETCHES = [
  {
    name: "Tide",
    code: `noise(1.8, 0.04)
  .color(0.56, 0.1, 1)
  .modulate(osc(2, 0.03, 0).rotate(0.4), 0.3)
  .add(
    noise(3, 0.06)
      .thresh(0.55, 0.3)
      .color(0.05, 0.9, 0.55)
      .modulate(noise(1, 0.03), 0.2),
    0.35
  )
  .brightness(-0.15)`,
  },
  {
    name: "Chained",
    setup: `s0.initImage("${LOGO}")`,
    code: `src(s0)
  .invert()
  .scale(0.14, 1, () => innerWidth / innerHeight)
  .scroll(0, 0, 0.01, -0.004)
  .modulateScrollY(osc(4, 0.03).rotate(0, 0.05), 0.1)
  .mult(noise(1.2, 0.04).add(solid(0.35, 0.35, 0.35)))
  .color(0.56, 0.1, 1)`,
  },
  {
    name: "Pulse",
    hint: "nanoX and nanoY follow the XY pad: drag it to reshape the pattern",
    code: `osc(() => 18 + nanoX * 24, 0.004, 0)
  .rotate(() => 0.1 + nanoY * 0.4, 0.004)
  .mult(
    osc(() => 18 + nanoX * 24, 0.004, 0)
      .rotate(() => -0.1 - nanoY * 0.4, -0.004)
  )
  .color(0.5, 0.25, 1)
  .mult(noise(1, 0.03).add(solid(0.4, 0.4, 0.4)))`,
  },
  {
    name: "Mint",
    setup: `s0.initImage("${LOGO}")`,
    code: `src(s0)
  .invert()
  .scale(0.3, 1, () => innerWidth / innerHeight)
  .scroll(0.25, 0, 0.004, 0.006)
  .modulate(noise(2, 0.03), 0.04)
  .mult(osc(3, 0.02, 0).modulate(noise(1, 0.02), 0.5).thresh(0.4, 0.5))
  .color(0.04, 0.7, 0.42)
  .brightness(-0.15)`,
  },
];

/** The sketch as a complete program, ready for the HYDRACTRL editor. */
export function sketchSource(sketch) {
  const header = [`// ${sketch.name} · a HYDRACTRL starter scene`];
  if (sketch.hint) header.push(`// ${sketch.hint}`);
  header.push("// Change anything, then press Ctrl/⌘ + Enter to run it");
  const setup = sketch.setup ? [`${sketch.setup};`, ""] : [];
  return [...header, "", ...setup, sketch.code, "  .out()", ""].join("\n");
}
