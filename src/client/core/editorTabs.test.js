import { describe, expect, test } from "bun:test";
import { createEditorTabs } from "./editorTabs.js";

const SKETCH = "osc().out()";
const SETUP = "a.setBins(4)";

/** An editor with one document, the tabs over it and what they reported. */
function createTabs() {
  let doc = SKETCH;
  const editor = {
    getCode: () => doc,
    setCode: (code) => {
      doc = code;
    },
  };
  const saved = [];
  const shown = [];
  const tabs = createEditorTabs(editor, {
    main: SKETCH,
    setup: SETUP,
    saveSetup: (code) => saved.push(code),
    onShow: (tab) => shown.push(tab),
  });
  return { editor, tabs, saved, shown };
}

describe("editor tabs", () => {
  test("start on the sketch", () => {
    const { tabs } = createTabs();
    expect(tabs.current()).toBe("main");
    expect(tabs.getAllCode()).toEqual({ setup: SETUP, main: SKETCH });
  });

  test("show the other tab's code and keep what was typed in the one left", () => {
    const { editor, tabs, shown } = createTabs();
    editor.setCode("noise().out()");
    tabs.show("setup");
    expect(editor.getCode()).toBe(SETUP);
    editor.setCode("a.setBins(8)");
    tabs.show("main");
    expect(editor.getCode()).toBe("noise().out()");
    expect(tabs.getAllCode()).toEqual({ setup: "a.setBins(8)", main: "noise().out()" });
    expect(shown).toEqual(["setup", "main"]);
  });

  test("save the setup code when its tab is left, and only then", () => {
    const { editor, tabs, saved } = createTabs();
    tabs.show("setup");
    editor.setCode("a.setBins(8)");
    tabs.getAllCode();
    expect(saved).toEqual([]);
    tabs.show("main");
    expect(saved).toEqual(["a.setBins(8)"]);
  });

  test("ignore the tab already shown and tabs that don't exist", () => {
    const { editor, tabs, shown } = createTabs();
    tabs.show("main");
    tabs.show("toString");
    expect(tabs.current()).toBe("main");
    expect(editor.getCode()).toBe(SKETCH);
    expect(shown).toEqual([]);
  });

  test("read the sketch while the setup tab is open", () => {
    const { editor, tabs } = createTabs();
    tabs.show("setup");
    editor.setCode("a.setBins(8)");
    expect(tabs.getMainCode()).toBe(SKETCH);
    expect(tabs.getTabCode("setup")).toBe("a.setBins(8)");
    expect(tabs.current()).toBe("setup");
  });

  test("a new sketch replaces the sketch on its own tab", () => {
    const { editor, tabs } = createTabs();
    tabs.setMainCode("noise().out()");
    expect(editor.getCode()).toBe("noise().out()");
    expect(tabs.getAllCode()).toEqual({ setup: SETUP, main: "noise().out()" });
  });

  test("a new sketch shows the sketch tab and leaves the setup code alone", () => {
    const { editor, tabs, saved, shown } = createTabs();
    tabs.show("setup");
    editor.setCode("a.setBins(8)");
    tabs.setMainCode("noise().out()");
    expect(tabs.current()).toBe("main");
    expect(editor.getCode()).toBe("noise().out()");
    expect(tabs.getAllCode()).toEqual({ setup: "a.setBins(8)", main: "noise().out()" });
    // What was typed in the setup tab is saved, not the new sketch
    expect(saved).toEqual(["a.setBins(8)"]);
    expect(shown).toEqual(["setup", "main"]);
    tabs.show("setup");
    expect(editor.getCode()).toBe("a.setBins(8)");
  });
});
