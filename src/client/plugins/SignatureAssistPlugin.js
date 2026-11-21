import { syntaxTree } from "@codemirror/language";
import { StateEffect, StateField } from "@codemirror/state";
import { EditorView, showTooltip } from "@codemirror/view";
import { createCustomSignatureResolver } from "./customSignatures.js";
import { hydraCallAtCursor } from "./hydraSignature.js";

const dismiss = StateEffect.define();

// CodeMirror mounts style modules once per document and keeps them mounted.
const signatureTheme = EditorView.baseTheme({
  ".cm-signature-assist": {
    padding: "4px 8px",
    pointerEvents: "none",
    maxWidth: "min(64ch, 90vw)",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },
  "&:not(.cm-focused) .cm-signature-assist": { visibility: "hidden" },
  ".cm-signature-doc": {
    marginTop: "4px",
    fontFamily: "system-ui, sans-serif",
    whiteSpace: "normal",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: "3",
    overflow: "hidden",
  },
  ".cm-signature-assist strong": { textDecoration: "underline" },
});

function parameterLabel(parameter) {
  return Object.hasOwn(parameter, "default")
    ? `${parameter.name} = ${parameter.default}`
    : parameter.name;
}

export function signatureExtension(editor) {
  const resolve = createCustomSignatureResolver(editor);
  const signature = StateField.define({
    create: () => null,
    update(previous, transaction) {
      // A background parse update must not reopen a dismissed hint.
      if (transaction.effects.some((effect) => effect.is(dismiss))) return false;
      if (!transaction.docChanged && !transaction.selection) {
        if (
          previous === false ||
          syntaxTree(transaction.startState) === syntaxTree(transaction.state)
        ) {
          return previous;
        }
      }
      let lookup;
      const call = hydraCallAtCursor(transaction.state, (name, position) => {
        if (lookup === undefined) lookup = resolve(transaction.state);
        return lookup ? lookup(name, position) : null;
      });
      if (!call) return null;
      if (
        call.pos === previous?.pos &&
        call.active === previous.active &&
        call.name === previous.name &&
        call.description === previous.description &&
        call.params.length === previous.params.length &&
        call.params.every(
          (parameter, index) =>
            parameterLabel(parameter) === parameterLabel(previous.params[index]) &&
            parameter.documentation === previous.params[index].documentation,
        )
      )
        return previous;

      return {
        ...call,
        above: true,
        create() {
          const dom = document.createElement("div");
          dom.className = "cm-signature-assist";
          const label = document.createElement("div");
          label.className = "cm-signature-label";
          label.append(`${call.name}(`);
          call.params.forEach((parameter, index) => {
            if (index) label.append(", ");
            const param = document.createElement(index === call.active ? "strong" : "span");
            param.textContent = parameterLabel(parameter);
            label.append(param);
          });
          label.append(")");
          dom.append(label);
          for (const [kind, text] of [
            ["summary", call.description],
            ["parameter", call.params[call.active]?.documentation],
          ]) {
            if (!text) continue;
            const doc = document.createElement("div");
            doc.className = `cm-signature-doc cm-signature-${kind}`;
            doc.textContent = text;
            dom.append(doc);
          }
          return { dom };
        },
      };
    },
    provide: (field) => showTooltip.from(field, (value) => value || null),
  });

  return [
    signature,
    EditorView.focusChangeEffect.of((_state, focused) => (focused ? null : dismiss.of(null))),
    EditorView.domEventObservers({
      keydown(event, view) {
        if (event.key === "Escape" && view.state.field(signature)) {
          view.dispatch({ effects: dismiss.of(null) });
        }
      },
    }),
    signatureTheme,
  ];
}

export function createSignatureAssistPlugin() {
  return {
    id: "signature-assist",
    name: "Signature Assist",
    setup({ editor, isMobile }) {
      if (isMobile) return;
      return editor.addExtension(signatureExtension(editor));
    },
  };
}
