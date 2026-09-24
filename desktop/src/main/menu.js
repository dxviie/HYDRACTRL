/**
 * Application menu template. Pure: takes the current state and a bag of
 * actions, returns a template for Menu.buildFromTemplate. Rebuilt whenever
 * the output state or settings change so checkmarks always tell the truth.
 */
import { FRAME_RATES, RESOLUTION_PRESETS, presetLabel } from "./settings.js";

export const LINKS = Object.freeze({
  website: "https://dxviie.github.io/HYDRACTRL/",
  hydraDocs: "https://hydra.ojack.xyz/docs/",
  issues: "https://github.com/dxviie/HYDRACTRL/issues",
  desktopReadme: "https://github.com/dxviie/HYDRACTRL/blob/main/desktop/README.md",
});

/** Label for the start/stop item, from the output status. */
export function outputToggleLabel(output) {
  if (!output.available) return "Output Unavailable";
  if (output.state === "running") return "Stop Output";
  if (output.state === "starting") return "Starting Output…";
  return "Start Output";
}

export function buildMenuTemplate({ platform, appName, state, actions }) {
  const isMac = platform === "darwin";
  const { output, settings } = state;
  const canToggle = output.available && output.state !== "starting";
  const currentPreset = presetLabel(settings.output.width, settings.output.height);

  const resolutionItems = RESOLUTION_PRESETS.map((preset) => ({
    label: `${preset.label}  ${preset.width}×${preset.height}`,
    type: "radio",
    checked: currentPreset === preset.label,
    click: () => actions.setResolution(preset.width, preset.height),
  }));
  resolutionItems.push(
    { type: "separator" },
    {
      label:
        currentPreset === "Custom"
          ? `Custom  ${settings.output.width}×${settings.output.height}…`
          : "Custom…",
      type: "radio",
      checked: currentPreset === "Custom",
      click: () => actions.openSettings("resolution"),
    },
  );

  const frameRateItems = FRAME_RATES.map((rate) => ({
    label: `${rate} fps`,
    type: "radio",
    checked: settings.output.frameRate === rate,
    click: () => actions.setFrameRate(rate),
  }));
  if (!FRAME_RATES.includes(settings.output.frameRate)) {
    frameRateItems.push({
      label: `${settings.output.frameRate} fps (custom)`,
      type: "radio",
      checked: true,
      click: () => actions.openSettings("frameRate"),
    });
  }

  const outputMenu = {
    label: "Output",
    submenu: [
      {
        label: outputToggleLabel(output),
        accelerator: "CmdOrCtrl+Shift+O",
        enabled: canToggle,
        click: () => actions.toggleOutput(),
      },
      {
        label: "Restart Output",
        enabled: output.state === "running",
        click: () => actions.restartOutput(),
      },
      { type: "separator" },
      { label: "Resolution", submenu: resolutionItems },
      { label: "Frame Rate", submenu: frameRateItems },
      { type: "separator" },
      {
        label: "Show Preview Window",
        type: "checkbox",
        checked: settings.output.preview,
        click: (item) => actions.setPreview(item.checked),
      },
      {
        label: "Include Alpha Channel",
        type: "checkbox",
        checked: settings.output.includeAlpha,
        click: (item) => actions.setIncludeAlpha(item.checked),
      },
      {
        label: "Start Output When App Launches",
        type: "checkbox",
        checked: settings.output.autoStart,
        click: (item) => actions.setAutoStart(item.checked),
      },
      { type: "separator" },
      {
        label: "Output Settings…",
        accelerator: "CmdOrCtrl+,",
        click: () => actions.openSettings(),
      },
    ],
  };

  const fileMenu = {
    label: "File",
    submenu: [
      {
        label: "Open Output Page in Browser",
        enabled: Boolean(state.server.url),
        click: () => actions.openOutputPage(),
      },
      {
        label: "Copy Server Address",
        enabled: Boolean(state.server.url),
        click: () => actions.copyServerUrl(),
      },
      { type: "separator" },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  };

  const editMenu = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  };

  const viewMenu = {
    label: "View",
    submenu: [
      {
        label: "Reload Interface",
        accelerator: "CmdOrCtrl+Shift+R",
        click: () => actions.reloadUi(),
      },
      {
        label: "Toggle Developer Tools",
        accelerator: isMac ? "Alt+Cmd+I" : "F12",
        click: () => actions.toggleDevTools(),
      },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  };

  const windowMenu = {
    label: "Window",
    submenu: isMac
      ? [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }]
      : [{ role: "minimize" }, { role: "close" }],
  };

  const helpMenu = {
    label: "Help",
    role: "help",
    submenu: [
      { label: "Desktop App Guide", click: () => actions.openExternal(LINKS.desktopReadme) },
      { label: "Hydra Documentation", click: () => actions.openExternal(LINKS.hydraDocs) },
      { label: "HYDRACTRL Website", click: () => actions.openExternal(LINKS.website) },
      { label: "Report an Issue", click: () => actions.openExternal(LINKS.issues) },
      { type: "separator" },
      { label: "Show Logs", click: () => actions.openLogs() },
      ...(isMac
        ? []
        : [{ type: "separator" }, { label: `About ${appName}`, click: () => actions.showAbout() }]),
    ],
  };

  const template = [];
  if (isMac) {
    template.push({
      label: appName,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings…",
          accelerator: "Cmd+,",
          click: () => actions.openSettings(),
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
    // Cmd+, belongs to the app menu on macOS; keep a single binding
    outputMenu.submenu[outputMenu.submenu.length - 1].accelerator = undefined;
  }
  template.push(fileMenu, editMenu, viewMenu, outputMenu, windowMenu, helpMenu);
  return template;
}
