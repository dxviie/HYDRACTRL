/**
 * The hosted site is plain files on Cloudflare Pages: public/index.html (the
 * landing page) at /, public/app.html (the interface) at /app and
 * public/output.html at /output. These checks guard that layout.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isServerAsset } from "../../scripts/copy-public.js";
import { PAGES, withAnalytics } from "../../scripts/inject-analytics.js";
import { FEEDBACK_FORM_ID } from "../project.js";
import { SKETCHES, sketchSource } from "../sketches.js";
import { renderLines } from "./editor.js";

const PUBLIC = join(import.meta.dir, "..", "..", "public");
const read = (file) => readFileSync(join(PUBLIC, file), "utf8");

describe("site layout", () => {
  test("landing page, interface and output page are separate files", () => {
    for (const file of ["index.html", "app.html", "output.html"]) {
      expect(existsSync(join(PUBLIC, file))).toBe(true);
    }
    expect(read("index.html")).toContain('src="/site/landing.js"');
    expect(read("app.html")).toContain('src="/assets/index.js"');
    expect(read("output.html")).toContain('src="/assets/output.js"');
  });

  test("the contact form is the app's feedback form", () => {
    expect(read("index.html")).toContain(`https://tally.so/embed/${FEEDBACK_FORM_ID}?`);
  });

  test("every form links to itself for visitors without JavaScript", () => {
    const html = read("index.html");
    const ids = [...html.matchAll(/data-tally-src="https:\/\/tally\.so\/embed\/(\w+)\?/g)].map(
      (match) => match[1],
    );
    // Release news and contact
    expect(ids.length).toBe(2);
    for (const id of ids) {
      expect(html).toContain(`<noscript><a href="https://tally.so/r/${id}">`);
    }
  });

  test("_redirects never rewrites to an .html file", () => {
    // Pages answers /page.html with a redirect to /page, so a 200 rule that
    // targets it loops forever (that is how /output broke once)
    const rules = read("_redirects")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split(/\s+/));
    for (const [, target, status = "302"] of rules) {
      expect(target.endsWith(".html") && status === "200").toBe(false);
    }
  });

  test("old share links on the site root are forwarded to /app", () => {
    const html = read("index.html");
    const pattern = html.match(
      /if \((\/.+\/)\.test\(location\.hash\)\) location\.replace\("\/app"/,
    );
    expect(pattern).toBeTruthy();
    const regex = new Function(`return ${pattern[1]}`)();
    expect(regex.test("#sketch=b3NjKCk")).toBe(true);
    expect(regex.test("#foo=1&sketch=b3NjKCk")).toBe(true);
    expect(regex.test("#download")).toBe(false);
    expect(regex.test("")).toBe(false);
  });
});

describe("the hero's code panel", () => {
  test("shows the first sketch without JavaScript, exactly as the panel renders it", () => {
    // When the sketch changes, paste renderLines(sketchSource(SKETCHES[0]).trimEnd()) into the <pre>
    const view = read("index.html").match(/<pre class="code-view" data-code-view>(.*?)<\/pre>/s);
    expect(view?.[1]).toBe(renderLines(sketchSource(SKETCHES[0]).trimEnd()));
  });
});

describe("landing page media", () => {
  const tags = [...read("index.html").matchAll(/<(?:img|video)\b[^>]*>/g)].map((match) => match[0]);
  const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

  test("every image, video and poster exists", () => {
    for (const tag of tags) {
      for (const url of [attr(tag, "src"), attr(tag, "poster")]) {
        if (url?.startsWith("/")) expect(existsSync(join(PUBLIC, url))).toBe(true);
      }
    }
  });

  test("screenshots and videos are all 16:9", () => {
    const media = tags.filter((tag) => attr(tag, "src")?.startsWith("/site/"));
    expect(media.length).toBeGreaterThan(10);
    for (const tag of media) {
      expect(Number(attr(tag, "width")) * 9).toBe(Number(attr(tag, "height")) * 16);
    }
  });
});

describe("web manifest", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  // A PNG's IHDR chunk holds its width and height, big-endian, at bytes 16 and 20
  const pngSize = (file) => {
    const png = readFileSync(join(PUBLIC, file));
    return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
  };

  test("the landing page and the interface link it", () => {
    for (const file of ["index.html", "app.html"]) {
      expect(read(file)).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    }
  });

  test("an installed app opens the interface", () => {
    expect(manifest.start_url).toBe("/app");
    expect(manifest.display).toBe("standalone");
  });

  test("every icon exists at the size it claims", () => {
    for (const icon of manifest.icons) {
      expect(pngSize(icon.src)).toBe(icon.sizes);
    }
    // Browsers want a 192 and a 512 pixel icon before they offer to install
    const sizes = manifest.icons.filter((icon) => !icon.purpose).map((icon) => icon.sizes);
    expect(sizes).toEqual(["192x192", "512x512"]);
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  test("a local server ships it with its icons", () => {
    for (const file of ["manifest.webmanifest", ...manifest.icons.map((icon) => icon.src)]) {
      expect(isServerAsset(file.replace(/^\//, ""))).toBe(true);
    }
  });
});

describe("inject-analytics", () => {
  test("covers the landing page and the interface, not the output page", () => {
    expect(PAGES).toEqual(["index.html", "app.html"]);
  });

  test("adds the tracker once, before </head>", () => {
    const html = "<html><head><title>x</title></head><body></body></html>";
    const once = withAnalytics(html);
    expect(once).toContain('umami.d17e.dev/script.js" data-website-id=');
    expect(once.indexOf("umami")).toBeLessThan(once.indexOf("</head>"));
    expect(withAnalytics(once)).toBe(once);
  });
});
