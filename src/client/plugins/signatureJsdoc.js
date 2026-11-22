// A deliberately small JSDoc subset for display. Source parameters remain authoritative.
const paramName = /^(?:\.\.\.)?([_$\p{ID_Start}](?:[$\p{ID_Continue}]|\u200c|\u200d)*)$/u;

function readParamTag(line) {
  const tag = /^@param\s+(.+)$/.exec(line);
  if (!tag) return null;
  const content = tag[1].replace(/^\{[^{}]+\}\s+/, "");
  const optional = /^\[([^\[\]]+)\](?=\s|$)/.exec(content);
  const token = optional ? /^([^=\s]+)(?:=.+)?$/.exec(optional[1])?.[1] : /^\S+/.exec(content)?.[0];
  const name = token?.match(paramName)?.[1];
  if (!name) return null;
  const description = content
    .slice((optional?.[0] ?? token).length)
    .trim()
    .replace(/^-\s*/, "");
  return { name, description };
}

export function readSignatureJsdoc(source, declaration) {
  const comment = declaration.prevSibling;
  if (comment?.name !== "BlockComment") return null;
  const raw = source.slice(comment.from, comment.to);
  const gap = source.slice(comment.to, declaration.from);
  const lineStart = source.lastIndexOf("\n", comment.from - 1) + 1;
  if (
    !raw.startsWith("/**") ||
    !raw.endsWith("*/") ||
    !/^\s*$/.test(gap) ||
    gap.split("\n").length > 2 ||
    source.slice(lineStart, comment.from).trim()
  ) {
    return null;
  }
  const previous = comment.prevSibling;
  if (
    previous?.name === "BlockComment" &&
    source.startsWith("/**", previous.from) &&
    /^[^\S\n]*(?:\n[^\S\n]*)?$/.test(source.slice(previous.to, comment.from))
  ) {
    return null;
  }

  const summary = [];
  const descriptions = new Map();
  let target = summary;
  for (const line of raw.slice(3, -2).split(/\r?\n/)) {
    const content = line.replace(/^\s*\*?\s?/, "").trim();
    if (content.startsWith("@")) {
      target = null;
      const param = readParamTag(content);
      if (param) {
        target = descriptions.has(param.name) ? null : [param.description];
        descriptions.set(param.name, target);
      }
    } else if (content) {
      target?.push(content);
    }
  }
  return {
    description: summary.join(" "),
    descriptions,
  };
}
