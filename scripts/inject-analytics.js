#!/usr/bin/env node

/**
 * Build script to inject analytics during deployment: the landing page
 * (index.html) and the interface (app.html) of the hosted site. Local builds,
 * the standalone server and the desktop app never get the tracker.
 * Usage: node scripts/inject-analytics.js
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ANALYTICS_SCRIPT = `<script defer src="https://umami.d17e.dev/script.js" data-website-id="46a9db27-3ca5-40e1-b863-08d9086817b4"></script>`;

export const PAGES = ["index.html", "app.html"];

/** Returns the HTML with the tracker added before </head>, or unchanged if it is already there. */
export function withAnalytics(html) {
  if (html.includes("umami.d17e.dev")) return html;
  return html.replace("</head>", `  ${ANALYTICS_SCRIPT}\n</head>`);
}

function injectAnalytics() {
  // Inject in the dist folder first (for production builds), then fall back to public
  const root = ["dist", "public"]
    .map((dir) => join(process.cwd(), dir))
    .find((dir) => PAGES.some((page) => existsSync(join(dir, page))));
  if (!root) {
    console.error(`❌ Could not find ${PAGES.join(" or ")} in dist/ or public/`);
    process.exit(1);
  }

  for (const page of PAGES) {
    const path = join(root, page);
    if (!existsSync(path)) {
      console.warn(`⚠️  ${path} not found, skipping`);
      continue;
    }
    const html = readFileSync(path, "utf8");
    const updated = withAnalytics(html);
    if (updated === html) {
      console.log(`Analytics already present in ${path}, skipping`);
      continue;
    }
    writeFileSync(path, updated, "utf8");
    console.log(`✅ Analytics script injected into ${path}`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  injectAnalytics();
}

export { injectAnalytics };
