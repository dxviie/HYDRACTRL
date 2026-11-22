import { expect, test } from "bun:test";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { showTooltip } from "@codemirror/view";
import { signatureExtension } from "./SignatureAssistPlugin.js";
import { createCustomSignatureResolver } from "./customSignatures.js";

function setupReader(setup = () => "") {
  return { getCurrentTab: () => "main", getTabCode: setup };
}

function hint(source, name = "f") {
  const state = EditorState.create({ doc: source, extensions: [javascript()] });
  return createCustomSignatureResolver(setupReader())(state)(name, source.length);
}

test("attaches a multiline summary and matches reordered tags by actual binding", () => {
  const result = hint(`/**
 * Restricts a value.
 * To a range.
 * @param {number} max - Upper bound.
 * @param min Lower bound.
 *   Inclusive.
 * @param {number} value - <b>Input</b>.
 * @returns ignored
 *   Ignored continuation.
 */
 function f(value, min, max) {}`);
  expect(result.description).toBe("Restricts a value. To a range.");
  expect(result.params.map(({ documentation }) => documentation)).toEqual([
    "<b>Input</b>.",
    "Lower bound. Inclusive.",
    "Upper bound.",
  ]);
});

test("supports optional defaults and rest while preserving source labels", () => {
  const result = hint(`/**
 * @param {number} [limit=1] - Display only.
 * @param {...string} ...items - Remaining values.
 */
 const f = function named(limit = 2, ...items) {};`);
  expect(result.params).toMatchObject([
    { name: "limit = 2", documentation: "Display only." },
    { name: "...items", documentation: "Remaining values.", rest: true },
  ]);
});

test("matches optional and Unicode names for arrows", () => {
  const result = hint("/**\n * @param [élément] Details.\n */\nconst f = élément => élément;");
  expect(result.params[0]).toMatchObject({ name: "élément", documentation: "Details." });
});

test("drops only ambiguous, missing and unmatched parameter entries", () => {
  const result = hint(`/**
 * @param x - First.
 * @param {number} x - Conflicting.
 * @param {number} - Missing name.
 * @param unknown - Wrong name.
 * @param options.value - Unsupported nested tag.
 * @param {broken z - Malformed type.
 * @param value - Valid.
 */
 function f(x, { value }, z, value) {}`);
  expect(result.params.map(({ documentation }) => documentation)).toEqual([
    undefined,
    undefined,
    undefined,
    "Valid.",
  ]);
});

test("does not attach one tag to multiple bindings with the same name", () => {
  const result = hint("/** @param x Details. */\nfunction f(x, x) {}");
  expect(result.params.map(({ documentation }) => documentation)).toEqual([undefined, undefined]);
});

test.each([
  "/* A regular comment */\nfunction f(x) {}",
  "/** Separated. */\n\nfunction f(x) {}",
  "/** Interrupted. */\n// unrelated\nfunction f(x) {}",
  "/** Interrupted. */\n/* unrelated */\nfunction f(x) {}",
  "/** Unrelated. */\nlet v = 1;\nfunction f(x) {}",
  "let v = 1; /** Trailing. */\nfunction f(x) {}",
  "/** First. */\n/** Second. */\nfunction f(x) {}",
  "/** Which binding? */\nconst f = x => x, other = y => y;",
])("retains the signature but omits unattached documentation in %s", (source) => {
  const result = hint(source);
  expect(result.description).toBeUndefined();
  expect(result.params[0].name).toBe("x");
});

test("inactive Setup documentation updates independently and cursor movement reuses the hint", () => {
  let setup = "/** First. */\nfunction f(x) {}";
  const resolve = createCustomSignatureResolver(setupReader(() => setup));
  const state = EditorState.create({ doc: "f(1)", extensions: [javascript()] });
  const first = resolve(state)("f", 0);
  const cursor = state.update({ selection: { anchor: 2 } }).state;
  expect(resolve(cursor)("f", 0)).toBe(first);
  setup = setup.replace("First.", "Later.");
  expect(resolve(cursor)("f", 0).description).toBe("Later.");
  setup = "function f(x) {}";
  expect(resolve(cursor)("f", 0).description).toBeUndefined();
});

test("tooltip state refreshes on description-only edits at the same call position", () => {
  const doc = "/** Summary.\n * @param x - Lower.\n */\nfunction f(x) {}\nf(";
  let state = EditorState.create({
    doc,
    extensions: [javascript(), signatureExtension(setupReader())],
  });
  state = state.update({ selection: { anchor: doc.length } }).state;
  const [first] = state.facet(showTooltip);
  expect(first.description).toBe("Summary.");
  expect(first.params[0].documentation).toBe("Lower.");

  const from = doc.indexOf("Lower.");
  state = state.update({ changes: { from, to: from + 6, insert: "Floor." } }).state;
  const [edited] = state.facet(showTooltip);
  expect(edited.pos).toBe(first.pos);
  expect(edited.active).toBe(first.active);
  expect(edited.params[0].name).toBe(first.params[0].name);
  expect(edited.params[0].documentation).toBe("Floor.");
  expect(edited).not.toBe(first);

  const summaryFrom = doc.indexOf("Summary.");
  state = state.update({
    changes: { from: summaryFrom, to: summaryFrom + 8, insert: "Details." },
  }).state;
  const [summarized] = state.facet(showTooltip);
  expect(summarized.pos).toBe(first.pos);
  expect(summarized.description).toBe("Details.");
  expect(summarized.params[0].documentation).toBe("Floor.");

  const end = doc.indexOf("function");
  state = state.update({ changes: { from: 0, to: end, insert: " ".repeat(end) } }).state;
  const [removed] = state.facet(showTooltip);
  expect(removed.pos).toBe(first.pos);
  expect(removed.description).toBeUndefined();
  expect(removed.params[0].documentation).toBeUndefined();
});

test("associates underscore identifiers, including optional and rest spellings", () => {
  const result = hint(`/**
 * @param {number} [_value=1] - Optional value.
 * @param _ - Placeholder.
 * @param {...string} ..._items - Remaining items.
 * @param $value - Dollar name.
 * @param _value.extra - Invalid nested name.
 */
 function f(_value = 2, _, $value, ..._items) {}`);
  expect(result.params).toMatchObject([
    { name: "_value = 2", documentation: "Optional value." },
    { name: "_", documentation: "Placeholder." },
    { name: "$value", documentation: "Dollar name." },
    { name: "..._items", documentation: "Remaining items.", rest: true },
  ]);
});
