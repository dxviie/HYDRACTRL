import { describe, expect, test } from "bun:test";
import {
  buildEditorSnapshot,
  codeTokens,
  diffLines,
  lineSegments,
  normalizeEditorSnapshot,
  normalizeSlotsState,
  runningSnapshot,
  sameEditorSnapshot,
} from "./editorSnapshot.js";

const RUNNING = "osc(10, 0.1)\n  .kaleid(4)\n  .out()";

describe("diffLines", () => {
  test("nothing for the same code, whatever the whitespace around it", () => {
    expect(diffLines(RUNNING, RUNNING)).toEqual({ changed: [], removed: [] });
    expect(diffLines(RUNNING, `\n\n${RUNNING}\n\n`)).toEqual({ changed: [], removed: [] });
  });

  test("marks edited and added lines", () => {
    const current = "osc(10, 0.1)\n  .kaleid(7)\n  .rotate(0.2)\n  .out()";
    expect(diffLines(RUNNING, current)).toEqual({ changed: [1, 2], removed: [] });
  });

  test("marks edits in two places without the lines in between", () => {
    const running = "a()\nb()\nc()\nd()\ne()";
    const current = "a()\nB()\nc()\nd()\nE()";
    expect(diffLines(running, current).changed).toEqual([1, 4]);
  });

  test("marks where lines were taken out", () => {
    expect(diffLines(RUNNING, "osc(10, 0.1)\n  .out()")).toEqual({ changed: [], removed: [1] });
    expect(diffLines(RUNNING, "osc(10, 0.1)\n  .kaleid(4)")).toEqual({
      changed: [],
      removed: [2],
    });
    expect(diffLines("a()\nb()\nc()\nd()", "a()\nd()")).toEqual({ changed: [], removed: [1] });
  });

  test("counts lines in the editor, blank lines above the code included", () => {
    const current = "\n\nosc(10, 0.1)\n  .kaleid(5)\n  .out()";
    expect(diffLines(RUNNING, current).changed).toEqual([3]);
  });

  test("marks everything new when nothing ran", () => {
    expect(diffLines("", "osc()\n.out()").changed).toEqual([0, 1]);
  });
});

describe("buildEditorSnapshot", () => {
  const running = { setup: "", main: RUNNING };

  test("is clean while the editor holds what runs", () => {
    const snapshot = buildEditorSnapshot({
      tab: "main",
      sketch: { setup: "", main: `${RUNNING}\n` },
      selection: { anchor: 3, head: 3 },
      running,
    });
    expect(snapshot).toEqual({
      tab: "main",
      code: `${RUNNING}\n`,
      anchor: 3,
      head: 3,
      dirty: false,
      changed: [],
      removed: [],
    });
  });

  test("is dirty when either tab differs, with markers for the shown one", () => {
    const editedSetup = buildEditorSnapshot({
      tab: "main",
      sketch: { setup: "a.setBins(4)", main: RUNNING },
      selection: { anchor: 0, head: 0 },
      running,
    });
    expect(editedSetup.dirty).toBe(true);
    expect(editedSetup.changed).toEqual([]);

    const setupTab = buildEditorSnapshot({
      tab: "setup",
      sketch: { setup: "a.setBins(4)", main: RUNNING },
      selection: { anchor: 2, head: 5 },
      running,
    });
    expect(setupTab).toMatchObject({ tab: "setup", code: "a.setBins(4)", changed: [0] });
  });

  test("is dirty without markers before anything ran", () => {
    const snapshot = buildEditorSnapshot({
      tab: "main",
      sketch: { setup: "", main: RUNNING },
      selection: { anchor: 999, head: 999 },
      running: null,
    });
    expect(snapshot).toMatchObject({ dirty: true, changed: [], head: RUNNING.length });
  });
});

describe("lineSegments", () => {
  test("puts the caret where the cursor is", () => {
    expect(lineSegments("osc(10)", 0, { anchor: 4, head: 4 })).toEqual([
      { text: "osc(", selected: false },
      { caret: true },
      { text: "10)", selected: false },
    ]);
    expect(lineSegments("osc(10)", 0, { anchor: 7, head: 7 })).toEqual([
      { text: "osc(10)", selected: false },
      { caret: true },
    ]);
  });

  test("leaves lines without the cursor whole", () => {
    expect(lineSegments(".out()", 8, { anchor: 2, head: 2 })).toEqual([
      { text: ".out()", selected: false },
    ]);
    expect(lineSegments(".out()", 8, { anchor: -1, head: -1 })).toEqual([
      { text: ".out()", selected: false },
    ]);
  });

  test("marks the selected text, with the caret at its moving end", () => {
    // "osc(10)\n.out()", selected from 4 to 10, cursor at 10
    expect(lineSegments("osc(10)", 0, { anchor: 4, head: 10 })).toEqual([
      { text: "osc(", selected: false },
      { text: "10)", selected: true },
    ]);
    expect(lineSegments(".out()", 8, { anchor: 4, head: 10 })).toEqual([
      { text: ".o", selected: true },
      { caret: true },
      { text: "ut()", selected: false },
    ]);
  });

  test("an empty line holds just the caret", () => {
    expect(lineSegments("", 5, { anchor: 5, head: 5 })).toEqual([{ caret: true }]);
    expect(lineSegments("", 5, { anchor: 1, head: 1 })).toEqual([]);
  });

  test("cuts at the tokens and tells their kind, a comment over lines included", () => {
    const code = "/* a\nb */ osc(1)";
    const tokens = codeTokens(code);
    expect(lineSegments("b */ osc(1)", 5, { anchor: 15, head: 15 }, tokens)).toEqual([
      { text: "b */", selected: false, kind: "comment" },
      { text: " osc", selected: false },
      { text: "(", selected: false, kind: "punctuation" },
      { text: "1", selected: false, kind: "number" },
      { caret: true },
      { text: ")", selected: false, kind: "punctuation" },
    ]);
  });
});

describe("codeTokens", () => {
  const kinds = (code) =>
    codeTokens(code).map(({ from, to, kind }) => [code.slice(from, to), kind]);

  test("finds comments, strings, numbers, keywords and punctuation", () => {
    expect(kinds("// spin\nconst n = 0.5 // half")).toEqual([
      ["// spin", "comment"],
      ["const", "keyword"],
      ["=", "punctuation"],
      ["0.5", "number"],
      ["// half", "comment"],
    ]);
    expect(kinds("src(o0).modulate(noise(.5), () => a.fft[0] * -1e2)")).toEqual([
      ["(", "punctuation"],
      [").", "punctuation"],
      ["(", "punctuation"],
      ["(", "punctuation"],
      [".5", "number"],
      ["),", "punctuation"],
      ["()", "punctuation"],
      ["=>", "punctuation"],
      [".", "punctuation"],
      ["[", "punctuation"],
      ["0", "number"],
      ["]", "punctuation"],
      ["*", "punctuation"],
      ["-", "punctuation"],
      ["1e2", "number"],
      [")", "punctuation"],
    ]);
  });

  test("keeps comment marks inside strings, and strings inside comments", () => {
    expect(kinds(`s("a // b", 'c', \`d\`) /* "e" */ true`)).toEqual([
      ["(", "punctuation"],
      ['"a // b"', "string"],
      [",", "punctuation"],
      ["'c'", "string"],
      [",", "punctuation"],
      ["`d`", "string"],
      [")", "punctuation"],
      ['/* "e" */', "comment"],
      ["true", "number"],
    ]);
  });

  test("an unclosed comment or string runs to the end of the code, or of the line", () => {
    expect(kinds("osc() /* off\n.out()")).toEqual([
      ["()", "punctuation"],
      ["/* off\n.out()", "comment"],
    ]);
    expect(kinds('"open\nosc')).toEqual([['"open', "string"]]);
  });
});

describe("network data", () => {
  test("snapshots are made safe to draw", () => {
    expect(
      normalizeEditorSnapshot({
        tab: "evil",
        code: "osc()",
        anchor: 99,
        head: "1",
        dirty: "yes",
        changed: [0, -1, 1.5, "2"],
      }),
    ).toEqual({
      tab: "main",
      code: "osc()",
      anchor: 5,
      head: -1,
      dirty: false,
      changed: [0],
      removed: [],
    });
    expect(normalizeEditorSnapshot(null)).toEqual(runningSnapshot(""));
  });

  test("snapshots compare by value", () => {
    const a = runningSnapshot("osc()");
    expect(sameEditorSnapshot(a, runningSnapshot("osc()"))).toBe(true);
    expect(sameEditorSnapshot(a, { ...a, changed: [0] })).toBe(false);
    expect(sameEditorSnapshot(a, null)).toBe(false);
  });

  test("slot states have four scenes and sixteen slots", () => {
    expect(
      normalizeSlotsState({ scene: 1, slot: 20, scenes: [true, false], slots: [false, true] }),
    ).toEqual({
      scene: 1,
      slot: 0,
      scenes: [true, false, false, false],
      slots: [false, true, ...Array(14).fill(false)],
    });
  });
});
