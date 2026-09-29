/**
 * Inserting whole lines of code where they can't split a statement: the
 * lines the desktop app writes when media files are dropped on the editor.
 * Works on the editor state alone, so it is tested without a DOM.
 */
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";

const onlySpaces = (text) => /^\s*$/.test(text);

/**
 * Where new statements can go near `pos`: above the top-level statement it is
 * in (a chain over several lines is one statement), after a comment it is in,
 * or on its own line when it sits between statements.
 */
export function statementBoundary(state, pos) {
  const { doc } = state;
  const at = Math.max(0, Math.min(pos, doc.length));
  const tree = ensureSyntaxTree(state, doc.length, 100) ?? syntaxTree(state);
  for (let node = tree.topNode.firstChild; node; node = node.nextSibling) {
    if (node.to <= at) continue;
    if (node.from >= at) break;
    const line = doc.lineAt(node.from);
    if (onlySpaces(doc.sliceString(line.from, node.from))) return line.from;
    // A statement that shares a line with the one before it follows a ";"
    if (!node.type.isSkipped) return node.from;
    // A comment after code on its line: go past it
    return doc.lineAt(node.to).to;
  }
  const line = doc.lineAt(at);
  return onlySpaces(doc.sliceString(line.from, at)) ? line.from : line.to;
}

/**
 * A transaction that puts `lines` on lines of their own at the statement
 * boundary nearest `pos`, with the cursor after them.
 */
export function insertLines(state, pos, lines) {
  const text = lines.join(state.lineBreak);
  const at = statementBoundary(state, pos);
  const line = state.doc.lineAt(at);
  let before = "";
  let after = "";
  if (at === line.from) {
    if (at < state.doc.length) after = state.lineBreak;
  } else if (at === line.to) {
    before = state.lineBreak;
  } else {
    before = state.lineBreak;
    after = state.lineBreak;
  }
  const insert = `${before}${text}${after}`;
  return {
    changes: { from: at, insert },
    selection: { anchor: at + insert.length - after.length },
    scrollIntoView: true,
    userEvent: "input.drop",
  };
}
