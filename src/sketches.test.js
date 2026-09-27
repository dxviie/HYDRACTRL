import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { decodeSketch, encodeSketch } from "./client/plugins/UrlSharePlugin.js";
import { SKETCHES, sketchSource } from "./sketches.js";

const STARTER_BANK = new URL("../public/assets/banks/hydractrl-init-basic.json", import.meta.url);

/**
 * A stand-in for hydra's globals: every generator returns a chain that
 * accepts any method call, so the sketches can be checked for syntax and for
 * only using names hydra (and the XY pad) provides.
 */
function hydraScope() {
  const chain = () =>
    new Proxy(() => {}, {
      apply: () => chain(),
      get: (_target, property) => (property === Symbol.toPrimitive ? () => 0 : chain()),
    });
  const names = [
    "osc",
    "noise",
    "voronoi",
    "shape",
    "gradient",
    "solid",
    "src",
    "s0",
    "o0",
    "o1",
    "o2",
    "o3",
  ];
  const scope = Object.fromEntries(names.map((name) => [name, chain()]));
  scope.s0 = { initImage: () => {} };
  scope.innerWidth = 1280;
  scope.innerHeight = 720;
  scope.nanoX = 0.5;
  scope.nanoY = 0.5;
  return scope;
}

function evaluate(code) {
  const scope = hydraScope();
  return new Function(...Object.keys(scope), code)(...Object.values(scope));
}

describe("SKETCHES", () => {
  test("have unique names and only use hydra's vocabulary", () => {
    const names = SKETCHES.map((sketch) => sketch.name);
    expect(new Set(names).size).toBe(names.length);
    for (const sketch of SKETCHES) {
      expect(() => evaluate(`${sketch.setup || ""};\n${sketch.code}\n.out(o0)`)).not.toThrow();
      expect(sketch.code).not.toContain(".out(");
    }
  });

  test("load images from this site only", () => {
    for (const sketch of SKETCHES.filter((s) => s.setup)) {
      expect(sketch.setup).toMatch(/initImage\("\/assets\/img\/[\w-]+\.png"\)/);
    }
  });
});

describe("sketchSource", () => {
  test("is a complete program that runs as-is", () => {
    const withImage = SKETCHES.find((sketch) => sketch.setup);
    const code = sketchSource(withImage);
    expect(code.startsWith(`// ${withImage.name} · `)).toBe(true);
    expect(code).toContain(`${withImage.setup};`);
    expect(code.trimEnd().endsWith(".out()")).toBe(true);
    expect(() => evaluate(code)).not.toThrow();
  });

  test("passes a sketch's hint on as a comment", () => {
    const withHint = SKETCHES.find((sketch) => sketch.hint);
    expect(sketchSource(withHint).split("\n")[1]).toBe(`// ${withHint.hint}`);
  });

  test("survives the trip through a share link", () => {
    for (const sketch of SKETCHES) {
      const code = sketchSource(sketch);
      expect(decodeSketch(encodeSketch(code))).toBe(code);
    }
  });
});

describe("the starter bank", () => {
  // Update it by saving each sketch to its slot in a fresh HYDRACTRL (which
  // captures the thumbnail) and exporting the bank with Alt/⌥ + X
  test("holds the sketches, in order, with thumbnails", () => {
    const bank = JSON.parse(readFileSync(STARTER_BANK, "utf8"));
    expect(bank.version).toBe(1);
    expect(bank.banks).toHaveLength(1);
    const [{ bankIndex, slots }] = bank.banks;
    expect(bankIndex).toBe(0);
    expect(slots.map((slot) => slot.slotIndex)).toEqual(SKETCHES.map((_sketch, index) => index));
    slots.forEach((slot, index) => {
      expect(decodeURIComponent(atob(slot.code))).toBe(sketchSource(SKETCHES[index]));
      expect(slot.thumbnail).toMatch(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/);
    });
  });
});
