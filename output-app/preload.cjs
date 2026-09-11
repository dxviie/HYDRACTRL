// Runs in the page before HYDRACTRL's own scripts. Hides the editor/panels and
// the startup info panel so only the visuals reach the shared texture. These are
// HYDRACTRL's own localStorage preferences (see src/client/index.js and
// src/client/plugins/InfoPanelPlugin.js). The chrome-less /output route planned
// for phase 1 makes this file unnecessary.
try {
  window.localStorage.setItem("hydractrl-ui-visible", "false");
  window.localStorage.setItem("hydractrl-show-info-on-startup", "false");
} catch (error) {
  console.warn("[output preload] could not set UI preferences", error);
}
