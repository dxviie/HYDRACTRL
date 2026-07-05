import { describe, expect, test } from "bun:test";
import { buildShareUrl, decodeSketch, encodeSketch, readSketchFromHash } from "./UrlSharePlugin.js";

const SAMPLE_SKETCH = `osc(10, 0.1, 1.2)
  .color(0.5, 0.1, 0.9)
  .rotate(0, 0.1)
  .out()
`;

describe("sketch URL codec", () => {
  test("round-trips plain sketches", () => {
    const encoded = encodeSketch(SAMPLE_SKETCH);
    expect(decodeSketch(encoded)).toBe(SAMPLE_SKETCH);
  });

  test("round-trips non-Latin1 characters", () => {
    const code = "// ünïcødé — 日本語 🎛️\nosc(4).out()";
    expect(decodeSketch(encodeSketch(code))).toBe(code);
  });

  test("produces URL-safe output (no +, / or =)", () => {
    // This input is chosen to produce +, / and padding in plain base64
    const code = "~~~???>>>ab";
    const encoded = encodeSketch(code);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeSketch(encoded)).toBe(code);
  });

  test("rejects empty or non-string input", () => {
    expect(encodeSketch("")).toBe(null);
    expect(encodeSketch(undefined)).toBe(null);
    expect(decodeSketch("")).toBe(null);
    expect(decodeSketch(undefined)).toBe(null);
  });

  test("decodeSketch returns null for garbage instead of throwing", () => {
    expect(decodeSketch("!!not-base64!!")).toBe(null);
    expect(decodeSketch("%%%")).toBe(null);
  });
});

describe("readSketchFromHash", () => {
  test("extracts a sketch from a location hash", () => {
    const encoded = encodeSketch(SAMPLE_SKETCH);
    expect(readSketchFromHash(`#sketch=${encoded}`)).toBe(SAMPLE_SKETCH);
    // Leading "#" is optional
    expect(readSketchFromHash(`sketch=${encoded}`)).toBe(SAMPLE_SKETCH);
  });

  test("returns null when there is no sketch parameter", () => {
    expect(readSketchFromHash("")).toBe(null);
    expect(readSketchFromHash("#")).toBe(null);
    expect(readSketchFromHash("#other=1")).toBe(null);
    expect(readSketchFromHash(undefined)).toBe(null);
  });

  test("returns null for a corrupt payload", () => {
    expect(readSketchFromHash("#sketch=!!bad!!")).toBe(null);
  });
});

describe("buildShareUrl", () => {
  test("builds a link from the current location", () => {
    const location = { origin: "https://hydractrl.example", pathname: "/" };
    const url = buildShareUrl("osc().out()", location);

    expect(url.startsWith("https://hydractrl.example/#sketch=")).toBe(true);
    const hash = url.slice(url.indexOf("#"));
    expect(readSketchFromHash(hash)).toBe("osc().out()");
  });

  test("returns null for an empty sketch", () => {
    const location = { origin: "https://hydractrl.example", pathname: "/" };
    expect(buildShareUrl("", location)).toBe(null);
  });
});
