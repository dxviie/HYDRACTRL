/**
 * The hero's code panel: the source of the sketch behind the landing page,
 * set the way hydra's own editor sets it (each line on a dark highlight over
 * the visuals), typing itself in when the sketch changes, and editable.
 *
 * The visible code is a highlighted <pre>; a transparent <textarea> with the
 * same font metrics and wrapping lies on top of it and takes the keyboard.
 * Line numbers live inside each line's highlight and the lines hang their
 * wrapped continuations, so both layers break lines at the same places.
 */

/** How long a whole sketch takes to type itself in. */
export const TYPE_MS = 2000;

/** Comments, strings (also unterminated ones, mid-typing) and numbers. */
const TOKENS =
  /(\/\/.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d+(?:\.\d+)?\b|\.\d+\b)/g;

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

export function escapeHtml(text) {
  return text.replace(/[&<>]/g, (char) => ESCAPES[char]);
}

/** One line of hydra code as HTML: comments, strings and numbers marked up. */
export function highlight(line) {
  let html = "";
  let at = 0;
  for (const match of line.matchAll(TOKENS)) {
    html += escapeHtml(line.slice(at, match.index));
    const kind = match[1] ? "tc" : match[2] ? "ts" : "tn";
    html += `<span class="${kind}">${escapeHtml(match[0])}</span>`;
    at = match.index + match[0].length;
  }
  return html + escapeHtml(line.slice(at));
}

/** The line number gutter: right-aligned, always four cells wide. */
function gutter(index) {
  return `<span class="cn" aria-hidden="true">${String(index + 1).padStart(2, " ")}  </span>`;
}

/**
 * The code as the panel's lines. With `typed`, only that many characters
 * show, followed by the cursor; the rest keeps its place but stays invisible,
 * so the panel doesn't grow while the code types itself in. `cursor` puts
 * the resting cursor after the last character.
 */
export function renderLines(code, { typed = Number.POSITIVE_INFINITY, cursor = false } = {}) {
  const lines = code.split("\n");
  const end = Math.min(typed, code.length);
  const showCursor = cursor || typed < code.length;
  const caret = `<span class="cur${typed >= code.length ? " is-idle" : ""}"></span>`;
  let offset = 0;
  return lines
    .map((line, index) => {
      const start = offset;
      offset += line.length + 1;
      if (end < start) {
        return `<span class="cl is-hidden">${gutter(index)}${escapeHtml(line)}</span>`;
      }
      const shown = Math.min(line.length, end - start);
      // The cursor sits where typing stopped, which is in this line if it hasn't passed it
      const here = showCursor && end <= start + line.length;
      const box = `${gutter(index)}${highlight(line.slice(0, shown))}${here ? caret : ""}`;
      const rest = line.slice(shown);
      return `<span class="cl"><span class="cb">${box}</span>${
        rest ? `<span class="rest">${escapeHtml(rest)}</span>` : ""
      }</span>`;
    })
    .join("");
}

/** How many characters of `total` have typed themselves in after `elapsed` ms. */
export function typedLength(total, elapsed, duration = TYPE_MS) {
  if (elapsed >= duration) return total;
  return Math.max(0, Math.floor((total * elapsed) / duration));
}

/** "tide.js" for the sketch called Tide. */
export function fileName(sketch) {
  return `${sketch.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.js`;
}

/** An error the way hydra's editor reports it: one comment line. */
export function errorLine(error) {
  const name = error?.name && error.name !== "Error" ? `${error.name}: ` : "";
  const message = String(error?.message ?? error ?? "something went wrong")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  const text = `${name}${message || "something went wrong"}`;
  return `// ${text.length > 140 ? `${text.slice(0, 139)}…` : text}`;
}

const isRunKey = (event) => event.key === "Enter" && (event.ctrlKey || event.metaKey);

/**
 * Binds the panel's markup. `onHold` fires when the visitor focuses or
 * first changes the code, `onRelease` when they leave it untouched,
 * `onRun(code)` returns `{ ok }` or `{ ok: false, error }` and `onReset`
 * gives the backdrop back to the rotation.
 */
export function createCodePanel({
  root,
  code,
  name,
  label,
  motion = () => true,
  onHold = () => {},
  onRelease = () => {},
  onRun = () => ({ ok: true }),
  onReset = () => {},
  onChange = () => {},
}) {
  const view = root.querySelector("[data-code-view]");
  const body = root.querySelector("[data-code-body]");
  const file = root.querySelector("[data-code-file]");
  const readOnly = root.querySelector("[data-code-ro]");
  const dirtyMark = root.querySelector("[data-code-dirty]");
  const runButton = root.querySelector("[data-code-run]");
  const message = root.querySelector("[data-code-msg]");
  const note = root.querySelector("[data-code-note]");
  const resetButton = root.querySelector("[data-code-reset]");

  let source = code;
  file.textContent = name;
  let ran = null;
  let input = null;
  let typing = 0;
  /** idle: the sketch's own code · edited · running: the visitor's code plays · error */
  let state = "idle";

  function paint(code, options) {
    view.innerHTML = renderLines(code, options);
  }

  function say(text, tone = "") {
    message.hidden = !text;
    message.dataset.tone = tone;
    note.textContent = text;
    note.title = text;
  }

  function stopTyping() {
    if (!typing) return;
    cancelAnimationFrame(typing);
    typing = 0;
  }

  function type(code) {
    stopTyping();
    if (!motion() || !input) {
      paint(code, { cursor: Boolean(input) });
      return;
    }
    let started = 0;
    const step = (now) => {
      started ||= now;
      const typed = typedLength(code.length, now - started);
      paint(code, { typed, cursor: true });
      typing = typed < code.length ? requestAnimationFrame(step) : 0;
    };
    paint(code, { typed: 0, cursor: true });
    typing = requestAnimationFrame(step);
  }

  function setState(next) {
    state = next;
    root.dataset.state = next;
    const changed = Boolean(input) && input.value !== (ran ?? source);
    dirtyMark.hidden = !changed;
    resetButton.hidden = next === "idle";
    onChange({ state, code: input ? input.value : source, playing: ran !== null });
  }

  function run() {
    if (!input) return;
    stopTyping();
    const code = input.value;
    const result = onRun(code);
    if (result.ok) {
      ran = code;
      say("// running your code", "ok");
      setState("running");
      flash();
    } else {
      say(errorLine(result.error), "error");
      setState("error");
    }
  }

  function flash() {
    if (!motion()) return;
    view.classList.add("is-run");
    setTimeout(() => view.classList.remove("is-run"), 120);
  }

  function reset() {
    if (!input || state === "idle") return;
    input.value = source;
    ran = null;
    paint(source, { cursor: true });
    say("");
    setState("idle");
    onReset();
    // Still in the editor (Esc): keep the sketch it shows
    if (document.activeElement === input) onHold();
  }

  function enable() {
    if (input) return;
    input = document.createElement("textarea");
    input.className = "code-input";
    input.value = source;
    input.spellcheck = false;
    input.rows = 1;
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("aria-label", label);
    input.addEventListener("focus", () => {
      // No new sketch replaces the code while the visitor is in it
      if (state === "idle") onHold();
      // Clicking in mid-typing: the code is all there
      if (typing) {
        stopTyping();
        paint(input.value, { cursor: true });
      }
    });
    input.addEventListener("blur", () => {
      if (state === "idle") onRelease();
    });
    input.addEventListener("input", () => {
      stopTyping();
      paint(input.value, { cursor: true });
      if (state === "idle") onHold();
      if (state !== "error") say("// edited, not running yet");
      setState(state === "running" || state === "error" ? state : "edited");
    });
    input.addEventListener("keydown", (event) => {
      if (isRunKey(event)) {
        event.preventDefault();
        run();
      } else if (event.key === "Escape" && state !== "idle") {
        event.preventDefault();
        reset();
      }
    });
    // The textarea never scrolls: the panel grows with the code instead
    input.addEventListener("scroll", () => {
      input.scrollTop = 0;
      input.scrollLeft = 0;
    });
    body.append(input);
    view.setAttribute("aria-hidden", "true");
    readOnly.hidden = true;
    runButton.hidden = false;
    runButton.addEventListener("click", run);
    resetButton.addEventListener("click", reset);
    paint(source, { cursor: true });
    setState("idle");
  }

  return {
    enable,
    /** A new sketch is playing: show its code, unless the visitor's edit is there. */
    load(next, nextName) {
      if (state !== "idle") return false;
      source = next;
      file.textContent = nextName;
      if (input) input.value = next;
      type(next);
      setState("idle");
      return true;
    },
    /** The visitor's program broke while it played; the sketch is back. */
    fail(error) {
      ran = null;
      say(errorLine(error), "error");
      setState("error");
    },
    /** No hydra here: the code stays, read-only, with a note why. */
    disable(text) {
      stopTyping();
      input?.remove();
      input = null;
      view.removeAttribute("aria-hidden");
      readOnly.hidden = false;
      runButton.hidden = true;
      resetButton.hidden = true;
      paint(source);
      say(text, "note");
    },
    get code() {
      return input ? input.value : source;
    },
  };
}
