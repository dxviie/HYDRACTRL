/**
 * DesktopOutputPlugin - output status and controls inside the desktop app.
 *
 * When the page runs inside the HYDRACTRL desktop app, the preload exposes
 * `window.hydractrlDesktop`. This plugin adds an OUTPUT block to the stats
 * panel showing the Syphon/Spout output state (with live fps), a Start/Stop
 * button and a shortcut to the output settings. In a normal browser there is
 * no bridge and the plugin does nothing.
 */

/** Pure: turn the desktop output status into what the panel shows. */
export function describeOutput(output) {
  if (!output) {
    return { tone: "unavailable", text: "Not available", title: "", action: null };
  }
  if (!output.available) {
    return {
      tone: "unavailable",
      text: "Unavailable",
      title: output.unavailableReason || "",
      action: null,
    };
  }
  const protocol = output.protocol || "Output";
  switch (output.state) {
    case "running": {
      const fps = output.fps === null || output.fps === undefined ? "–" : output.fps;
      return {
        tone: "running",
        text: `${protocol} · ${output.width}×${output.height} · ${fps} fps`,
        title: output.error ? `Last error: ${output.error}` : `${output.name} is live`,
        action: "Stop",
      };
    }
    case "starting":
      return { tone: "starting", text: `Starting ${protocol}…`, title: "", action: null };
    case "error":
      return {
        tone: "error",
        text: `${protocol} error`,
        title: output.error || "",
        action: "Start",
      };
    default:
      return { tone: "stopped", text: `${protocol} output off`, title: "", action: "Start" };
  }
}

const TONE_COLORS = {
  running: "var(--color-perf-good)",
  starting: "#ffc860",
  error: "var(--color-error)",
  stopped: "var(--color-text-secondary)",
  unavailable: "var(--color-text-secondary)",
};

export function createDesktopOutputPlugin(options = {}) {
  return {
    id: "desktop-output",
    name: "Desktop Output",
    description: "Syphon/Spout output status and controls when running in the desktop app",

    setup(ctx) {
      const bridge =
        options.bridge !== undefined
          ? options.bridge
          : typeof window !== "undefined"
            ? window.hydractrlDesktop
            : undefined;
      if (!bridge) return;
      const display = ctx.getPanels().stats?.display;
      if (!display?.section?.parentNode) return;

      const block = document.createElement("div");
      block.className = "desktop-output";
      block.style.marginBottom = "8px";

      const title = document.createElement("div");
      title.style.fontSize = "12px";
      title.style.color = "var(--color-text-secondary)";
      title.style.fontWeight = "bold";
      title.textContent = "OUTPUT";

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.marginTop = "4px";

      const dot = document.createElement("span");
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      dot.style.flex = "none";

      const text = document.createElement("span");
      text.style.fontSize = "10px";
      text.style.flex = "1";
      text.style.whiteSpace = "nowrap";

      const actionButton = document.createElement("button");
      actionButton.style.fontSize = "10px";
      actionButton.style.padding = "2px 6px";

      const settingsButton = document.createElement("button");
      settingsButton.textContent = "⚙";
      settingsButton.title = "Output settings";
      settingsButton.style.fontSize = "10px";
      settingsButton.style.padding = "2px 6px";

      row.append(dot, text, actionButton, settingsButton);
      block.append(title, row);
      display.section.parentNode.insertBefore(block, display.section);

      let lastError = null;
      function render(state) {
        const info = describeOutput(state?.output);
        dot.style.backgroundColor = TONE_COLORS[info.tone];
        text.textContent = info.text;
        text.title = info.title;
        actionButton.textContent = info.action || "…";
        actionButton.disabled = !info.action;
        actionButton.style.opacity = info.action ? "1" : "0.5";
        const error = state?.output?.error || null;
        if (error && error !== lastError && state.output.state === "error") {
          ctx.notify(`Output: ${error}`, { type: "error" });
        }
        lastError = error;
      }

      const onAction = () => {
        bridge
          .toggleOutput()
          .catch((error) => ctx.notify(`Output: ${error.message}`, { type: "error" }));
      };
      const onSettings = () => {
        bridge.openSettings().catch(() => {});
      };
      actionButton.addEventListener("click", onAction);
      settingsButton.addEventListener("click", onSettings);

      const unsubscribe = bridge.onState(render);
      bridge
        .getState()
        .then(render)
        .catch((error) => console.warn("[desktop-output] could not read state:", error));

      return {
        api: { render },
        dispose() {
          unsubscribe();
          actionButton.removeEventListener("click", onAction);
          settingsButton.removeEventListener("click", onSettings);
          block.remove();
        },
      };
    },
  };
}
