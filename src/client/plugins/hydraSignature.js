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

function memberName(state, member) {
  if (member.name !== "MemberExpression") return null;
  const property = member.lastChild;
  return property?.name === "PropertyName" && property.prevSibling?.name === "."
    ? state.sliceDoc(property.from, property.to)
    : null;
}

function chainMatches(state, receiver, methods, rootMatches) {
  let node = receiver;
  while (node?.name === "CallExpression") {
    const args = node.lastChild;
    const callee = node.firstChild;
    if (args?.name !== "ArgList" || args.lastChild?.name !== ")" || node.getChild("?.")) {
      return false;
    }
    for (let token = args.firstChild; token; token = token.nextSibling) {
      if (token.type.isError) return false;
    }
    if (rootMatches(callee)) return true;
    const name = memberName(state, callee);
    if (!methods.has(name) || name === "out") return false;
    node = callee.firstChild;
  }
  return rootMatches(node);
}

function callableSignature(state, args, custom) {
  const callee = args.parent.firstChild;
  if (args.parent.getChild("?.")) return null;
  if (callee.name === "VariableName") {
    const name = state.sliceDoc(callee.from, callee.to);
    const hint = custom(name, callee.from);
    if (hint !== undefined) return hint && { name, ...hint };
    return generators.has(name) || helpers.has(name) ? nativeSignature(name) : null;
  }

  const name = memberName(state, callee);
  if (!name) return null;
  const receiver = callee.firstChild;
  if (receiver.name === "VariableName") {
    const binding = state.sliceDoc(receiver.from, receiver.to);
    if (custom(binding, receiver.from) !== undefined) return null;
    if (sources.has(name) && /^s[0-3]$/.test(binding)) return nativeSignature(name);
    if (audio.has(name) && binding === "a") return nativeSignature(name);
  }
  if (
    textures.has(name) &&
    chainMatches(state, receiver, textures, (root) => {
      if (root?.name !== "VariableName") return false;
      const binding = state.sliceDoc(root.from, root.to);
      return generators.has(binding) && custom(binding, root.from) === undefined;
    }) &&
    receiver.name === "CallExpression"
  )
    return nativeSignature(name);
  if (
    arrays.has(name) &&
    chainMatches(state, receiver, arrays, (root) => root?.name === "ArrayExpression")
  ) {
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
