/**
 * The run flash: when a sketch runs, its code lights up for a moment in the
 * interface theme's flash colour (--color-flash in styles.css), the way
 * hydra's own editor, and the code panel on the landing page, answer an
 * evaluation. Each line's text is marked, not the whole line, so the colour
 * sits behind the code like a highlighter.
 */
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

/** How long the code stays lit. */
export const FLASH_MS = 150;

export const FLASH_CLASS = "cm-run-flash";

const setFlash = StateEffect.define();
const flashMark = Decoration.mark({ class: FLASH_CLASS });

/** Marks over the text of every line that has any. */
export function flashDecorations(doc) {
  const ranges = [];
  for (let number = 1; number <= doc.lines; number++) {
    const line = doc.line(number);
    if (line.length > 0) ranges.push(flashMark.range(line.from, line.to));
  }
  return Decoration.set(ranges);
}

const flashField = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setFlash)) {
        return effect.value ? flashDecorations(transaction.state.doc) : Decoration.none;
      }
    }
    // Typing during the flash ends it rather than marking the new text
    return transaction.docChanged ? Decoration.none : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** The editor extension that draws the flash. */
export function runFlash() {
  return flashField;
}

/** The flash marks currently in an editor state (for tests). */
export function flashMarks(state) {
  return state.field(flashField, false) ?? Decoration.none;
}

/** Light up the view's code, and put it out again after `duration` ms. */
export function flashCode(view, { duration = FLASH_MS, schedule = setTimeout } = {}) {
  view.dispatch({ effects: setFlash.of(true) });
  schedule(() => view.dispatch({ effects: setFlash.of(false) }), duration);
}
