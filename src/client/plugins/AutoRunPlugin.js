/**
 * AutoRunPlugin - re-run the sketch shortly after every keystroke.
 *
 * Wires the "Auto Run" checkbox in the editor toolbar, persists the setting,
 * and provides the Ctrl/⌘+Y keyboard toggle. The run itself is debounced so
 * fast typing doesn't hammer the interpreter mid-performance.
 */

const STORAGE_KEY = "hydractrl-auto-run";
const RUN_DELAY_MS = 250;

export function createAutoRunPlugin() {
  return {
    id: "auto-run",
    name: "Auto Run",
    description: "Re-runs the sketch after typing pauses (toggle with Ctrl/⌘+Y)",

    setup(ctx) {
      let enabled = ctx.storage.get(STORAGE_KEY) === "true";
      let runTimer = null;

      const checkbox = document.getElementById("auto-run-checkbox");

      function setEnabled(value) {
        enabled = value;
        if (checkbox) checkbox.checked = enabled;
        ctx.storage.set(STORAGE_KEY, enabled);
        ctx.events.emit("autorun:changed", { enabled });
      }

      function toggle() {
        setEnabled(!enabled);
      }

      const onCheckboxChange = (e) => {
        setEnabled(e.target.checked);
      };

      if (checkbox) {
        checkbox.checked = enabled;
        checkbox.addEventListener("change", onCheckboxChange);
      }

      const onKeyDown = (e) => {
        // Ctrl/⌘+Y toggles auto-run from anywhere
        if ((e.ctrlKey || e.metaKey) && e.key === "y") {
          e.preventDefault();
          toggle();
          ctx.editor.focus();
          return;
        }

        if (enabled) {
          clearTimeout(runTimer);
          runTimer = setTimeout(() => {
            ctx.runCode();
          }, RUN_DELAY_MS);
        }
      };
      window.addEventListener("keydown", onKeyDown);

      return {
        api: { toggle, isEnabled: () => enabled },
        dispose() {
          clearTimeout(runTimer);
          window.removeEventListener("keydown", onKeyDown);
          if (checkbox) checkbox.removeEventListener("change", onCheckboxChange);
        },
      };
    },
  };
}
