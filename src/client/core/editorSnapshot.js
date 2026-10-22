/**
 * What the code overlay shows of the editor, as plain data: the code of the
 * tab being edited, the cursor, and how it differs from the sketch that is
 * running. The interface takes a snapshot a few times a second while you type
 * (plugins/CodeOverlayPlugin.js) and sends it to every output (`editor` in
 * src/server/outputHub.ts), which draw it with core/codeOverlay.js. The
 * scenes and slots indicator's state is plain data too (`slots`).
 */

export const TABS = Object.freeze(["main", "setup"]);

/** Diffs bigger than this many line pairs mark every line in between as changed. */
const MAX_DIFF_CELLS = 250_000;

/** Whether two codes run the same: a run trims the code first. */
export function sameRunningCode(a, b) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function countLines(text) {
  let lines = 0;
  for (const char of text) if (char === "\n") lines += 1;
  return lines;
}

/**
 * The lines of `current` that differ from `running`, by line index in
 * `current`: `changed` lines are new or edited, and `removed` says where lines
 * of `running` are gone (before line i, or after the last line when i is the
 * line count) without anything in their place. Like a run, it ignores the
 * whitespace around the code.
 */
export function diffLines(running, current) {
  const code = String(current ?? "");
  const trimmed = code.trim();
  const offset = countLines(code.slice(0, code.length - code.trimStart().length));
  const a = String(running ?? "")
    .trim()
    .split("\n");
  const b = trimmed.split("\n");

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const changed = [];
  const removed = [];
  const n = endA - start;
  const m = endB - start;
  if (n === 0 && m === 0) return { changed, removed };
  const lineAt = (index) => start + index + offset;

  if (n * m > MAX_DIFF_CELLS || n === 0 || m === 0) {
    for (let j = 0; j < m; j++) changed.push(lineAt(j));
    if (m === 0) removed.push(lineAt(0));
    return { changed, removed };
  }

  // Longest common subsequence of the lines in between, from the end
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[start + i] === b[start + j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  // Walk it: a stretch that only lost lines gets a removed mark
  let i = 0;
  let j = 0;
  let lost = 0;
  let added = 0;
  const closeStretch = () => {
    if (lost > 0 && added === 0) removed.push(lineAt(j));
    lost = 0;
    added = 0;
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[start + i] === b[start + j]) {
      closeStretch();
      i++;
      j++;
    } else if (j < m && (i >= n || table[i * width + j + 1] >= table[(i + 1) * width + j])) {
      changed.push(lineAt(j));
      added++;
      j++;
    } else {
      lost++;
      i++;
    }
  }
  closeStretch();
  return { changed, removed };
}

/**
 * A snapshot of the editor for the overlay. `sketch` is the editor's code,
 * `{ setup, main }`, `tab` the one being edited, `selection` its cursor
 * (`{ anchor, head }`, offsets into that tab's code), and `running` the
 * sketch that ran last, or null.
 */
export function buildEditorSnapshot({ tab, sketch, selection, running }) {
  const shownTab = tab === "setup" ? "setup" : "main";
  const code = String(sketch?.[shownTab] ?? "");
  const dirty =
    !running ||
    !sameRunningCode(sketch?.main, running.main) ||
    !sameRunningCode(sketch?.setup, running.setup);
  const diff =
    running && !sameRunningCode(code, running[shownTab])
      ? diffLines(running[shownTab], code)
      : { changed: [], removed: [] };
  return {
    tab: shownTab,
    code,
    anchor: clampOffset(selection?.anchor, code.length),
    head: clampOffset(selection?.head, code.length),
    dirty,
    changed: diff.changed,
    removed: diff.removed,
  };
}

/** What an output shows before the interface sent it anything: the code it runs. */
export function runningSnapshot(code) {
  return {
    tab: "main",
    code: String(code ?? ""),
    anchor: -1,
    head: -1,
    dirty: false,
    changed: [],
    removed: [],
  };
}

function clampOffset(value, length) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return -1;
  return Math.min(Math.round(value), length);
}

function lineIndexes(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((index) => Number.isInteger(index) && index >= 0);
}

/** A snapshot from the network, made safe to draw. */
export function normalizeEditorSnapshot(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const code = typeof value.code === "string" ? value.code : "";
  return {
    tab: value.tab === "setup" ? "setup" : "main",
    code,
    anchor: clampOffset(value.anchor, code.length),
    head: clampOffset(value.head, code.length),
    dirty: value.dirty === true,
    changed: lineIndexes(value.changed),
    removed: lineIndexes(value.removed),
  };
}

export function sameEditorSnapshot(a, b) {
  if (!a || !b) return a === b;
  return (
    a.tab === b.tab &&
    a.code === b.code &&
    a.anchor === b.anchor &&
    a.head === b.head &&
    a.dirty === b.dirty &&
    a.changed.join() === b.changed.join() &&
    a.removed.join() === b.removed.join()
  );
}

/**
 * The scenes and slots for the indicator: the active scene and slot, which
 * scenes hold saved sketches, and which slots of the active scene do.
 */
export function normalizeSlotsState(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const flags = (list, length) =>
    Array.from({ length }, (_, index) => Array.isArray(list) && list[index] === true);
  const index = (number, length) =>
    Number.isInteger(number) && number >= 0 && number < length ? number : 0;
  return {
    scene: index(value.scene, 4),
    slot: index(value.slot, 16),
    scenes: flags(value.scenes, 4),
    slots: flags(value.slots, 16),
  };
}

/**
 * How to draw one line of a snapshot that starts at offset `from` of its
 * code: its text cut where the selection starts and ends, each piece marked
 * selected or not, with `{ caret: true }` where the cursor is.
 */
export function lineSegments(text, from, { anchor, head }) {
  const to = from + text.length;
  const hasCursor = head >= 0;
  const selFrom = hasCursor && anchor >= 0 ? Math.min(anchor, head) : -1;
  const selTo = hasCursor && anchor >= 0 ? Math.max(anchor, head) : -1;
  const cuts = new Set([0, text.length]);
  for (const point of [selFrom, selTo]) {
    if (point > from && point < to) cuts.add(point - from);
  }
  const caretAt = hasCursor && head >= from && head <= to ? head - from : -1;
  if (caretAt >= 0) cuts.add(caretAt);
  const points = [...cuts].sort((x, y) => x - y);

  const segments = [];
  for (let k = 0; k < points.length; k++) {
    const at = points[k];
    if (at === caretAt) segments.push({ caret: true });
    const next = points[k + 1];
    if (next === undefined || next === at) continue;
    const selected = selFrom < selTo && from + at >= selFrom && from + next <= selTo;
    segments.push({ text: text.slice(at, next), selected });
  }
  return segments;
}
