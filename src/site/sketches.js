/**
 * The hydra sketches behind the landing page. Each `code` is a hydra chain
 * without the final `.out()`: the background decides which output it renders
 * to, and shareCode() turns it into a complete sketch for the "open in
 * HYDRACTRL" link. `setup` runs once before the first frame; sketches that use
 * s0 all load the same image, so running every setup up front is safe.
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
    code: `osc(30, 0.004, 0)
  .rotate(0.3, 0.004)
  .mult(osc(30, 0.004, 0).rotate(-0.3, -0.004))
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
export function shareCode(sketch) {
  const header = [
    `// ${sketch.name}: one of the sketches behind hydractrl.d17e.dev`,
    "// Change anything and press Ctrl/⌘ + Enter to run it",
  ];
  const setup = sketch.setup ? [`${sketch.setup};`, ""] : [];
  return [...header, "", ...setup, sketch.code, "  .out()", ""].join("\n");
}
