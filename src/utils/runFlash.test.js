import { describe, expect, test } from "bun:test";
import { EditorState } from "@codemirror/state";
import { FLASH_MS, flashCode, flashDecorations, flashMarks, runFlash } from "./runFlash.js";

/** The [from, to] ranges of a decoration set. */
function ranges(set) {
  const found = [];
  set.between(0, Number.MAX_SAFE_INTEGER, (from, to) => {
    found.push([from, to]);
  });
  return found;
}

/** Just enough of an EditorView: a state that dispatches apply to. */
function fakeView(doc) {
  return {
    state: EditorState.create({ doc, extensions: [runFlash()] }),
    dispatch(spec) {
      this.state = this.state.update(spec).state;
    },
  };
}

describe("flashDecorations", () => {
  test("marks the text of each line and skips empty ones", () => {
    const doc = EditorState.create({ doc: "osc(10)\n\n  .out()" }).doc;
    expect(ranges(flashDecorations(doc))).toEqual([
      [0, 7],
      [9, 17],
    ]);
  });

  test("marks nothing in an empty document", () => {
    expect(ranges(flashDecorations(EditorState.create({ doc: "" }).doc))).toEqual([]);
  });
});

describe("flashCode", () => {
  test("lights the code up, then puts it out after the delay", () => {
    const view = fakeView("noise()\n  .out()");
    let later = null;
    let delay = 0;
    flashCode(view, {
      schedule: (callback, ms) => {
        later = callback;
        delay = ms;
      },
    });
    expect(ranges(flashMarks(view.state))).toEqual([
      [0, 7],
      [8, 16],
    ]);
    expect(delay).toBe(FLASH_MS);
    later();
    expect(ranges(flashMarks(view.state))).toEqual([]);
  });

  test("typing during the flash ends it", () => {
    const view = fakeView("osc()");
    flashCode(view, { schedule: () => {} });
    view.dispatch({ changes: { from: 5, insert: ".out()" } });
    expect(ranges(flashMarks(view.state))).toEqual([]);
  });
});
