/**
 * The editor's two tabs, Sketch ("main") and Setup, over its one document.
 * Setup runs before every sketch and is the performer's own: it stays in
 * this browser and belongs to no slot. So whatever loads or saves a sketch
 * (a slot, the autosave, a shared link) goes through `getMainCode` and
 * `setMainCode`, which reach the sketch whichever tab is open, and never
 * through the document itself, which holds the setup code while that tab
 * is open.
 *
 * @param {{ getCode: () => string, setCode: (code: string) => void }} editor
 * @param {object} [options]
 * @param {string} [options.main] - The sketch to start with (the document's).
 * @param {string} [options.setup] - The setup code to start with.
 * @param {(code: string) => void} [options.saveSetup] - Keeps the setup code,
 *   called when its tab is left.
 * @param {(tab: "main" | "setup") => void} [options.onShow] - Called when
 *   another tab is shown.
 */
export function createEditorTabs(editor, options = {}) {
  const { saveSetup = () => {}, onShow = () => {} } = options;
  const code = { main: options.main || "", setup: options.setup || "" };
  let current = "main";

  // Take what the open tab holds
  function keep() {
    code[current] = editor.getCode();
  }

  function show(tab) {
    if (!Object.hasOwn(code, tab) || tab === current) return;
    keep();
    if (current === "setup") saveSetup(code.setup);
    current = tab;
    editor.setCode(code[tab]);
    onShow(tab);
  }

  function getTabCode(tab) {
    if (tab === current) return editor.getCode();
    return code[tab] || "";
  }

  return {
    show,
    current: () => current,
    getTabCode,
    /** Both tabs' code, `{ setup, main }`: what a run takes. */
    getAllCode: () => {
      keep();
      return { setup: code.setup, main: code.main };
    },
    getMainCode: () => getTabCode("main"),
    /** Replace the sketch and show it; the setup code stays as it is. */
    setMainCode: (value) => {
      show("main");
      code.main = value || "";
      editor.setCode(code.main);
    },
  };
}
