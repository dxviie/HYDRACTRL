/**
 * MobileUiPlugin - the touch-device experience.
 *
 * On mobile/tablet the editor is unusable, so this plugin hides it and adds:
 *  - a read-only code overlay showing the current sketch (updated by the
 *    slots panel through the `window.codeOverlay` global);
 *  - a floating dice button that loads random scenes.
 *
 * Does nothing on desktop.
 */

export function createMobileUiPlugin() {
  return {
    id: "mobile-ui",
    name: "Mobile UI",
    description: "Code overlay and random-scenes dice button for touch devices",

    setup(ctx) {
      if (!ctx.isMobile) return;

      // --- Read-only code overlay -------------------------------------
      const overlay = document.createElement("div");
      overlay.className = "code-overlay";
      overlay.id = "code-overlay";

      const textarea = document.createElement("textarea");
      textarea.readOnly = true;
      textarea.value = ctx.editor.state.doc.toString();

      overlay.appendChild(textarea);
      document.body.appendChild(overlay);

      const updateOverlay = (code) => {
        textarea.value = code || "";
      };

      const toggleOverlay = (visible) => {
        overlay.classList.toggle("visible", visible);
      };

      // The slots panel pushes loaded scene code through this global
      window.codeOverlay = {
        update: updateOverlay,
        toggle: toggleOverlay,
        element: overlay,
      };

      // --- Floating dice button ---------------------------------------
      const diceButton = document.createElement("div");
      diceButton.className = "mobile-top-dice-button";
      diceButton.innerHTML = "🎲";
      diceButton.style.position = "fixed";
      diceButton.style.top = "20px";
      diceButton.style.left = "20px";
      diceButton.style.width = "50px";
      diceButton.style.height = "50px";
      diceButton.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), 0.9)";
      diceButton.style.borderRadius = "50%";
      diceButton.style.display = "flex";
      diceButton.style.alignItems = "center";
      diceButton.style.justifyContent = "center";
      diceButton.style.fontSize = "24px";
      diceButton.style.cursor = "pointer";
      diceButton.style.zIndex = "1001";
      diceButton.style.boxShadow = "0 4px 15px var(--color-panel-shadow)";
      diceButton.style.transition = "all 0.2s ease";
      diceButton.title = "Load random scenes";

      diceButton.addEventListener("mouseover", () => {
        diceButton.style.transform = "scale(1.1)";
        diceButton.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), 1)";
      });

      diceButton.addEventListener("mouseout", () => {
        diceButton.style.transform = "scale(1)";
        diceButton.style.backgroundColor = "rgba(var(--color-bg-secondary-rgb), 0.9)";
      });

      diceButton.addEventListener("click", () => {
        const slots = ctx.getPanels().slots;
        if (slots && slots.loadRandomScenes) {
          slots.loadRandomScenes();
        }
      });

      document.body.appendChild(diceButton);

      // --- Hide the desktop editor ------------------------------------
      const editorContainer = document.getElementById("editor-container");
      const previousEditorDisplay = editorContainer ? editorContainer.style.display : "";
      if (editorContainer) {
        editorContainer.style.display = "none";
      }

      return {
        api: { updateOverlay, toggleOverlay },
        dispose() {
          overlay.remove();
          diceButton.remove();
          if (editorContainer) {
            editorContainer.style.display = previousEditorDisplay;
          }
          if (window.codeOverlay && window.codeOverlay.element === overlay) {
            window.codeOverlay = undefined;
          }
        },
      };
    },
  };
}
