/**
 * Editor colors made for two of HYDRACTRL's interface themes, Light and
 * Pop 90s (the others use ready-made CodeMirror themes, see themeMapping in
 * CodeMirrorEditor.js). The editor's background stays the panel's, so these
 * only color the text, the cursor, selections, the gutter and tooltips.
 */
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/**
 * @param {object} colors
 * @param {string} colors.text - Plain text and variables
 * @param {string} colors.comment
 * @param {string} colors.call - Function calls: osc(), noise()
 * @param {string} colors.method - Chained calls: .color(), .out()
 * @param {string} colors.number
 * @param {string} colors.keyword
 * @param {string} colors.string
 * @param {string} colors.property - Properties that aren't called: a.fft
 * @param {string} colors.punctuation - Brackets, commas, dots and operators
 * @param {string} colors.cursor
 * @param {string} colors.selection
 * @param {string} colors.gutter - Line numbers
 * @param {[string, string]} colors.activeGutter - The current line's number: [background, color]
 * @param {string} colors.bracket - Background of matching brackets
 * @param {{ background: string, border: string, selected: string, selectedText: string }} colors.tooltip
 */
export function createEditorTheme(colors) {
  const { tooltip } = colors;
  const theme = EditorView.theme(
    {
      "&": { color: colors.text },
      ".cm-content": { caretColor: colors.cursor },
      ".cm-cursor, .cm-dropCursor": { borderLeft: `2px solid ${colors.cursor}` },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        { backgroundColor: colors.selection },
      ".cm-gutters": { color: colors.gutter },
      ".cm-activeLineGutter": {
        backgroundColor: colors.activeGutter[0],
        color: colors.activeGutter[1],
      },
      "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
        backgroundColor: colors.bracket,
        outline: "none",
      },
      ".cm-tooltip": {
        backgroundColor: tooltip.background,
        color: colors.text,
        border: tooltip.border,
      },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: tooltip.selected,
        color: tooltip.selectedText,
      },
      // Fira Code has no italics, so the parameters stay upright
      ".cm-completionDetail": { color: colors.comment, fontStyle: "normal" },
      ".cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail": {
        color: "inherit",
      },
    },
    { dark: false },
  );

  const highlight = HighlightStyle.define([
    { tag: t.comment, color: colors.comment },
    { tag: t.function(t.variableName), color: colors.call },
    { tag: t.function(t.propertyName), color: colors.method },
    { tag: [t.number, t.bool, t.null, t.atom], color: colors.number },
    { tag: [t.keyword, t.self], color: colors.keyword },
    { tag: [t.string, t.special(t.string), t.regexp], color: colors.string },
    { tag: t.propertyName, color: colors.property },
    { tag: [t.punctuation, t.operator], color: colors.punctuation },
    { tag: t.invalid, color: "#dc2626" },
  ]);

  return [theme, syntaxHighlighting(highlight)];
}

/** Light: ink on white, with the violet of the HYDRACTRL logo */
export const lightEditorTheme = createEditorTheme({
  text: "#1c1a24",
  comment: "#86829a",
  call: "#6d28d9",
  method: "#0f766e",
  number: "#c2410c",
  keyword: "#be185d",
  string: "#15803d",
  property: "#0369a1",
  punctuation: "#5b5770",
  cursor: "#6d28d9",
  selection: "rgba(109, 40, 217, 0.16)",
  gutter: "#a19db0",
  activeGutter: ["rgba(109, 40, 217, 0.08)", "#1c1a24"],
  bracket: "rgba(15, 118, 110, 0.18)",
  tooltip: {
    background: "#fbfaff",
    border: "1px solid #dcd8e6",
    selected: "#6d28d9",
    selectedText: "#ffffff",
  },
});

/** Pop 90s: hot pink, teal and purple on cream, with a highlighter selection */
export const popEditorTheme = createEditorTheme({
  text: "#1a1423",
  comment: "#8b7a9c",
  call: "#d4146e",
  method: "#007c80",
  number: "#6a1fd1",
  keyword: "#c24a00",
  string: "#2a7d00",
  property: "#007c80",
  punctuation: "#4a3a5c",
  cursor: "#d4146e",
  selection: "rgba(255, 214, 10, 0.55)",
  gutter: "#a08bb5",
  activeGutter: ["#ffd60a", "#1a1423"],
  bracket: "rgba(0, 194, 184, 0.3)",
  tooltip: {
    background: "#fff8e7",
    border: "2px solid #1a1423",
    selected: "#ff3d9a",
    selectedText: "#1a1423",
  },
});
