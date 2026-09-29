import { describe, expect, test } from "bun:test";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { insertLines, statementBoundary } from "./editorInsert.js";

const LINE = 's0.initImage("/media/a.png");';

/** Insert `lines` where the "|" in `marked` is, and return the new document. */
function dropAt(marked, lines = [LINE]) {
  const state = EditorState.create({ doc: marked.replace("|", ""), extensions: [javascript()] });
  return state.update(insertLines(state, marked.indexOf("|"), lines)).state.doc.toString();
}

describe("insertLines", () => {
  test("fills an empty sketch", () => {
    expect(dropAt("|")).toBe(LINE);
    expect(dropAt("|", [LINE, "", "src(s0).out()"])).toBe(`${LINE}\n\nsrc(s0).out()`);
  });

  test("goes above a chain it was dropped on, never inside it", () => {
    expect(dropAt("osc(10)\n  .rot|ate(0.5)\n  .out()")).toBe(
      `${LINE}\nosc(10)\n  .rotate(0.5)\n  .out()`,
    );
    expect(dropAt("noise()\n  .out()\nosc(10)\n  |.out()")).toBe(
      `noise()\n  .out()\n${LINE}\nosc(10)\n  .out()`,
    );
    expect(dropAt("update = () => {\n  a|++\n}")).toBe(`${LINE}\nupdate = () => {\n  a++\n}`);
  });

  test("goes after the line it was dropped at the end of", () => {
    expect(dropAt("osc().out()|\nnoise().out()")).toBe(`osc().out()\n${LINE}\nnoise().out()`);
    expect(dropAt("osc().out()\n|")).toBe(`osc().out()\n${LINE}`);
    expect(dropAt("osc().out()|")).toBe(`osc().out()\n${LINE}`);
  });

  test("takes an empty line between statements", () => {
    expect(dropAt("osc().out()\n|\nnoise().out()")).toBe(`osc().out()\n${LINE}\n\nnoise().out()`);
  });

  test("keeps clear of comments", () => {
    expect(dropAt("osc().out() // bright|\nnoise().out()")).toBe(
      `osc().out() // bright\n${LINE}\nnoise().out()`,
    );
    expect(dropAt("// Ti|de\nosc().out()")).toBe(`${LINE}\n// Tide\nosc().out()`);
    expect(dropAt("// Tide|\nosc().out()")).toBe(`// Tide\n${LINE}\nosc().out()`);
    expect(dropAt("/* one\n tw|o */\nosc().out()")).toBe(`${LINE}\n/* one\n two */\nosc().out()`);
  });

  test("starts a line of its own after a statement that shares a line", () => {
    expect(dropAt("a(); b|()")).toBe(`a(); \n${LINE}\nb()`);
  });

  test("puts the cursor after the new lines", () => {
    const state = EditorState.create({ doc: "osc().out()", extensions: [javascript()] });
    const spec = insertLines(state, 0, [LINE, "x"]);
    expect(spec.selection.anchor).toBe(`${LINE}\nx`.length);
    expect(spec.userEvent).toBe("input.drop");
  });
});

test("statementBoundary clamps positions outside the document", () => {
  const state = EditorState.create({ doc: "osc().out()", extensions: [javascript()] });
  expect(statementBoundary(state, -5)).toBe(0);
  expect(statementBoundary(state, 999)).toBe(11);
});
