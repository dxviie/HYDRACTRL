import { syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import hydraData from "../../data/hydra-functions.json" assert { type: "json" };

const generators = new Set(["noise", "voronoi", "osc", "shape", "gradient", "solid", "src"]);
const helpers = new Set(["render", "hush", "setResolution", "setFunction"]);
const sources = new Set(["init", "initCam", "initScreen", "initVideo", "initImage"]);
const audio = new Set(["setSmooth", "setCutoff", "setScale", "setBins", "show"]);
const arrays = new Set(["fast", "smooth", "ease", "offset", "fit"]);
const textures = new Set(
  Object.entries(hydraData.functions)
    .filter(
      ([name, entry]) => entry.syntaxType === "method" && !audio.has(name) && !arrays.has(name),
    )
    .map(([name]) => name),
);

// Display corrections for the locked hydra-synth API. Keep editor docs and runtime untouched.
const corrections = {
  render: [{ name: "buffer" }],
  init: [{ name: "options" }, { name: "params" }],
  initCam: [{ name: "index" }, { name: "params" }],
  initScreen: [{ name: "index" }, { name: "params" }],
  initVideo: [{ name: "url", default: '""' }, { name: "params" }],
  initImage: [{ name: "url", default: '""' }, { name: "params" }],
  smooth: [{ name: "smooth", default: "1" }],
  ease: [{ name: "ease", default: '"linear"' }],
  setSmooth: [{ name: "smooth" }],
  setCutoff: [{ name: "cutoff" }],
  setScale: [{ name: "scale" }],
  setBins: [{ name: "bins" }],
};

function memberName(read, member) {
  if (member.name !== "MemberExpression") return null;
  const property = member.lastChild;
  return property?.name === "PropertyName" && property.prevSibling?.name === "."
    ? read(property.from, property.to)
    : null;
}

function chainRoot(read, receiver, methods) {
  let node = receiver;
  while (node?.name === "CallExpression") {
    const args = node.lastChild;
    const callee = node.firstChild;
    if (args?.name !== "ArgList" || args.lastChild?.name !== ")" || node.getChild("?.")) {
      return null;
    }
    for (let token = args.firstChild; token; token = token.nextSibling) {
      if (token.type.isError) return null;
    }
    if (callee.name === "VariableName") return callee;
    const name = memberName(read, callee);
    if (!methods.has(name) || name === "out") return null;
    node = callee.firstChild;
  }
  return node?.name === "ArrayExpression" ? node : null;
}

/** Find the native generator at the start of a directly returned texture expression. */
export function nativeTextureRoot(source, expression) {
  const read = (from, to) => source.slice(from, to);
  const root = chainRoot(read, expression, textures);
  if (root?.name !== "VariableName") return null;
  const name = read(root.from, root.to);
  return generators.has(name) ? { name, pos: root.from } : null;
}

function callableSignature(state, args, custom) {
  const callee = args.parent.firstChild;
  if (args.parent.getChild("?.")) return null;
  if (callee.name === "VariableName") {
    const name = state.sliceDoc(callee.from, callee.to);
    const hint = custom(name, callee.from);
    if (hint !== undefined)
      return hint && { name, params: hint.params, description: hint.description };
    return generators.has(name) || helpers.has(name) ? nativeSignature(name) : null;
  }

  const read = (from, to) => state.sliceDoc(from, to);
  const name = memberName(read, callee);
  if (!name) return null;
  const receiver = callee.firstChild;
  if (receiver.name === "VariableName") {
    const binding = state.sliceDoc(receiver.from, receiver.to);
    if (custom(binding, receiver.from) !== undefined) return null;
    if (sources.has(name) && /^s[0-3]$/.test(binding)) return nativeSignature(name);
    if (audio.has(name) && binding === "a") return nativeSignature(name);
  }
  if (textures.has(name)) {
    const root = chainRoot(read, receiver, textures);
    if (root?.name === "VariableName") {
      const binding = read(root.from, root.to);
      const hint = custom(binding, root.from);
      if (hint === undefined ? generators.has(binding) : hint?.returnsTexture) {
        return nativeSignature(name);
      }
    }
  }
  if (arrays.has(name) && chainRoot(read, receiver, arrays)?.name === "ArrayExpression") {
    return nativeSignature(name);
  }
  return null;
}

function nativeSignature(name) {
  return { name, params: corrections[name] ?? hydraData.functions[name].params };
}

export function hydraCallAtCursor(state, custom = () => undefined) {
  const { head, empty } = state.selection.main;
  if (!empty || state.selection.ranges.length !== 1 || !syntaxTreeAvailable(state, head))
    return null;
  const tree = syntaxTree(state);
  if (tree.length < head) return null;

  for (let node = tree.resolveInner(head, -1); node; node = node.parent) {
    if (node.name !== "ArgList") continue;
    const close = node.lastChild;
    if (close?.name === ")" && head >= close.to) continue;
    if (node.parent?.name !== "CallExpression" || node.firstChild?.name !== "(") return null;

    const signature = callableSignature(state, node, custom);
    if (!signature) return null;

    let active = 0;
    for (let token = node.firstChild; token && token.from < head; token = token.nextSibling) {
      if (token.type.isError || token.name === "Spread") return null;
      if (token.name === "," && token.to <= head) active++;
    }
    const last = signature.params.at(-1);
    if (active >= signature.params.length) active = last?.rest ? signature.params.length - 1 : -1;
    return { ...signature, pos: node.from, active };
  }
  return null;
}
