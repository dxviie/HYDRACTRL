/**
 * What Ctrl/⌘+` does. With the UI shown it hides it. With the UI hidden, the
 * first press takes the extra step a plugin added (the code overlay plugin
 * shows or hides the code over the visuals), and the next one brings the UI
 * back. Without a step it is a plain show/hide toggle.
 *
 * Hiding or showing the UI never changes anything but the UI, so what an
 * output shows only changes on the press that is about it.
 *
 * @returns {"hide" | "step" | "show"}
 */
export function nextUiAction({ visible, hasStep, stepTaken }) {
  if (visible) return "hide";
  if (hasStep && !stepTaken) return "step";
  return "show";
}
