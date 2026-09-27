import { describe, expect, test } from "bun:test";
import { decodeSketch, encodeSketch } from "../client/plugins/UrlSharePlugin.js";
import { SKETCHES, shareCode } from "./sketches.js";

/**
 * A stand-in for hydra's globals: every generator returns a chain that
 * accepts any method call, so the sketches can be checked for syntax and for
 * only using names hydra provides.
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

describe("shareCode", () => {
  test("is a complete program that runs as-is", () => {
    const withImage = SKETCHES.find((sketch) => sketch.setup);
    const code = shareCode(withImage);
    expect(code.startsWith(`// ${withImage.name}:`)).toBe(true);
    expect(code).toContain(`${withImage.setup};`);
    expect(code.trimEnd().endsWith(".out()")).toBe(true);
    expect(() => evaluate(code)).not.toThrow();
  });

  test("survives the trip through a share link", () => {
    for (const sketch of SKETCHES) {
      const code = shareCode(sketch);
      expect(decodeSketch(encodeSketch(code))).toBe(code);
    }
  });
});
