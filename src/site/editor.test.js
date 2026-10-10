import { describe, expect, test } from "bun:test";
import { SKETCHES, sketchSource } from "../sketches.js";
import { errorLine, fileName, highlight, renderLines, typedLength } from "./editor.js";

/** The text a rendered panel shows, line numbers left out. */
function visibleText(html) {
  return html
    .replace(/<span class="cn"[^>]*>[^<]*<\/span>/g, "")
    .replace(/<span class="cl is-hidden">.*?<\/span>(?=<span class="cl|$)/g, "\n")
    .replace(/<span class="rest">[^<]*<\/span>/g, "")
    .replace(/<\/span><span class="cl">/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

describe("highlight", () => {
  test("marks comments, strings and numbers", () => {
    expect(highlight("osc(10, 0.1).out() // hi")).toBe(
      'osc(<span class="tn">10</span>, <span class="tn">0.1</span>).out() <span class="tc">// hi</span>',
    );
    expect(highlight('s0.initImage("/a.png")')).toBe(
      's0.initImage(<span class="ts">"/a.png"</span>)',
    );
  });

  test("leaves names with digits alone and escapes markup", () => {
    expect(highlight("src(o0).out(o1)")).toBe("src(o0).out(o1)");
    expect(highlight("a < b && c > d")).toBe("a &lt; b &amp;&amp; c &gt; d");
  });

  test("copes with code that is still being typed", () => {
    expect(highlight('initImage("/as')).toBe('initImage(<span class="ts">"/as</span>');
    expect(highlight("// a")).toBe('<span class="tc">// a</span>');
    expect(highlight('"//" + 1')).toBe('<span class="ts">"//"</span> + <span class="tn">1</span>');
  });
});

describe("renderLines", () => {
  test("numbers every line inside its highlight", () => {
    const html = renderLines("osc()\n\n.out()");
    expect(html.match(/class="cl"/g)).toHaveLength(3);
    expect(html).toContain('<span class="cn" aria-hidden="true"> 1  </span>');
    expect(html).toContain('<span class="cn" aria-hidden="true"> 3  </span>.out()');
    expect(html).not.toContain("cur");
  });

  test("shows every starter sketch, untouched", () => {
    for (const sketch of SKETCHES) {
      const code = sketchSource(sketch).trimEnd();
      expect(visibleText(renderLines(code))).toBe(code);
    }
  });

  test("types in: what isn't typed keeps its place, invisible", () => {
    const code = "osc(10)\n.out()";
    const html = renderLines(code, { typed: 5 });
    expect(html).toContain('osc(<span class="tn">1</span><span class="cur"></span></span>');
    expect(html).toContain('<span class="rest">0)</span>');
    expect(html).toContain('<span class="cl is-hidden">');
    expect(html).toContain(".out()</span>");
    // Nothing typed yet: only the first line number and the cursor
    expect(renderLines(code, { typed: 0 })).toContain(
      '<span class="cb"><span class="cn" aria-hidden="true"> 1  </span><span class="cur"></span></span>',
    );
  });

  test("rests the cursor after the last character once typed", () => {
    const html = renderLines("osc()\n.out()", { cursor: true });
    expect(html.match(/class="cur/g)).toHaveLength(1);
    expect(html).toContain('.out()<span class="cur is-idle"></span>');
    expect(renderLines("osc()\n.out()", { typed: 99, cursor: true })).toBe(html);
  });

  test("moves the cursor to the next line with the line break", () => {
    const html = renderLines("ab\ncd", { typed: 3, cursor: true });
    expect(html).toContain('ab</span></span><span class="cl"><span class="cb">');
    expect(html).toContain(
      '<span class="cn" aria-hidden="true"> 2  </span><span class="cur"></span>',
    );
  });
});

describe("typedLength", () => {
  test("types the whole sketch in the same time, whatever its length", () => {
    expect(typedLength(400, 0)).toBe(0);
    expect(typedLength(400, 1000)).toBe(200);
    expect(typedLength(400, 1999)).toBe(399);
    expect(typedLength(400, 2000)).toBe(400);
    expect(typedLength(400, 5000)).toBe(400);
  });
});

describe("fileName", () => {
  test("names a sketch like a file", () => {
    expect(SKETCHES.map(fileName)).toEqual(["tide.js", "chained.js", "pulse.js", "mint.js"]);
    expect(fileName({ name: "Two Words!" })).toBe("two-words-.js");
  });
});

describe("errorLine", () => {
  test("reports an error as one comment line", () => {
    expect(errorLine(new ReferenceError("osc2 is not defined"))).toBe(
      "// ReferenceError: osc2 is not defined",
    );
    expect(errorLine(new Error("\n  (regl) Error compiling shader\n  more detail"))).toBe(
      "// (regl) Error compiling shader",
    );
    expect(errorLine("plain")).toBe("// plain");
    expect(errorLine(null)).toBe("// something went wrong");
    expect(errorLine(new Error("x".repeat(300))).length).toBeLessThanOrEqual(143);
  });
});
