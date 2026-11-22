import { expect, test } from "bun:test";
import { EditorState, Facet } from "@codemirror/state";
import { createPluginHost } from "../client/core/PluginHost.js";
import { createEditorExtensions } from "./editorExtensions.js";

const values = Facet.define();

function editorFixture() {
  const editor = createEditorExtensions((spec) => {
    state = state.update(spec).state;
  });
  let state = EditorState.create({
    doc: "osc()",
    extensions: [values.of("base"), editor.extension],
  });
  return { editor, state: () => state };
}

test.each([false, true])(
  "extension disposal preserves the base and other extensions (reverse=%s)",
  (reverse) => {
    const { editor, state } = editorFixture();
    const first = editor.addExtension(values.of("first"));
    const second = editor.addExtension(values.of("second"));
    expect(state().facet(values)).toEqual(["base", "first", "second"]);
    const [dispose, remaining] = reverse ? [second, first] : [first, second];
    dispose();
    dispose();
    expect(state().facet(values)).toEqual(["base", reverse ? "first" : "second"]);
    remaining();
    expect(state().facet(values)).toEqual(["base"]);
    expect(state().doc.toString()).toBe("osc()");
  },
);

test("a failed registration is removed before the next configuration", () => {
  const { editor, state } = editorFixture();
  editor.addExtension(values.of("first"));
  expect(() => editor.addExtension({ invalid: true })).toThrow();
  expect(state().facet(values)).toEqual(["base", "first"]);
  const dispose = editor.addExtension(values.of("second"));
  expect(state().facet(values)).toEqual(["base", "first", "second"]);
  dispose();
  expect(state().facet(values)).toEqual(["base", "first"]);
});

test("host unregister and re-register cleanly reinstall the same extension", () => {
  const { editor, state } = editorFixture();
  const host = createPluginHost({ editor });
  const extension = values.of("plugin");
  const plugin = { id: "probe", setup: ({ editor }) => editor.addExtension(extension) };
  host.init();
  for (let count = 0; count < 2; count++) {
    expect(host.register(plugin)).toBe(true);
    expect(state().facet(values)).toEqual(["base", "plugin"]);
    expect(host.unregister(plugin.id)).toBe(true);
    expect(state().facet(values)).toEqual(["base"]);
  }
});

test("two registrations of the same extension have independent lifetimes", () => {
  const { editor, state } = editorFixture();
  const shared = values.of("shared");
  const first = editor.addExtension(shared);
  const second = editor.addExtension(shared);
  expect(state().facet(values)).toEqual(["base", "shared"]);
  first();
  expect(state().facet(values)).toEqual(["base", "shared"]);
  second();
  expect(state().facet(values)).toEqual(["base"]);
});
