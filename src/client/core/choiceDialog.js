/**
 * showChoiceDialog - ask the user to pick one of a few choices, in the page.
 *
 * Replaces window.prompt(), which the desktop app (Electron) doesn't support:
 * there it throws instead of asking. A button per choice, then Cancel; Escape
 * or a click beside the dialog cancels too. Styled in styles.css
 * (.choice-dialog), so it follows the theme, and it works by touch.
 */

let dialogCount = 0;

/**
 * @param {object} options
 * @param {string} options.title
 * @param {{ value: string, label: string, detail?: string, danger?: boolean }[]} options.choices
 * @param {string} [options.cancelLabel]
 * @param {Document} [options.doc]
 * @returns {Promise<string|null>} The value of the choice picked, or null for none.
 */
export function showChoiceDialog({ title, choices, cancelLabel = "Cancel", doc = document }) {
  return new Promise((resolve) => {
    const create = (tag, className, text) => {
      const element = doc.createElement(tag);
      element.className = className;
      if (text) element.textContent = text;
      return element;
    };

    const backdrop = create("div", "choice-dialog-backdrop");
    const dialog = create("div", "choice-dialog");
    const heading = create("div", "choice-dialog-title", title);
    dialogCount += 1;
    heading.id = `choice-dialog-title-${dialogCount}`;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", heading.id);
    dialog.append(heading);

    const previousFocus = doc.activeElement;
    function close(value) {
      doc.removeEventListener("keydown", onKeyDown, true);
      backdrop.remove();
      previousFocus?.focus?.();
      resolve(value);
    }
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close(null);
    }

    for (const choice of choices) {
      const button = create("button", "choice-dialog-option");
      if (choice.danger) button.classList.add("choice-dialog-danger");
      button.type = "button";
      button.append(create("span", "choice-dialog-label", choice.label));
      if (choice.detail) button.append(create("span", "choice-dialog-detail", choice.detail));
      button.addEventListener("click", () => close(choice.value));
      dialog.append(button);
    }
    const cancel = create("button", "choice-dialog-cancel", cancelLabel);
    cancel.type = "button";
    cancel.addEventListener("click", () => close(null));
    dialog.append(cancel);

    // A click, not a pointerdown: the click must not land on what's under it
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(null);
    });
    doc.addEventListener("keydown", onKeyDown, true);
    backdrop.append(dialog);
    doc.body.append(backdrop);
    cancel.focus();
  });
}
