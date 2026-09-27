/**
 * The hosted site is plain files on Cloudflare Pages: public/index.html (the
 * landing page) at /, public/app.html (the interface) at /app and
 * public/output.html at /output. These checks guard that layout.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PAGES, withAnalytics } from "../../scripts/inject-analytics.js";

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
