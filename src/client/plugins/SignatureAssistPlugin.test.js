import { expect, test } from "bun:test";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { signatureExtension } from "./SignatureAssistPlugin.js";
import { hydraCallAtCursor } from "./hydraSignature.js";

test("reuses the mounted theme while keeping each signature extension's state independent", () => {
  const editor = { getCurrentTab: () => "main", getTabCode: () => "" };
  const first = signatureExtension(editor);
  const second = signatureExtension(editor);

  expect(first.at(-1)).toBe(second.at(-1));
  expect(first[0]).not.toBe(second[0]);
});

function resolve(source, extensions = [javascript()]) {
  const anchor = source.indexOf("|");
  const doc = source.replace("|", "");
  return hydraCallAtCursor(EditorState.create({ doc, selection: { anchor }, extensions }));
}

test.each([
  ["osc(|", "osc", 0],
  ["osc(60,|", "osc", 1],
  ["osc([1, 2], /* , */ 0.1,|)", "osc", 2],
  ['osc("x,y",|)', "osc", 1],
  ["osc(osc(60,|", "osc", 1],
  ["osc(noise(60,|", "noise", 1],
  ["osc(noise(60)|", "osc", 0],
  ["osc(noise(60),|", "osc", 1],
  ["osc(1, 2, 3,|", "osc", -1],
  ["shape().rotate(1,|", "rotate", 1],
  ["shape().color(|", "color", 0],
  ["shape().blend(osc(),|", "blend", 1],
  ["osc().modulate(noise(),|", "modulate", 1],
  ["osc().rotate(1).out(|", "out", 0],
  ["render(|", "render", 0],
  ["hush(|", "hush", -1],
  ["setResolution(640,|", "setResolution", 1],
  ["setFunction(|", "setFunction", 0],
  ["s0.initVideo(url,|", "initVideo", 1],
  ["s3.initCam(|", "initCam", 0],
  ["a.setSmooth(|", "setSmooth", 0],
  ["a.show(|", "show", -1],
  ["[1, 2].fast().ease(|", "ease", 0],
  ["[1, 2].fit(0,|", "fit", 1],
])("resolves %s", (source, name, active) => {
  expect(resolve(source)).toMatchObject({ name, active });
});

test.each([
  "osc(60)|",
  "osc|()",
  "osc(custom(1,|",
  "other.osc(60,|",
  "out(|",
  "osc.rotate(|",
  "osc().out().rotate(|",
  "osc(,).rotate(|",
  "unknown().rotate(|",
  "a.fft(|",
  "a.fft[0]|",
  "other.setSmooth(|",
  "s4.initVideo(|",
  "initVideo(|",
  "s0['initVideo'](|",
  "s0?.initVideo(|",
  "osc?.(|",
  "seq.fast(|",
  "time(|",
  "speed(|",
  "bpm(|",
  "update(|",
  "setResolution(, |",
  "osc(60, @|",
  "osc(...values, |",
  "new osc(|",
])("hides uncertain or unsupported call %s", (source) => {
  expect(resolve(source)).toBeNull();
});

test("uses audited default text and preserves parameter order", () => {
  expect(resolve("osc(|").params).toEqual([
    expect.objectContaining({ name: "frequency", default: "60" }),
    expect.objectContaining({ name: "sync", default: "0.1" }),
    expect.objectContaining({ name: "offset", default: "0" }),
  ]);
  expect(resolve("render(|").params).toEqual([{ name: "buffer" }]);
  expect(resolve("a.setSmooth(|").params).toEqual([{ name: "smooth" }]);
  expect(resolve("s0.initCam(|").params[0]).toEqual({ name: "index" });
  expect(resolve("[1].smooth(|").params).toEqual([{ name: "smooth", default: "1" }]);
  expect(resolve("[1].ease(|").params).toEqual([{ name: "ease", default: '"linear"' }]);
});

test("hides the hint when the language tree is unavailable", () => {
  expect(resolve("osc(60,|", [])).toBeNull();
});
