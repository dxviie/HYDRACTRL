import { expect, test } from "bun:test";
import { history, isolateHistory, redo, undo } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { createCustomSignatureResolver } from "./customSignatures.js";
import { hydraCallAtCursor } from "./hydraSignature.js";

const setup = [
  "var clamp = (value, min, max) => Math.min(Math.max(value, min), max)",
  "function lerp(a, b, t) { return a + (b - a) * t }",
  "const tide = (period, amplitude = 1) => Math.sin(time * 2 * Math.PI / period) * amplitude",
].join("\n");

test("matches a fresh full index through edits, history, tab switches and slot replacements", () => {
  const template = `/**
 * Offsets the input.
 * @param _value - Input value.
 */
function adjust(_value = 1, { amount } = {}, ...rest) { return _value; }
adjust(|1, {}, 3);`;
  let tab = "main";
  const code = { main: "", setup };
  const editor = { getCurrentTab: () => tab, getTabCode: (name) => code[name] };
  const lookup = createCustomSignatureResolver(editor);
  const extensions = [javascript(), history()];
  let state = EditorState.create({ extensions });
  const target = {
    get state() {
      return state;
    },
    dispatch(transaction) {
      state = transaction.state;
    },
  };

  function compareWithFreshIndex() {
    const fresh = EditorState.create({
      doc: state.doc,
      selection: state.selection,
      extensions: [javascript()],
    });
    const rebuilt = createCustomSignatureResolver(editor);
    const actual = hydraCallAtCursor(state, lookup(state));
    expect(actual).toEqual(hydraCallAtCursor(fresh, rebuilt(fresh)));
    return actual;
  }

  function change(source, nextTab = tab) {
    code[tab] = state.doc.toString();
    tab = nextTab;
    const anchor = source.indexOf("|");
    const next = source.replace("|", "");
    const previous = state.doc.toString();
    let from = 0;
    while (from < Math.min(previous.length, next.length) && previous[from] === next[from]) from++;
    let to = previous.length;
    let end = next.length;
    while (to > from && end > from && previous[to - 1] === next[end - 1]) {
      to--;
      end--;
    }
    state = state.update({
      changes: { from, to, insert: next.slice(from, end) },
      selection: { anchor },
      annotations: isolateHistory.of("full"),
    }).state;
    return compareWithFreshIndex();
  }

  expect(change(template).params[0]).toMatchObject({
    name: "_value = 1",
    documentation: "Input value.",
  });
  expect(change(template.replace("= 1,", "= 12,")).params[0].name).toBe("_value = 12");
  expect(undo(target)).toBe(true);
  expect(compareWithFreshIndex().params[0].name).toBe("_value = 1");
  expect(redo(target)).toBe(true);
  expect(compareWithFreshIndex().params[0].name).toBe("_value = 12");

  for (const edited of [
    template.replace("{ amount }", "[amount]").replace("...rest", "...args"),
    template.replace("Input value.", "A revised input.\n * Continues here."),
    template.replace("function adjust", "\nfunction adjust"),
    template.replace("return _value;", "const adjust = false; return _value;"),
    template.replace("adjust(|", "adjust = 0;\nadjust(|"),
    template.replace("adjust(|", "function adjust(value) {}\nadjust(|"),
    template.replace("function adjust", "function renamed"),
    "adjust(|1, {}, 3);",
    template.replace("= {},", "= [{,],"),
    template,
    "const osc = false;\nosc(|2);",
    "osc(|2);",
  ]) {
    change(edited);
  }

  change(`${setup}\nclamp(|1, 0, 2);`, "setup");
  change("const example = () => clamp(1, |0, 2);", "main");
  change("const example = () => lerp(1, 0, |0.5);");
});

function fixture(sources = { setup, main: "" }) {
  const code = { ...sources };
  let current = "main";
  const resolve = createCustomSignatureResolver({
    getCurrentTab: () => current,
    getTabCode: (tab) => code[tab],
  });

  return {
    code,
    lookup(source, tab = "main") {
      current = tab;
      const anchor = source.indexOf("|");
      const doc = source.replace("|", "");
      const state = EditorState.create({ doc, selection: { anchor }, extensions: [javascript()] });
      return hydraCallAtCursor(state, resolve(state));
    },
  };
}

test.each([
  ["clamp(0.5,|", "clamp", ["value", "min", "max"], 1],
  ["lerp(0, 1,|", "lerp", ["a", "b", "t"], 2],
  ["tide(20,|", "tide", ["period", "amplitude = 1"], 1],
  ["osc(clamp(0.5,|", "clamp", ["value", "min", "max"], 1],
  ["clamp(osc(20,|", "osc", ["frequency", "sync", "offset"], 1],
  ["clamp(1, 2, 3,|", "clamp", ["value", "min", "max"], -1],
])("uses unsaved Setup helpers in %s", (source, name, params, active) => {
  const call = fixture().lookup(source);
  expect({
    name: call.name,
    params: call.params.map(({ name }) => name),
    active: call.active,
  }).toEqual({ name, params, active });
});

test.each([
  ["let alpha = async x => x, beta = function named() {}; alpha(|", ["x"], 0],
  ["let alpha = async x => x, beta = function named() {}; beta(|", [], -1],
  [
    'const f = function({x}, [y], msg = "a   b", ...rest) {}; f(1,2,3,4,5,|',
    ["{x}", "[y]", 'msg = "a   b"', "...rest"],
    3,
  ],
  ["function f(x = [1, 2], y = {a: 1, b: 2},) {}; f(1,|", ["x = [1, 2]", "y = {a: 1, b: 2}"], 1],
  ["function* f(item) {}; f(|", ["item"], 0],
  ["const f /* binding */ = /* initializer */ x => x; f(|", ["x"], 0],
])("extracts parameters from %s", (source, params, active) => {
  const call = fixture().lookup(source);
  expect(call.params.map(({ name }) => name)).toEqual(params);
  expect(call.active).toBe(active);
});

test("updates both indexes on edits, tab switching, renames and slot replacement", () => {
  const session = fixture();
  expect(session.lookup("tide(20,|").params[1].name).toBe("amplitude = 1");
  session.code.setup = setup.replace("amplitude = 1", "height = 2");
  expect(session.lookup("tide(20,|").params[1].name).toBe("height = 2");
  session.code.setup = setup.replace("const tide", "const wave");
  expect(session.lookup("tide(20,|")).toBeNull();
  expect(session.lookup("wave(20,|").active).toBe(1);
  expect(session.lookup("const local = (first, second) => first; local(1,|").params[1].name).toBe(
    "second",
  );
  expect(session.lookup("const local = (first, revised) => first; local(1,|").params[1].name).toBe(
    "revised",
  );
  expect(session.lookup("local(1,|")).toBeNull();
  expect(session.lookup("function here(amount) {} here(|", "setup").params[0].name).toBe("amount");
});

test("Setup sees hoisted Sketch declarations, but Sketch initializers run later", () => {
  const session = fixture({
    setup: "",
    main: "function hoisted(x) {}\nconst later = (y) => y",
  });
  expect(session.lookup("hoisted(|", "setup").params[0].name).toBe("x");
  expect(session.lookup("later(|", "setup")).toBeNull();
  expect(session.lookup("later(|); const later = (y) => y")).toBeNull();
});

test("custom names take precedence over Hydra while shadowed receiver chains are hidden", () => {
  const session = fixture({
    setup: "function osc(custom) {}\nconst s0 = object; const a = other;",
    main: "",
  });
  expect(session.lookup("osc(|").params[0].name).toBe("custom");
  expect(session.lookup("osc().rotate(|")).toBeNull();
  expect(session.lookup("s0.initVideo(|")).toBeNull();
  expect(session.lookup("a.setSmooth(|")).toBeNull();
  expect(session.lookup("noise(|").params[0].name).toBe("scale");
});

test("recognizes chained texture methods on helpers from either tab", () => {
  const session = fixture({ setup: "function field(n) { return osc(n).rotate(1); }", main: "" });
  const sketch = "var carrier = () => osc(40, 0.02, 0);\n";
  expect(session.lookup(`${sketch}carrier().diff(|field(10))`)).toMatchObject({
    name: "diff",
    active: 0,
    params: [{ name: "texture" }],
  });
  expect(
    session.lookup(`${sketch}carrier().diff(field(10)).modulateScale(field(20), 0.2, |1)`),
  ).toMatchObject({ name: "modulateScale", active: 2 });
  expect(session.lookup("field(10).scale(1,|")).toMatchObject({ name: "scale", active: 1 });
  expect(session.lookup(`${sketch}carrier().out().rotate(|`)).toBeNull();
  expect(session.lookup("carrier().diff(|); " + sketch)).toBeNull();
  session.code.setup = "function field(n) { return other(n); }";
  expect(session.lookup("field(10).scale(1,|")).toBeNull();
});

test.each([
  "const carrier = () => Math.sin(1);",
  "const carrier = () => osc().out();",
  "const carrier = () => osc.rotate(1);",
  "const carrier = async () => osc();",
  "function* carrier() { return osc(); }",
  "function carrier() { if (x) return osc(); }",
  "function carrier(osc) { return osc(); }",
  "const carrier = function osc() { return osc(); };",
  "let carrier = () => osc(); carrier = other;",
  "const carrier = () => osc(); const osc = other;",
])("does not infer a texture return from %s", (declaration) => {
  expect(fixture().lookup(`${declaration}\ncarrier().diff(|`)).toBeNull();
});

test("checks generator shadows at the helper declaration across tabs", () => {
  const session = fixture({ setup: "function carrier() { return osc(); }", main: "" });
  expect(session.lookup("function here(osc) { carrier().diff(|); }")).toMatchObject({
    name: "diff",
  });
  expect(session.lookup("const osc = other; carrier().diff(|")).toBeNull();
  expect(session.lookup("function here(carrier) { carrier().diff(|); }")).toBeNull();
  session.code.setup = "function carrier(osc) { return osc(); }";
  expect(session.lookup("carrier().diff(|")).toBeNull();
  expect(session.lookup("carrier(|").params[0].name).toBe("osc");
});

test.each([
  "function f(x) {} function f(y) {} f(|",
  "const f = makeFunction(); f(|",
  "const f = (x,, y) => x; f(|",
  "let f = (x) => ; f(|",
  "function osc(x)\nosc(|",
  "const f = (...x = a) => x; f(|",
  "({osc} = other); osc(|",
  "[osc] = other; osc(|",
  "osc++; osc(|",
  "function f(x) {} function outer(f) { f(|",
  "function f(x) {} f = dynamic; f(|",
  "const {osc} = other; osc(|",
  "let [osc] = other; osc(|",
  "const osc = 1; osc(|",
  "class osc {} osc(|",
  "osc = function (x) {}; osc(|",
])("hides ambiguous or unsupported %s", (source) => {
  expect(fixture().lookup(source)).toBeNull();
});

test("duplicate bindings across tabs suppress both custom and native hints", () => {
  const session = fixture({ setup: "function osc(custom) {}", main: "" });
  expect(session.lookup("function osc(other) {} osc(|")).toBeNull();
});

test("nested bindings hide hints within their function while top-level declarations remain visible", () => {
  const session = fixture();
  expect(session.lookup("const f = function f(value) {}; f(|").params[0].name).toBe("value");
  expect(session.lookup("function helper(osc) {} osc(|").params[0].name).toBe("frequency");
  expect(session.lookup("function helper({osc}) { osc(|")).toBeNull();
  expect(session.lookup("function helper() { ({osc} = other); } osc(|")).toBeNull();
});

test("cursor-only transactions reuse both parameter indexes", () => {
  const resolve = createCustomSignatureResolver({
    getCurrentTab: () => "main",
    getTabCode: () => setup,
  });
  const state = EditorState.create({
    doc: "const local = x => x;\nlocal(2);",
    extensions: [javascript()],
  });
  const before = resolve(state);
  const after = resolve(state.update({ selection: { anchor: state.doc.length - 1 } }).state);
  expect(after("local", 25)).toBe(before("local", 25));
  expect(after("clamp", 25)).toBe(before("clamp", 25));
});
